import { describe, expect, it } from "vitest";
import { parseCommand, findCommand, formatHelp } from "@dicode/tui";

describe("Slash commands", () => {
  it("parses a leading slash command", () => {
    expect(parseCommand("/help")).toEqual({ command: "help", args: "" });
    expect(parseCommand("/model deepseek-v4-pro")).toEqual({ command: "model", args: "deepseek-v4-pro" });
  });

  it("returns null for ordinary input", () => {
    expect(parseCommand("hello world")).toBeNull();
  });

  it("resolves aliases", () => {
    expect(findCommand("q")?.name).toBe("quit");
    expect(findCommand("exit")?.name).toBe("quit");
  });

  it("formats help", () => {
    expect(formatHelp()).toContain("/help");
    expect(formatHelp()).toContain("/model");
  });
});
