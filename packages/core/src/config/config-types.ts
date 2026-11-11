import type { CustomModelConfig } from "@dicode/codex-adapter";

export type { CustomModelConfig };

export interface UiConfig {
  theme: string;
  showToolOutput: boolean;
  compactMode: boolean;
}

export interface AgentConfig {
  defaultModel: string | null;
  customModel: CustomModelConfig | null;
  reasoningEffort: string | null;
  permissionMode: "default" | "full";
  maxConcurrentSessions: number;
}

export interface RuntimeConfig {
  codexPath: string | null;
  startupTimeout: number;
  requestTimeout: number;
}

export interface StorageConfig {
  dataDirectory: string | null;
}

export interface LoggingConfig {
  level: string;
  maxFileSize: number;
}

export interface DicodeConfig {
  version: number;
  ui: UiConfig;
  agent: AgentConfig;
  runtime: RuntimeConfig;
  storage: StorageConfig;
  logging: LoggingConfig;
}

export type DicodeConfigPatch = {
  ui?: Partial<UiConfig>;
  agent?: Partial<AgentConfig>;
  runtime?: Partial<RuntimeConfig>;
  storage?: Partial<StorageConfig>;
  logging?: Partial<LoggingConfig>;
};
