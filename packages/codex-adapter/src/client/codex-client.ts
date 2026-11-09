import { PRODUCT_NAME, PRODUCT_VERSION } from "@dicode/shared";
import { CodexApprovalManager } from "../approval/approval-manager.js";
import { AdapterNotReadyError } from "../errors/adapter-errors.js";
import { EventBus, type DicodeEventListener } from "../events/event-listener.js";
import { mapNotification } from "../events/event-mapper.js";
import { Logger, logger } from "../logger.js";
import { ServerNotificationMethods } from "../protocol.js";
import { ProcessManager, type ProcessManagerOptions } from "../process/process-manager.js";
import { CodexThreadManager, type ThreadManager } from "../thread/thread-manager.js";
import type { ForkThreadOptions, ListThreadOptions, ResumeThreadOptions, StartThreadOptions } from "../thread/thread-types.js";
import { JsonRpcClient } from "../transport/jsonrpc-client.js";
import { StdioTransport } from "../transport/stdio-transport.js";
import { CodexTurnManager, type TurnManager } from "../turn/turn-manager.js";
import type { TurnInput, TurnInfo } from "../turn/turn-types.js";
import type { ModelInfo, ModelListResult } from "../protocol/protocol-types.js";
import { CapabilityManager, type AdapterCapabilities } from "./capability-manager.js";
import { initializeClient, type ClientInfo } from "./initialization.js";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "reconnecting"
  | "failed";

export interface CodexClientOptions extends ProcessManagerOptions {
  clientInfo?: ClientInfo;
  defaultTimeoutMs?: number;
  logger?: Logger;
}

/**
 * Top-level adapter client. Owns the process, transport, JSON-RPC layer, and
 * the thread/turn/event/approval managers, and exposes a single ready-to-use
 * surface to Core/TUI.
 */
export class CodexClient {
  readonly eventBus = new EventBus();
  readonly threadManager: ThreadManager;
  readonly turnManager: TurnManager;
  readonly approvalManager: CodexApprovalManager;

  private readonly processManager: ProcessManager;
  private readonly capabilities = new CapabilityManager();
  private readonly clientInfo: ClientInfo;
  private readonly logger: Logger;
  private readonly defaultTimeoutMs?: number;
  private transport: StdioTransport | null = null;
  private rpc: JsonRpcClient | null = null;
  private status: ConnectionStatus = "disconnected";
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(options: CodexClientOptions = {}) {
    this.clientInfo = options.clientInfo ?? { name: PRODUCT_NAME, version: PRODUCT_VERSION };
    this.logger = options.logger ?? logger;
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.processManager = new ProcessManager(options);

    this.threadManager = new CodexThreadManager((method, params) =>
      this.requireRpc().request(method, params),
    );
    this.turnManager = new CodexTurnManager((method, params) =>
      this.requireRpc().request(method, params),
    );
    this.approvalManager = new CodexApprovalManager((id, result) => {
      this.requireRpc().respond(id, result);
      this.eventBus.emit("approval.resolved", { payload: { id, result } });
    });

    this.approvalManager.onApproval((request) => {
      this.eventBus.emit("approval.requested", {
        sessionId: request.threadId,
        turnId: request.turnId,
        itemId: request.itemId,
        payload: request,
      });
    });

    this.processManager.on("exit", () => this.handleProcessExit());
    this.processManager.on("error", (error) => {
      this.logger.error("app-server error", { message: error.message });
    });
  }

