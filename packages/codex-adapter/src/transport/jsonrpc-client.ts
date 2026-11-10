import { isAdapterError } from "../errors/adapter-errors.js";
import { logger } from "../logger.js";
import { RequestManager } from "./request-manager.js";
import type { WireMessage } from "./stdio-transport.js";

export interface RpcTransport {
  write(message: WireMessage): void;
  onMessage(handler: (message: WireMessage) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  close(): void;
}

export interface ServerRequest {
  id: string | number;
  method: string;
  params: unknown;
}

export type NotificationHandler = (method: string, params: unknown) => void;
export type ServerRequestHandler = (request: ServerRequest) => void;

export interface JsonRpcClientOptions {
  transport: RpcTransport;
  defaultTimeoutMs?: number;
}

/**
 * JSON-RPC client over the stdio transport. Correlates responses by id, routes
 * notifications and server-initiated requests (approvals), and fails all
 * in-flight requests when the transport errors out.
 */
export class JsonRpcClient {
  private readonly transport: RpcTransport;
  private readonly requests: RequestManager;
  private readonly notificationHandlers = new Set<NotificationHandler>();
  private serverRequestHandler: ServerRequestHandler | null = null;
  private detachMessage: () => void;
  private detachError: () => void;

  constructor(options: JsonRpcClientOptions) {
    this.transport = options.transport;
    this.requests = new RequestManager({ defaultTimeoutMs: options.defaultTimeoutMs });
    this.detachMessage = options.transport.onMessage((message) => this.handleMessage(message));
    this.detachError = options.transport.onError((error) => this.handleError(error));
  }

  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
    const { id, promise } = this.requests.create(method, timeoutMs);
    const frame: WireMessage = { jsonrpc: "2.0", id, method };
    if (params !== undefined) frame.params = params;
    this.transport.write(frame);
    return promise;
  }

  notify(method: string, params?: unknown): void {
    const frame: WireMessage = { jsonrpc: "2.0", method };
    if (params !== undefined) frame.params = params;
    this.transport.write(frame);
  }

  respond(id: string | number, result: unknown): void {
    this.transport.write({ jsonrpc: "2.0", id, result });
  }

  respondError(id: string | number, code: number, message: string, data?: unknown): void {
    this.transport.write({ jsonrpc: "2.0", id, error: { code, message, data } });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => { this.notificationHandlers.delete(handler); };
  }

  onServerRequest(handler: ServerRequestHandler): () => void {
    this.serverRequestHandler = handler;
    return () => {
      this.serverRequestHandler = null;
    };
  }

  close(): void {
    this.detachMessage();
    this.detachError();
    this.transport.close();
    this.notificationHandlers.clear();
    this.requests.failAll(new Error("JSON-RPC client closed"));
  }

  get pendingCount(): number {
    return this.requests.pendingCount;
  }

  private handleMessage(message: WireMessage): void {
    const id = message.id;
    const method = message.method;

    // Server -> client request (approval / elicitation).
    if (isJsonRpcId(id) && typeof method === "string") {
      const request: ServerRequest = { id, method, params: message.params };
      if (this.serverRequestHandler) {
        this.serverRequestHandler(request);
      } else {
        this.respondError(request.id, -32601, `method not handled: ${method}`);
      }
      return;
    }

    // Server -> client notification (event stream).
    if (id === undefined && typeof method === "string") {
      for (const handler of this.notificationHandlers) handler(method, message.params);
      return;
    }

    // Response to one of our requests.
    if (isJsonRpcId(id)) {
      if (message.error !== undefined) {
        const error = message.error as { code?: unknown; message?: unknown; data?: unknown };
        const code = typeof error.code === "number" ? error.code : -32000;
        const msg = typeof error.message === "string" ? error.message : "unknown error";
        if (!this.requests.rejectWithRpcError(id, code, msg, error.data)) {
          logger.warn("response for unknown request id", { id });
        }
      } else {
        if (!this.requests.resolve(id, message.result)) {
          logger.warn("response for unknown request id", { id });
        }
      }
    }
  }

  private handleError(error: Error): void {
    if (isAdapterError(error)) {
      this.requests.failAll(error);
    } else {
      this.requests.failAll(new Error(`transport error: ${error.message}`));
    }
  }
}

function isJsonRpcId(id: unknown): id is string | number {
  return typeof id === "string" || typeof id === "number";
}
