import { describe, expect, it } from "vitest";
import {
  PRODUCT_NAME,
  PRODUCT_VERSION,
  createRequestIdFactory,
  encodeJsonRpcMessage,
  isNotification,
  isRequest,
  isResponse,
  parseJsonRpcLine,
  safeJsonParse,
} from "@dicode/shared";

describe("brand constants", () => {
  it("exposes the product identity", () => {
    expect(PRODUCT_NAME).toBe("Dicode");
    expect(PRODUCT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("JSON-RPC primitives", () => {
  it("round-trips a request frame", () => {
    const frame = { jsonrpc: "2.0", id: 7, method: "initialize", params: {} } as const;
    const parsed = parseJsonRpcLine(encodeJsonRpcMessage(frame));
    expect(isRequest(parsed)).toBe(true);
    if (isRequest(parsed)) {
      expect(parsed.id).toBe(7);
      expect(parsed.method).toBe("initialize");
    }
  });

  it("distinguishes notification, response, and error frames", () => {
    expect(isNotification(parseJsonRpcLine('{"method":"initialized"}'))).toBe(true);
    expect(isResponse(parseJsonRpcLine('{"id":1,"result":{"ok":true}}'))).toBe(true);
    expect(isResponse(parseJsonRpcLine('{"id":1,"error":{"code":-1,"message":"x"}}'))).toBe(true);
  });

  it("rejects a malformed frame", () => {
    expect(() => parseJsonRpcLine('{"id":1}')).toThrow();
  });
});

describe("utils", () => {
  it("produces a monotonic request-id sequence", () => {
    const next = createRequestIdFactory(5);
    expect([next(), next(), next()]).toEqual([5, 6, 7]);
  });

  it("returns null for invalid JSON", () => {
    expect(safeJsonParse("{not json")).toBeNull();
  });
});
