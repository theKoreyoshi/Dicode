import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createDicodeCore,
  type ApprovalDecision,
  type DicodeCore,
  type MessageInput,
  type SessionInfo,
} from "@dicode/core";
import { createInitialUiState, readDiff, readPlan, readTokenUsage, uiReducer, type UiAction, type UiState } from "../state/ui-store.js";

export interface UseDicodeAppOptions {
  core?: DicodeCore;
  cwd?: string;
  resume?: boolean;
}

type PromptOptions = Omit<MessageInput, "text"> & { queue?: boolean };

export interface DicodeAppApi {
  core: DicodeCore | null;
  state: UiState;
  input: string;
  setInput: (text: string) => void;
  openProject: (path: string) => Promise<void>;
  openCurrentDirectory: () => Promise<void>;
  createSession: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (text: string, options?: PromptOptions) => Promise<boolean>;
  cancelQueuedPrompt: () => void;
  listModels: () => Promise<void>;
  interrupt: () => Promise<void>;
  respondApproval: (approvalId: string, decision: ApprovalDecision) => Promise<void>;
  toggleSidebar: () => void;
  reloadSessions: () => void;
  dispatch: (action: UiAction) => void;
}

export function useDicodeApp(options: UseDicodeAppOptions = {}): DicodeAppApi {
  const [core, setCore] = useState<DicodeCore | null>(null);
  const [state, dispatch] = useReducer(uiReducer, createInitialUiState());
  const [input, setInput] = useState("");
  const coreRef = useRef<DicodeCore | null>(null);
  const sessionRef = useRef<string | null>(null);
  const operationRef = useRef<"submit" | "navigate" | null>(null);
  const connectedRef = useRef(false);
  const queued = useRef(new Map<string, MessageInput>()).current;
  const retryDrafts = useRef(new Map<string, string>()).current;

  const reportError = useCallback((error: unknown) => {
    dispatch({ type: "SET_ERROR", message: error instanceof Error ? error.message : String(error) });
  }, []);

  const reloadSessions = useCallback(() => {
    const c = coreRef.current;
    if (c?.getStatus() === "ready") dispatch({ type: "SET_SESSIONS", sessions: c.listSessions({ archived: false }) });
  }, []);

  const activate = useCallback((c: DicodeCore, session: SessionInfo | null) => {
    if (!session) {
      sessionRef.current = null;
      dispatch({ type: "SET_SESSION", sessionId: null });
      return;
    }
    const project = c.getCurrentProject();
    if (project?.path !== session.projectPath) {
      const opened = c.openProject(session.projectPath);
      dispatch({ type: "SET_PROJECT", path: opened.path, name: opened.name });
    }
    sessionRef.current = session.id;
    const taskId = c.getState().tasks.runningBySession[session.id] ?? null;
    const plan = c.getLatestSessionEvent(session.id, "plan.updated");
    dispatch({
      type: "SET_SESSION",
      sessionId: session.id,
      view: {
        messages: c.getMessages(session.id),
        tools: c.getToolExecutions(session.id),
        diff: readDiff(c.getLatestSessionEvent(session.id, "diff.updated")?.payload),
        plan: plan ? readPlan(plan.payload, plan.createdAt) : null,
        tokenUsage: readTokenUsage(c.getLatestSessionEvent(session.id, "token.usage")?.payload),
        queuedPrompt: queued.get(session.id)?.text ?? null,
        taskId,
        approvals: taskId ? c.getPendingApprovals().filter((approval) => approval.sessionId === session.id) : [],
      },
    });
    const draft = retryDrafts.get(session.id);
    if (draft) {
      retryDrafts.delete(session.id);
      setInput((current) => current || draft);
    }
  }, [queued, retryDrafts]);

  const restoreQueued = useCallback((sessionId: string, prompt: MessageInput) => {
    if (sessionRef.current === sessionId) {
      setInput((current) => {
        if (current) retryDrafts.set(sessionId, prompt.text);
        return current || prompt.text;
      });
      dispatch({ type: "SET_NOTICE", message: "Queued prompt held after the previous turn ended. Submit it again when ready." });
    } else {
      retryDrafts.set(sessionId, prompt.text);
    }
  }, [retryDrafts]);

  useEffect(() => {
    let disposed = false;
    let starting = true;
    let instance: DicodeCore;
    try {
      instance = options.core ?? createDicodeCore();
    } catch (error) {
      reportError(error);
      dispatch({ type: "SET_STATUS", status: "error" });
      return;
    }
    coreRef.current = instance;
    const unsubscribe = instance.subscribe((event) => {
      dispatch({ type: "CORE_EVENT", event });
      if (event.type.startsWith("session.")) reloadSessions();
      if (event.type === "runtime.disconnected") {
        connectedRef.current = false;
        for (const [sessionId, prompt] of queued) restoreQueued(sessionId, prompt);
        queued.clear();
      } else if (event.type === "runtime.connected") {
        connectedRef.current = true;
      }

      if (event.type !== "task.completed" && event.type !== "task.failed" && event.type !== "task.interrupted") return;
      const sessionId = event.sessionId;
      if (!sessionId) return;
      const prompt = queued.get(sessionId);
      if (!prompt) return;
      queued.delete(sessionId);
      dispatch({ type: "SET_QUEUED_PROMPT", sessionId, prompt: null });
      if (event.type === "task.completed" && connectedRef.current) {
        void instance.sendMessage(sessionId, prompt).catch((error: unknown) => {
          if (sessionRef.current === sessionId) reportError(error);
          restoreQueued(sessionId, prompt);
        });
      } else {
        restoreQueued(sessionId, prompt);
      }
    });

    void (async () => {
      try {
        await instance.initialize();
        if (disposed) return;
        connectedRef.current = true;
        const project = instance.openProject(options.cwd ?? process.cwd());
        dispatch({ type: "SET_PROJECT", path: project.path, name: project.name });
        reloadSessions();
        const config = instance.getConfig().agent;
        if (config.defaultModel) dispatch({ type: "SET_SELECTED_MODEL", model: config.defaultModel });
        if (config.reasoningEffort) dispatch({ type: "SET_SELECTED_EFFORT", effort: config.reasoningEffort });
        if (options.resume) {
          const latest = instance.listSessions({ projectPath: project.path, archived: false, limit: 1 })[0];
          if (latest) {
            try {
              const resumed = await instance.resumeSession(latest.id);
              if (disposed) return;
              activate(instance, resumed);
            } catch (error) {
              if (!disposed) reportError(error);
            }
          } else {
            dispatch({ type: "SET_NOTICE", message: "This project has no previous sessions." });
          }
        }
        if (disposed) return;
        setCore(instance);
        dispatch({ type: "SET_STATUS", status: "ready" });
        void instance.listModels().then((models) => {
          if (!disposed) dispatch({ type: "SET_MODELS", models });
        }).catch(() => { /* The interactive model picker can retry explicitly. */ });
      } catch (error) {
        if (!disposed) {
          reportError(error);
          dispatch({ type: "SET_STATUS", status: "error" });
        }
      } finally {
        starting = false;
        if (disposed) await instance.shutdown().catch(() => undefined);
      }
    })();

    return () => {
      disposed = true;
      connectedRef.current = false;
      coreRef.current = null;
      unsubscribe();
      if (!starting) void instance.shutdown().catch(() => undefined);
    };
  }, [activate, queued, reloadSessions, reportError, restoreQueued]);

  const canNavigate = useCallback((c: DicodeCore) => {
    const current = sessionRef.current;
    if (current && c.getState().tasks.runningBySession[current]) {
      dispatch({ type: "SET_NOTICE", message: "Finish or interrupt the active turn before switching sessions." });
      return false;
    }
    return true;
  }, []);

  const openProject = useCallback(async (path: string) => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready" || operationRef.current || !canNavigate(c)) return;
    try {
      const previous = c.getCurrentProject();
      const project = c.openProject(path);
      if (previous?.path !== project.path) {
        activate(c, null);
        setInput("");
      }
      dispatch({ type: "SET_PROJECT", path: project.path, name: project.name });
      reloadSessions();
    } catch (error) {
      reportError(error);
    }
  }, [activate, canNavigate, reloadSessions, reportError]);

  const createSession = useCallback(async () => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready" || operationRef.current || !canNavigate(c)) return;
    activate(c, null);
    setInput("");
  }, [activate, canNavigate]);

  const resumeSession = useCallback(async (sessionId: string) => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready" || operationRef.current || sessionId === sessionRef.current || !canNavigate(c)) return;
    operationRef.current = "navigate";
    try {
      const session = await c.resumeSession(sessionId);
      setInput("");
      activate(c, session);
    } catch (error) {
      reportError(error);
    } finally {
      operationRef.current = null;
    }
  }, [activate, canNavigate, reportError]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready" || operationRef.current) return;
    if (c.getState().tasks.runningBySession[sessionId]) {
      reportError("Interrupt this session before deleting it.");
      return;
    }
    try {
      await c.deleteSession(sessionId);
      queued.delete(sessionId);
      retryDrafts.delete(sessionId);
      if (sessionRef.current === sessionId) activate(c, null);
    } catch (error) {
      reportError(error);
    }
  }, [activate, queued, reportError, retryDrafts]);

  const sendMessage = useCallback(async (text: string, options: PromptOptions = {}) => {
    const c = coreRef.current;
    if (!text.trim() || operationRef.current || c?.getStatus() !== "ready" || !connectedRef.current) return false;
    operationRef.current = "submit";
    const clearAcceptedDraft = () => setInput((current) => current === text || current.trim() === text ? "" : current);
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "SET_NOTICE", message: null });
    try {
      let sessionId = sessionRef.current;
      if (!sessionId) {
        const projectPath = c.getCurrentProject()?.path ?? process.cwd();
        const firstLine = text.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? text;
        const titleChars = [...firstLine];
        const title = titleChars.length > 72 ? `${titleChars.slice(0, 71).join("")}…` : firstLine;
        const session = await c.createSession({ projectPath, model: options.model, title });
        activate(c, session);
        sessionId = session.id;
      }
      const running = Boolean(c.getState().tasks.runningBySession[sessionId]);
      const config = c.getConfig().agent;
      const mode = options.mode;
      let model = options.model ?? config.defaultModel ?? undefined;
      const effort = options.effort ?? config.reasoningEffort ?? undefined;
      if (mode && !model) {
        model = c.getSession(sessionId)?.model ?? undefined;
        if (!model) {
          const models = await c.listModels();
          model = (models.find((candidate) => candidate.isDefault) ?? models[0])?.model;
        }
        if (!model) throw new Error("Select a model before changing agent mode.");
      }
      const prompt: MessageInput = { text, model, effort, mode };
      if (running && options.queue) {
        if (queued.has(sessionId)) {
          dispatch({ type: "SET_NOTICE", message: "A prompt is already queued for this session." });
          return false;
        }
        // The prior turn can finish while resolving the model. Check again before queuing.
        if (c.getState().tasks.runningBySession[sessionId]) {
          queued.set(sessionId, prompt);
          dispatch({ type: "SET_QUEUED_PROMPT", sessionId, prompt: text });
        } else {
          await c.sendMessage(sessionId, prompt);
        }
      } else if (c.getState().tasks.runningBySession[sessionId]) {
        await c.steerTask(sessionId, { text });
      } else {
        await c.sendMessage(sessionId, prompt);
      }
      clearAcceptedDraft();
      return true;
    } catch (error) {
      reportError(error);
      return false;
    } finally {
      operationRef.current = null;
    }
  }, [activate, queued, reportError]);

  const cancelQueuedPrompt = useCallback(() => {
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    const prompt = queued.get(sessionId);
    if (!prompt) return;
    queued.delete(sessionId);
    dispatch({ type: "SET_QUEUED_PROMPT", sessionId, prompt: null });
    setInput((current) => current || prompt.text);
  }, [queued]);

  const listModels = useCallback(async () => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready") return;
    try {
      dispatch({ type: "SET_MODELS", models: await c.listModels() });
    } catch (error) {
      reportError(error);
    }
  }, [reportError]);

  const interrupt = useCallback(async () => {
    const c = coreRef.current;
    const sessionId = sessionRef.current;
    if (c?.getStatus() !== "ready" || !sessionId) return;
    try {
      await c.interruptTask(sessionId);
    } catch (error) {
      reportError(error);
    }
  }, [reportError]);

  const respondApproval = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
    const c = coreRef.current;
    if (c?.getStatus() !== "ready") return;
    try {
      await c.respondApproval(approvalId, decision);
    } catch (error) {
      reportError(error);
    }
  }, [reportError]);

  return {
    core,
    state,
    input,
    setInput,
    openProject,
    openCurrentDirectory: () => openProject(process.cwd()),
    createSession,
    switchSession: resumeSession,
    resumeSession,
    deleteSession,
    sendMessage,
    cancelQueuedPrompt,
    listModels,
    interrupt,
    respondApproval,
    toggleSidebar: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    reloadSessions,
    dispatch,
  };
}
