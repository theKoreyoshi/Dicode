import { PRODUCT_NAME, PRODUCT_VERSION } from "@dicode/shared";
import { CodexApprovalManager } from "../approval/approval-manager.js";
import type { ApprovalRequest } from "../approval/approval-types.js";
import { AdapterNotReadyError } from "../errors/adapter-errors.js";
import { EventBus, type DicodeEventListener } from "../events/event-listener.js";
import { mapNotification } from "../events/event-mapper.js";
import { Logger, logger } from "../logger.js";
import { ClientMethods, ServerNotificationMethods } from "../protocol.js";
import { ProcessManager, type ProcessManagerOptions } from "../process/process-manager.js";
import { resolveProcessConfig, type ProcessConfig } from "../process/process-config.js";
import { CodexThreadManager, type ThreadManager } from "../thread/thread-manager.js";
import type { ForkThreadOptions, ListThreadOptions, ResumeThreadOptions, StartThreadOptions } from "../thread/thread-types.js";
import { JsonRpcClient } from "../transport/jsonrpc-client.js";
import { StdioTransport } from "../transport/stdio-transport.js";
import { CodexTurnManager, type TurnManager } from "../turn/turn-manager.js";
import type { TurnInput, TurnInfo } from "../turn/turn-types.js";
import type { ModelInfo, ModelListResult } from "../protocol/protocol-types.js";
import { CapabilityManager, type AdapterCapabilities } from "./capability-manager.js";
import { initializeClient, type ClientInfo } from "./initialization.js";
import { loginWithBrowser, type CodexAccountStatus } from "./account.js";
import { customModelArguments, customProviderId, sameCustomModel, type CustomModelConfig } from "./model-provider.js";

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

interface McpServerStatusPage {
  data: Array<{ name: string; authStatus: string; tools: Record<string, unknown> }>;
  nextCursor: string | null;
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

  private processManager: ProcessManager;
  private readonly processConfig: ProcessConfig;
  private readonly stopTimeoutMs?: number;
  private customModel?: CustomModelConfig;
  private providerSecret?: string;
  private reconfiguration?: Promise<void>;
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
    this.processConfig = options.config ?? resolveProcessConfig();
    this.stopTimeoutMs = options.stopTimeoutMs;
    this.processManager = this.createProcessManager();

