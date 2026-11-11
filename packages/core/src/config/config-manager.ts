import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ConfigError } from "../errors/core-errors.js";
import { defaultConfig } from "./config-defaults.js";
import { dicodeConfigSchema } from "./config-schema.js";
import type { DicodeConfig, DicodeConfigPatch } from "./config-types.js";

export interface ConfigManagerOptions {
  configPath?: string;
}

export class ConfigManager {
  private readonly configPath: string;
  private config: DicodeConfig;

  constructor(options: ConfigManagerOptions = {}) {
    this.configPath = options.configPath ?? defaultConfigPath();
    this.config = defaultConfig();
  }

  load(): DicodeConfig {
    if (!existsSync(this.configPath)) {
      this.config = defaultConfig();
      this.persist(this.config);
      return this.config;
    }

    try {
      const raw = readFileSync(this.configPath, "utf8");
      const merged = mergeRawWithDefaults(JSON.parse(raw));
      const parsed = dicodeConfigSchema.parse(merged);
      this.config = parsed;
      return this.config;
    } catch (error) {
      // Corrupt or invalid config: preserve the broken file, fall back to defaults.
      try {
        renameSync(this.configPath, `${this.configPath}.corrupt-${Date.now()}`);
      } catch {
        // ignore
      }
      this.config = defaultConfig();
      this.persist(this.config);
      throw new ConfigError("configuration was invalid and has been reset to defaults", { cause: error });
    }
  }

  get(): DicodeConfig {
    return this.config;
  }

  update(patch: DicodeConfigPatch): DicodeConfig {
    const merged = deepMerge(this.config, patch) as DicodeConfig;
    const validated = dicodeConfigSchema.parse(merged);
    const config = { ...defaultConfig(), ...validated } as DicodeConfig;
    this.persist(config);
    this.config = config;
    return this.config;
  }

  get path(): string {
    return this.configPath;
  }

  private persist(config: DicodeConfig): void {
    try {
      mkdirSync(dirname(this.configPath), { recursive: true });
      const tmp = `${this.configPath}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      renameSync(tmp, this.configPath);
    } catch (error) {
      throw new ConfigError("failed to write configuration", { cause: error });
    }
  }
}

function defaultConfigPath(): string {
  const base = process.env.APPDATA ?? process.env.LOCALAPPDATA ?? process.cwd();
  return join(base, "Dicode", "config", "config.json");
}

function deepMerge(base: DicodeConfig, patch: DicodeConfigPatch): DicodeConfig {
  return {
    version: base.version,
    ui: { ...base.ui, ...(patch.ui ?? {}) },
    agent: { ...base.agent, ...(patch.agent ?? {}) },
    runtime: { ...base.runtime, ...(patch.runtime ?? {}) },
    storage: { ...base.storage, ...(patch.storage ?? {}) },
    logging: { ...base.logging, ...(patch.logging ?? {}) },
  };
}

function mergeRawWithDefaults(raw: unknown): DicodeConfig {
  const defaults = defaultConfig();
  const partial = (raw ?? {}) as Record<string, unknown>;
  const section = (key: string) => (partial[key] && typeof partial[key] === "object" ? (partial[key] as object) : {});
  return {
    version: typeof partial.version === "number" ? partial.version : defaults.version,
    ui: { ...defaults.ui, ...section("ui") },
    agent: { ...defaults.agent, ...section("agent") },
    runtime: { ...defaults.runtime, ...section("runtime") },
    storage: { ...defaults.storage, ...section("storage") },
    logging: { ...defaults.logging, ...section("logging") },
  };
}
