import { z } from "zod";

/**
 * Minimal JSON-RPC 2.0 primitives shared across Dicode. The Codex App Server
 * transports one JSON object per line over stdio; `jsonrpc` is optional on the
 * wire (the server accepts it but does not require it).
 */

export const jsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0").optional(),
  id: jsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
  trace: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0").optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;

export const jsonRpcResponseSchema = z
  .object({
    jsonrpc: z.literal("2.0").optional(),
    id: jsonRpcIdSchema,
    // `z.unknown()` accepts `undefined`, which makes the key optional in Zod.
    // JSON-RPC requires `result` to be present, so we enforce the key explicitly.
    result: z.unknown(),
  })
  .refine((value) => Object.prototype.hasOwnProperty.call(value, "result"), {
    message: "result is required",
  });
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export const jsonRpcErrorSchema = z.object({
  jsonrpc: z.literal("2.0").optional(),
  id: jsonRpcIdSchema,
  error: z.object({
    code: z.number().int(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});
export type JsonRpcError = z.infer<typeof jsonRpcErrorSchema>;

export const jsonRpcMessageSchema = z.union([
  jsonRpcRequestSchema,
  jsonRpcNotificationSchema,
  jsonRpcResponseSchema,
  jsonRpcErrorSchema,
]);
export type JsonRpcMessage = z.infer<typeof jsonRpcMessageSchema>;

/** Parse and validate a single line from the protocol channel. */
export function parseJsonRpcLine(line: string): JsonRpcMessage {
  return jsonRpcMessageSchema.parse(JSON.parse(line));
}

export function encodeJsonRpcMessage(message: JsonRpcMessage): string {
  return JSON.stringify(message);
}

export function isRequest(
  message: JsonRpcMessage,
): message is JsonRpcRequest {
  return "method" in message && "id" in message;
}

export function isNotification(
  message: JsonRpcMessage,
): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

export function isResponse(
  message: JsonRpcMessage,
): message is JsonRpcResponse | JsonRpcError {
  return "id" in message && !("method" in message);
}