    this.threadManager = new CodexThreadManager((method, params) =>
      this.requireRpc().request(method, params),
    );
    this.turnManager = new CodexTurnManager((method, params) =>
      this.requireRpc().request(method, params),
    );
    this.approvalManager = new CodexApprovalManager((id, result) => {
      this.requireRpc().respond(id, result);
      this.eventBus.emit("approval.resolved", { payload: { id } });
    });
    this.approvalManager.onApproval((request) => {
      this.eventBus.emit("approval.requested", {
        sessionId: request.threadId,
        turnId: request.turnId,
        itemId: request.itemId,
        payload: request,
      });
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

    this.transport = new StdioTransport({
      stdin, stdout, stderr: stderr ?? undefined, logger: this.logger, providerSecret: this.providerSecret,
    });
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
    await this.reconfiguration?.catch(() => undefined);
    await this.stopRuntime();
  }

  async selectCustomModel(config?: CustomModelConfig): Promise<void> {
    if (this.reconfiguration) throw new AdapterNotReadyError("Codex is already switching providers.");
    if (sameCustomModel(config, this.customModel)) return;
    const envName = config?.apiKeyEnv;
    const secret = envName ? this.readEnvironmentVariable(envName)?.trim() : undefined;
    if (envName && !secret) {
      throw new AdapterNotReadyError(`Set the ${envName} environment variable before starting Dicode.`);
    }
    this.reconfiguration = this.restartRuntime(config, secret);
    try {
      await this.reconfiguration;
    } finally {
      this.reconfiguration = undefined;
      this.setStatus(this.status);
    }
  }

  private async restartRuntime(config?: CustomModelConfig, secret?: string): Promise<void> {
    const previous = this.customModel;
    const previousSecret = this.providerSecret;
    await this.stopRuntime();
    this.providerSecret = secret;
    this.processManager = this.createProcessManager(config);
    try {
      await this.start();
      this.customModel = config;
    } catch (error) {
      await this.stopRuntime();
      this.providerSecret = previousSecret;
      this.processManager = this.createProcessManager(previous);
      await this.start().catch(() => undefined);
      throw new AdapterNotReadyError("Codex could not start with the selected provider.", { cause: error });
    }
  }

  private readEnvironmentVariable(name: string): string | undefined {
    const environment = this.processConfig.env;
    const key = process.platform === "win32"
      ? Object.keys(environment).find((candidate) => candidate.toUpperCase() === name.toUpperCase()) ?? name
      : name;
    return environment[key];
  }

  private async stopRuntime(): Promise<void> {
    this.rpc?.close();
    this.rpc = null;
    this.transport = null;
    await this.processManager.stop();
    this.approvalManager.clear();
    this.turnManager.reset();
    this.setStatus("disconnected");
  }

  private createProcessManager(config?: CustomModelConfig): ProcessManager {
    const runtime = new ProcessManager({
      config: {
        ...this.processConfig,
        args: config ? [...this.processConfig.args, ...customModelArguments(config)] : this.processConfig.args,
      },
      stopTimeoutMs: this.stopTimeoutMs,
    });
    runtime.on("exit", () => {
      if (this.processManager === runtime) this.handleProcessExit();
    });
    runtime.on("error", (error) => {
      this.logger.error("app-server error", { message: error.message });
    });
    return runtime;
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

  async readAccount(): Promise<CodexAccountStatus> {
    this.requireReady();
    return await this.requireRpc().request(ClientMethods.accountRead, { refreshToken: false }) as CodexAccountStatus;
  }

  async loginWithChatGpt(showUrl: (url: string) => void, signal: AbortSignal): Promise<void> {
    this.requireReady();
    const disconnected = new AbortController();
    const off = this.onStatusChange((status) => {
      if (status !== "ready") disconnected.abort(new Error("Codex App Server disconnected during sign-in."));
    });
    try {
      await loginWithBrowser(this.requireRpc(), showUrl, AbortSignal.any([signal, disconnected.signal]));
    } finally {
      off();
    }
  }

  async readEffectiveConfig(cwd: string): Promise<Record<string, unknown>> {
    this.requireReady();
    const result = await this.requireRpc().request(ClientMethods.configRead, { cwd }) as {
      config: Record<string, unknown>;
    };
    return result.config;
  }

  async listMcpServerStatus(cursor: string | null): Promise<McpServerStatusPage> {
    this.requireReady();
    return await this.requireRpc().request(ClientMethods.mcpServerStatusList, {
      cursor, detail: "toolsAndAuthOnly",
    }) as McpServerStatusPage;
  }

  async listSkills(cwd: string): Promise<Array<{ name: string; enabled: boolean; scope: string }>> {
    this.requireReady();
    const result = await this.requireRpc().request(ClientMethods.skillsList, { cwds: [cwd] }) as {
      data: Array<{ skills: Array<{ name: string; enabled: boolean; scope: string }> }>;
    };
    return result.data.flatMap((entry) => entry.skills);
  }

  async listModels(): Promise<ModelInfo[]> {
    const result = (await this.requireRpc().request(ClientMethods.modelList, {})) as ModelListResult;
    return result.data ?? [];
  }

  async searchFiles(root: string, query: string, cancellationToken: string): Promise<string[]> {
    this.requireReady();
    const result = await this.requireRpc().request(ClientMethods.fuzzyFileSearch, {
      roots: [root], query, cancellationToken,
    }) as { files: Array<{ path: string; match_type: string }> };
    return result.files.filter((file) => file.match_type === "file").slice(0, 8).map((file) => file.path);
  }

  async createThread(options?: StartThreadOptions): Promise<import("../thread/thread-types.js").ThreadInfo> {
    this.requireReady();
    const thread = await this.threadManager.start(options);
    this.assertCustomModel(thread, options?.model);
    return thread;
  }

  async resumeThread(threadId: string, options?: ResumeThreadOptions) {
    this.requireReady();
    const thread = await this.threadManager.resume(threadId, options);
    this.assertCustomModel(thread, options?.model);
    return thread;
  }

  listThreads(options?: ListThreadOptions) {
    this.requireReady();
    return this.threadManager.list(options);
  }

  async forkThread(threadId: string, options?: ForkThreadOptions) {
    this.requireReady();
    const thread = await this.threadManager.fork(threadId, options);
    this.assertCustomModel(thread, options?.model);
    return thread;
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
      if (method === ServerNotificationMethods.serverRequestResolved) {
        const { threadId, requestId } = record;
        if (typeof threadId === "string" && (typeof requestId === "string" || typeof requestId === "number")) {
          const expired = this.approvalManager.expire(requestId, threadId);
          if (expired) this.emitExpiredApproval(expired);
        }
        return;
      }
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
      this.turnManager.noteTurnEnded(threadId, turnId);
      if (turnId) {
        for (const request of this.approvalManager.expireTurn(threadId, turnId)) this.emitExpiredApproval(request);
      }
    }
  }

  private emitExpiredApproval(request: ApprovalRequest): void {
    this.eventBus.emit("approval.expired", {
      sessionId: request.threadId,
      turnId: request.turnId,
      itemId: request.itemId,
      payload: { requestId: request.id },
    });
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

  private assertCustomModel(thread: { modelProvider?: string | null; model?: string | null }, model?: string): void {
    const custom = this.customModel;
    if (!custom) return;
    if (thread.modelProvider !== customProviderId(custom) || thread.model !== (model ?? custom.model)) {
      throw new AdapterNotReadyError("Codex did not select the configured custom model and provider. Check any managed Codex settings.");
    }
  }

  private requireReady(): void {
    if (this.status !== "ready") {
      throw new AdapterNotReadyError(`codex client is not ready (status: ${this.status})`);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    if (this.reconfiguration) return;
    for (const listener of [...this.statusListeners]) {
      try {
        listener(status);
      } catch {
        // ignore
      }
    }
  }
}
