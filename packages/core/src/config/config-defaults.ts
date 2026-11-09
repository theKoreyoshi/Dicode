import type { DicodeConfig } from "./config-types.js";

export const CONFIG_VERSION = 1;

export function defaultConfig(): DicodeConfig {
  return {
    version: CONFIG_VERSION,
    ui: {
      theme: "dicode-blue",
      showToolOutput: true,
      compactMode: false,
    },
    agent: {
      defaultModel: null,
      reasoningEffort: null,
      maxConcurrentSessions: 3,
    },
    runtime: {
      codexPath: null,
      startupTimeout: 30_000,
      requestTimeout: 60_000,
    },
    storage: {
      dataDirectory: null,
    },
    logging: {
      level: "info",
      maxFileSize: 10 * 1024 * 1024,
    },
  };
}
