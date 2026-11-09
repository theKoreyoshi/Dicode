/**
 * JSON-RPC client over a newline-delimited stdio transport.
 *
 * Phase 2 implements: request/response correlation by id, per-request timeouts,
 * concurrent in-flight tracking, notification dispatch, and server-request
 * (approval) routing. This file only declares the public contract.
 */
import type { JsonRpcId, JsonRpcMessage } from "@dicode/shared";

export interface JsonRpcClient {
  request(method: string, params?: unknown): Promise<unknown>;
  notify(method: string, params?: unknown): void;
  respond(id: JsonRpcId, result: unknown): void;
  respondError(id: JsonRpcId, code: number, message: string): void;
  onMessage(handler: (message: JsonRpcMessage) => void): () => void;
  close(): Promise<void>;
}
