import { z } from "zod";

export const customModelConfigSchema = z.object({
  model: z.string().trim().min(1, "Enter a model ID.").max(256, "The model ID is too long.")
    .regex(/^[^\u0000-\u001f\u007f]+$/u, "The model ID contains an invalid character."),
  baseUrl: z.string().trim().max(2048, "The base URL is too long."),
  apiKeyEnv: z.string().trim().max(128, "The environment variable name is too long.")
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u, "Enter an environment variable name, such as GATEWAY_API_KEY.").optional(),
}).transform((value, context) => {
  let url: URL;
  try {
    url = new URL(value.baseUrl);
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid HTTP or HTTPS base URL." });
    return z.NEVER;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    context.addIssue({ code: "custom", message: "Enter a valid HTTP or HTTPS base URL." });
    return z.NEVER;
  }
  if (url.username || url.password || /[?#]/u.test(value.baseUrl)) {
    context.addIssue({ code: "custom", message: "The base URL must omit credentials, query parameters, and fragments." });
    return z.NEVER;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (value.apiKeyEnv && !local && url.protocol !== "https:") {
    context.addIssue({ code: "custom", message: "Use HTTPS with an API key outside localhost." });
    return z.NEVER;
  }
  return { ...value, baseUrl: url.href.replace(/\/$/u, "") };
});

const uiSchema = z.object({
  theme: z.string().default("dicode-blue"),
  showToolOutput: z.boolean().default(true),
  compactMode: z.boolean().default(false),
});

const agentSchema = z.object({
  defaultModel: z.string().nullable().default(null),
  customModel: customModelConfigSchema.nullable().default(null),
  reasoningEffort: z.string().nullable().default(null),
  permissionMode: z.enum(["default", "full"]).default("default"),
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
