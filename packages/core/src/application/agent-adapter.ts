import type {
  AdapterCapabilities,
  ApprovalDecision,
  ApprovalRequest,
  DicodeEvent,
  ForkThreadOptions,
  ListThreadOptions,
  ResumeThreadOptions,
  StartThreadOptions,
  ThreadInfo,
  ModelInfo,
  TurnInfo,
  TurnInput,
} from "@dicode/codex-adapter";

export interface AgentApprovalManager {
  getPendingApprovals(): ApprovalRequest[];
  respond(requestId: string, decision: ApprovalDecision): Promise<void>;
  reject(requestId: string): Promise<void>;
  onApproval(listener: (request: ApprovalRequest) => void): () => void;
  clear(): void;
}

/**
 * The boundary between Core and a concrete agent adapter. `CodexClient`
 * (Phase 2) satisfies this interface structurally; tests can supply mocks.
 */
export interface AgentAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): string;
  getCapabilities(): AdapterCapabilities;
  createThread(options?: StartThreadOptions): Promise<ThreadInfo>;
  resumeThread(threadId: string, options?: ResumeThreadOptions): Promise<ThreadInfo>;
  listThreads(options?: ListThreadOptions): Promise<ThreadInfo[]>;
  forkThread(threadId: string, options?: ForkThreadOptions): Promise<ThreadInfo>;
  archiveThread(threadId: string): Promise<void>;
  startTurn(threadId: string, input: TurnInput): Promise<TurnInfo>;
  steerTurn(threadId: string, input: TurnInput): Promise<void>;
  interruptTurn(threadId: string): Promise<void>;
  listModels(): Promise<ModelInfo[]>;
  onEvent(listener: (event: DicodeEvent) => void): () => void;
  onStatusChange(listener: (status: string) => void): () => void;
  approvalManager: AgentApprovalManager;
}