  async start(): Promise<void> {
    if (this.status === "ready" || this.status === "connecting" || this.status === "initializing") {
      return;
    }

    this.setStatus("connecting");
    await this.processManager.start();

    const stdin = this.processManager.stdin;
    const stdout = this.processManager.stdout;
    const stderr = this.processManager.stderr;
    if (!stdin || !stdout) {
      this.setStatus("failed");
      throw new AdapterNotReadyError("app-server stdio streams are unavailable");
    }

    this.transport = new StdioTransport({ stdin, stdout, stderr: stderr ?? undefined, logger: this.logger });
    this.rpc = new JsonRpcClient({ transport: this.transport, defaultTimeoutMs: this.defaultTimeoutMs });
    this.wireRpc();

    this.setStatus("initializing");
    try {
      const response = await initializeClient(this.rpc, this.clientInfo);
      this.capabilities.setInitializeResponse(response);
      this.capabilities.setExperimentalApi(true);
      this.capabilities.markInitialized();
      this.setStatus("ready");
      this.logger.info("codex client ready", { userAgent: response.userAgent });
    } catch (error) {
      this.setStatus("failed");
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.rpc?.close();
    this.rpc = null;
    this.transport = null;
    await this.processManager.stop();
    this.approvalManager.clear();
    this.setStatus("disconnected");
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getCapabilities(): AdapterCapabilities {
    return this.capabilities.get();
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onEvent(listener: DicodeEventListener): () => void {
    return this.eventBus.subscribe(listener);
  }

  async healthCheck(timeoutMs = 5000): Promise<void> {
    await this.requireRpc().request("model/list", { limit: 1 }, timeoutMs);
  }

  async listModels(): Promise<ModelInfo[]> {
    const result = (await this.requireRpc().request("model/list", {})) as ModelListResult;
    return result.data ?? [];
  }

  createThread(options?: StartThreadOptions): Promise<import("../thread/thread-types.js").ThreadInfo> {
    this.requireReady();
    return this.threadManager.start(options);
  }

  resumeThread(threadId: string, options?: ResumeThreadOptions) {
    this.requireReady();
    return this.threadManager.resume(threadId, options);
  }

  listThreads(options?: ListThreadOptions) {
    this.requireReady();
    return this.threadManager.list(options);
  }

  forkThread(threadId: string, options?: ForkThreadOptions) {
    this.requireReady();
    return this.threadManager.fork(threadId, options);
  }

  archiveThread(threadId: string): Promise<void> {
    this.requireReady();
    return this.threadManager.archive(threadId);
  }

  startTurn(threadId: string, input: TurnInput): Promise<TurnInfo> {
    this.requireReady();
    return this.turnManager.start(threadId, input);
  }

  steerTurn(threadId: string, input: TurnInput): Promise<void> {
    this.requireReady();
    return this.turnManager.steer(threadId, input);
  }

  interruptTurn(threadId: string): Promise<void> {
    this.requireReady();
    return this.turnManager.interrupt(threadId);
  }

  private wireRpc(): void {
    const rpc = this.rpc;
    if (!rpc) return;

    rpc.onNotification((method, params) => {
      const record = (params ?? {}) as Record<string, unknown>;
      this.syncTurnState(method, record);
      const mapped = mapNotification({ method, params });
      this.eventBus.emit(mapped.type, {
        sessionId: mapped.sessionId,
        turnId: mapped.turnId,
        itemId: mapped.itemId,
        payload: mapped.payload,
      });
    });

    rpc.onServerRequest((request) => {
      const handled = this.approvalManager.handleServerRequest(request.id, request.method, request.params);
      if (!handled) {
        rpc.respondError(request.id, -32601, `unhandled server request: ${request.method}`);
      }
    });
  }

  private syncTurnState(method: string, params: Record<string, unknown>): void {
    const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
    const turn = params.turn as Record<string, unknown> | undefined;
    const turnId = typeof turn?.id === "string" ? turn.id : undefined;
    if (!threadId) return;

    if (method === ServerNotificationMethods.turnStarted && turnId) {
      this.turnManager.noteTurnStarted(threadId, turnId);
    } else if (method === ServerNotificationMethods.turnCompleted) {
      this.turnManager.noteTurnEnded(threadId);
    }
  }

  private handleProcessExit(): void {
    this.rpc?.close();
    this.rpc = null;
    this.transport = null;
    this.approvalManager.clear();
    this.eventBus.emit("connection.status", {
      payload: { status: "crashed" as const, pid: this.processManager.getProcessInfo().pid },
    });
    this.setStatus("failed");
  }

  private requireRpc(): JsonRpcClient {
    if (!this.rpc) throw new AdapterNotReadyError("codex client is not connected");
    return this.rpc;
  }

  private requireReady(): void {
    if (this.status !== "ready") {
      throw new AdapterNotReadyError(`codex client is not ready (status: ${this.status})`);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of [...this.statusListeners]) {
      try {
        listener(status);
      } catch {
        // ignore
      }
    }
  }
}
