import { createHash } from "node:crypto";

export interface CustomModelConfig {
  model: string;
  baseUrl: string;
  apiKeyEnv?: string;
}

export function sameCustomModel(left?: CustomModelConfig, right?: CustomModelConfig): boolean {
  return left?.model === right?.model && left?.baseUrl === right?.baseUrl && left?.apiKeyEnv === right?.apiKeyEnv;
}

export function customProviderId(config: CustomModelConfig): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([config.baseUrl, config.apiKeyEnv ?? null]))
    .digest("hex")
    .slice(0, 16);
  return `dicode_custom_${digest}`;
}

export function customModelArguments(config: CustomModelConfig): string[] {
  const provider = customProviderId(config);
  const fields = [
    'name = "Dicode custom provider"',
    `base_url = ${JSON.stringify(config.baseUrl)}`,
    'wire_api = "responses"',
    "requires_openai_auth = false",
  ];
  if (config.apiKeyEnv) fields.push(`env_key = ${JSON.stringify(config.apiKeyEnv)}`);
  return [
    "-c", `model_provider = "${provider}"`,
    "-c", `model = ${JSON.stringify(config.model)}`,
    "-c", `model_providers.${provider} = { ${fields.join(", ")} }`,
  ];
}
