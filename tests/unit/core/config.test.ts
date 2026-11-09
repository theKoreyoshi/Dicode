import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigManager } from "@dicode/core";

const dirs: string[] = [];

function configPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dicode-cfg-"));
  dirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe("ConfigManager", () => {
  it("creates defaults when no file exists", () => {
    const manager = new ConfigManager({ configPath: configPath() });
    const config = manager.load();
    expect(config.ui.theme).toBe("dicode-blue");
    expect(config.agent.maxConcurrentSessions).toBe(3);
  });

  it("merges user values over defaults", () => {
    const path = configPath();
    writeFileSync(path, JSON.stringify({ version: 1, ui: { theme: "dark" }, agent: { maxConcurrentSessions: 5 } }), "utf8");
    const manager = new ConfigManager({ configPath: path });
    const config = manager.load();
    expect(config.ui.theme).toBe("dark");
    expect(config.ui.compactMode).toBe(false);
    expect(config.agent.maxConcurrentSessions).toBe(5);
  });

  it("updates and persists a partial patch", () => {
    const path = configPath();
    const manager = new ConfigManager({ configPath: path });
    manager.load();
    manager.update({ agent: { defaultModel: "deepseek-v4-pro" } });
    const reloaded = new ConfigManager({ configPath: path }).load();
    expect(reloaded.agent.defaultModel).toBe("deepseek-v4-pro");
  });

  it("recovers from a corrupt config file", () => {
    const path = configPath();
    writeFileSync(path, "{ not valid json", "utf8");
    const manager = new ConfigManager({ configPath: path });
    expect(() => manager.load()).toThrow();
    expect(manager.get().ui.theme).toBe("dicode-blue");
  });
});
