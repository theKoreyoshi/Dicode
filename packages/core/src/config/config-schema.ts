import { z } from "zod";

const uiSchema = z.object({
  theme: z.string().default("dicode-blue"),
  showToolOutput: z.boolean().default(true),
  compactMode: z.boolean().default(false),
});

const agentSchema = z.object({
  defaultModel: z.string().nullable().default(null),
  reasoningEffort: z.string().nullable().default(null),
  maxConcurrentSessions: z.number().int().positive().default(3),
});

const runtimeSchema = z.object({
  codexPath: z.string().nullable().default(null),
  startupTimeout: z.number().int().positive().default(30_000),
  requestTimeout: z.number().int().positive().default(60_000),
});

const storageSchema = z.object({
  dataDirectory: z.string().nullable().default(null),
});

const loggingSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  maxFileSize: z.number().int().positive().default(10 * 1024 * 1024),
});

export const dicodeConfigSchema = z.object({
  version: z.number().int().default(1),
  ui: uiSchema,
  agent: agentSchema,
  runtime: runtimeSchema,
  storage: storageSchema,
  logging: loggingSchema,
});
