import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createDicodeCore,
  type ApprovalDecision,
  type DicodeCore,
} from "@dicode/core";
import { createInitialUiState, uiReducer, type UiAction, type UiState } from "../state/ui-store.js";

export interface UseDicodeAppOptions {
  core?: DicodeCore;
  cwd?: string;
  resume?: boolean;
}

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
  sendMessage: (text: string, options?: { model?: string; effort?: string }) => Promise<void>;
  listModels: () => Promise<void>;
  interrupt: () => Promise<void>;
  respondApproval: (approvalId: string, decision: ApprovalDecision) => Promise<void>;
  toggleSidebar: () => void;
  togglePalette: () => void;
  closePalette: () => void;
  reloadSessions: () => void;
  dispatch: (action: UiAction) => void;
}

export function useDicodeApp(options: UseDicodeAppOptions = {}): DicodeAppApi {
  const [core, setCore] = useState<DicodeCore | null>(options.core ?? null);
  const [state, dispatch] = useReducer(uiReducer, createInitialUiState());
  const [input, setInput] = useState("");
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const coreRef = useRef<DicodeCore | null>(null);

  useEffect(() => {
    let disposed = false;
    const instance = options.core ?? createDicodeCore();
    coreRef.current = instance;

    (async () => {
      try {
        await instance.initialize();
        if (disposed) {
          await instance.shutdown();
          return;
        }
        setCore(instance);
        dispatch({ type: "SET_STATUS", status: "ready" });
        reloadSessionsRef.current?.();
        if (options.cwd) {
          await openProjectRef.current?.(options.cwd);
        }
        if (options.resume) {
          const sessions = instance.listSessions();
          if (sessions[0]) {
            await instance.resumeSession(sessions[0].id);
            instance.switchSession(sessions[0].id);
            dispatch({ type: "SET_SESSION", sessionId: sessions[0].id });
            dispatch({ type: "LOAD_MESSAGES", messages: instance.getMessages(sessions[0].id) });
          }
        }
        unsubscribeRef.current = instance.subscribe((event) => {
          dispatch({ type: "CORE_EVENT", event });
        });
      } catch (error) {
        dispatch({ type: "SET_ERROR", message: (error as Error).message });
        dispatch({ type: "SET_STATUS", status: "error" });
      }
    })();

    return () => {
      disposed = true;
      unsubscribeRef.current?.();
      void instance.shutdown();
    };
  }, []);

  const openProject = useCallback(async (path: string) => {
    const c = coreRef.current;
    if (!c) return;
    const project = c.openProject(path);
    dispatch({ type: "SET_PROJECT", path: project.path, name: project.name });
    reloadSessionsRef.current?.();
  }, []);

  const openCurrentDirectory = useCallback(async () => {
    await openProjectRef.current?.(process.cwd());
  }, []);

  const createSession = useCallback(async () => {
    const c = coreRef.current;
    const projectPath = c?.getCurrentProject()?.path ?? process.cwd();
    if (!c) return;
    const session = await c.createSession({ projectPath });
    dispatch({ type: "SET_SESSION", sessionId: session.id });
    reloadSessionsRef.current?.();
  }, []);

  const switchSession = useCallback(async (sessionId: string) => {
    const c = coreRef.current;
    if (!c) return;
    c.switchSession(sessionId);
    dispatch({ type: "SET_SESSION", sessionId });
    const messages = c.getMessages(sessionId);
    dispatch({ type: "LOAD_MESSAGES", messages });
  }, []);

  const resumeSession = useCallback(async (sessionId: string) => {
    const c = coreRef.current;
    if (!c) return;
    await c.resumeSession(sessionId);
    c.switchSession(sessionId);
    dispatch({ type: "SET_SESSION", sessionId });
    dispatch({ type: "LOAD_MESSAGES", messages: c.getMessages(sessionId) });
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    const c = coreRef.current;
    if (!c) return;
    await c.deleteSession(sessionId);
    reloadSessionsRef.current?.();
  }, []);

  const sendMessage = useCallback(async (text: string, options?: { model?: string; effort?: string }) => {
    const c = coreRef.current;
    const sessionId = c?.getState().sessions.currentSessionId;
    if (!c || !sessionId) return;
    dispatch({ type: "ADD_USER_MESSAGE", text });
    setInput("");
    try {
      await c.sendMessage(sessionId, { text, model: options?.model, effort: options?.effort });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: (error as Error).message });
    }
  }, []);

  const listModels = useCallback(async () => {
    const c = coreRef.current;
    if (!c) return;
    const models = await c.listModels();
    dispatch({ type: "SET_MODELS", models });
  }, []);

  const interrupt = useCallback(async () => {
    const c = coreRef.current;
    const sessionId = c?.getState().sessions.currentSessionId;
    if (!c || !sessionId) return;
    await c.interruptTask(sessionId);
  }, []);

  const respondApproval = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
    const c = coreRef.current;
    if (!c) return;
    await c.respondApproval(approvalId, decision);
  }, []);

  const reloadSessions = useCallback(() => {
    const c = coreRef.current;
    if (!c) return;
    dispatch({ type: "SET_SESSIONS", sessions: c.listSessions() });
  }, []);

  const reloadSessionsRef = useRef(reloadSessions);
  const openProjectRef = useRef(openProject);
  reloadSessionsRef.current = reloadSessions;
  openProjectRef.current = openProject;

  return {
    core,
    state,
    input,
    setInput,
    openProject,
    openCurrentDirectory,
    createSession,
    switchSession,
    resumeSession,
    deleteSession,
    sendMessage,
    listModels,
    interrupt,
    respondApproval,
    toggleSidebar: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    togglePalette: () => dispatch({ type: "TOGGLE_PALETTE" }),
    closePalette: () => dispatch({ type: "CLOSE_PALETTE" }),
    reloadSessions,
    dispatch,
  };
}
