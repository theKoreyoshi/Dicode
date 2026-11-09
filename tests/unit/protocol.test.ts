import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ClientMethods,
  ClientNotificationMethods,
  ServerNotificationMethods,
  ServerRequestMethods,
} from "@dicode/codex-adapter";

const SCHEMA_DIR = join(process.cwd(), "schemas", "codex-app-server");

function methodNames(schemaFile: string): string[] {
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, schemaFile), "utf8"));
  return (schema.oneOf ?? [])
    .map((entry: { properties?: { method?: { enum?: string[]; const?: string } } }) => {
      const method = entry.properties?.method;
      return method?.enum?.[0] ?? method?.const ?? undefined;
    })
    .filter((name: unknown): name is string => typeof name === "string");
}

function expectEvery(constants: Record<string, string>, present: string[]): void {
  for (const [key, method] of Object.entries(constants)) {
    expect(present, `missing method "${key}" -> "${method}"`).toContain(method);
  }
}

describe("protocol registry matches the generated schema", () => {
  it("client request methods exist in ClientRequest.json", () => {
    expectEvery(ClientMethods, methodNames("ClientRequest.json"));
  });

  it("client notification methods exist in ClientNotification.json", () => {
    expectEvery(ClientNotificationMethods, methodNames("ClientNotification.json"));
  });

  it("server request methods exist in ServerRequest.json", () => {
    expectEvery(ServerRequestMethods, methodNames("ServerRequest.json"));
  });

  it("server notification methods exist in ServerNotification.json", () => {
    expectEvery(ServerNotificationMethods, methodNames("ServerNotification.json"));
  });
});
