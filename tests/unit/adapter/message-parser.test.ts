import { describe, expect, it } from "vitest";
import { LineFramer } from "@dicode/codex-adapter";

function collect(): { lines: string[]; errors: Error[]; framer: LineFramer } {
  const lines: string[] = [];
  const errors: Error[] = [];
  const framer = new LineFramer({
    onLine: (line) => lines.push(line),
    onError: (error) => errors.push(error),
  });
  return { lines, errors, framer };
}

describe("LineFramer", () => {
  it("emits a complete line", () => {
    const { lines, framer } = collect();
    framer.push('{"id":1}\n');
    expect(lines).toEqual(['{"id":1}']);
  });

  it("emits multiple lines from a single chunk", () => {
    const { lines, framer } = collect();
    framer.push('{"a":1}\n{"b":2}\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("reassembles a line split across chunks", () => {
    const { lines, framer } = collect();
    framer.push('{"hel');
    framer.push('lo": "wor');
    framer.push('ld"}\n');
    expect(lines).toEqual(['{"hello": "world"}']);
  });

  it("skips empty lines and strips CR", () => {
    const { lines, framer } = collect();
    framer.push('\r\n{"a":1}\r\n\n');
    expect(lines).toEqual(['{"a":1}']);
  });

  it("reports an error when a line exceeds the limit", () => {
    const errors: Error[] = [];
    const framer = new LineFramer({
      maxLineBytes: 5,
      onLine: () => {},
      onError: (error) => errors.push(error),
    });
    framer.push("123456789");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("maximum size");
  });

  it("resets its buffer", () => {
    const { lines, framer } = collect();
    framer.push('{"partial"');
    framer.reset();
    framer.push('{"done":1}\n');
    expect(lines).toEqual(['{"done":1}']);
  });
});
