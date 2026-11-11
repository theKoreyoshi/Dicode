import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { Logger, StdioTransport } from "@dicode/codex-adapter";

describe("StdioTransport custom provider diagnostics", () => {
  it("redacts reflected bearer values in failures and leaves normal output intact", () => {
    const providerSecret = "fixture-credential-value";
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const logger = new Logger({ level: "debug" });
    const debug = vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    const transport = new StdioTransport({ stdin, stdout, stderr, logger, providerSecret });
    const handle = vi.fn();
    transport.onMessage(handle);
    const push = (frame: unknown) => stdout.write(`${JSON.stringify(frame)}\n`);

    push({ id: 1, error: { code: -32600, message: `Rejected ${providerSecret}`, data: { reason: providerSecret } } });
    push({ method: "error", params: { error: { message: providerSecret }, willRetry: false } });
    push({ method: "turn/completed", params: { turn: { status: "failed", error: { message: providerSecret } } } });
    push({ method: "item/agentMessage/delta", params: { delta: providerSecret } });
    stderr.write(providerSecret.slice(0, 9));
    stderr.write(providerSecret.slice(9));

    expect(handle.mock.calls).toEqual([
      [{ id: 1, error: { code: -32600, message: "Rejected [redacted]", data: { reason: "[redacted]" } } }],
      [{ method: "error", params: { error: { message: "[redacted]" }, willRetry: false } }],
      [{ method: "turn/completed", params: { turn: { status: "failed", error: { message: "[redacted]" } } } }],
      [{ method: "item/agentMessage/delta", params: { delta: providerSecret } }],
    ]);
    expect(debug).not.toHaveBeenCalled();
    transport.close();
    stdin.end();
    stdout.end();
    stderr.end();
  });
});
