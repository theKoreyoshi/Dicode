import { statSync } from "node:fs";
import { resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { CodexClient, resolveProcessConfig } from "@dicode/codex-adapter";

const settings = [
  ["Model", "model"],
  ["Provider", "model_provider"],
  ["Reasoning effort", "model_reasoning_effort"],
  ["Sandbox", "sandbox_mode"],
  ["Approval policy", "approval_policy"],
] as const;

export async function inspectRuntime(action: "config" | "mcp" | "skills", projectPath?: string): Promise<void> {
  let client: CodexClient | undefined;
  try {
    const cwd = resolve(projectPath ?? process.cwd());
    if (!statSync(cwd).isDirectory()) throw new Error(`Not a project directory: ${cwd}`);
    client = new CodexClient({ config: resolveProcessConfig({ cwd }) });
    await client.start();

    const lines: string[] = [];
    if (action === "config") {
      const config = await client.readEffectiveConfig(cwd);
      lines.push(...settings.map(([label, key]) => `${label}: ${display(config[key])}`));
    } else if (action === "skills") {
      const skills = await client.listSkills(cwd);
      for (const skill of skills) {
        lines.push(`${display(skill.name)}  ${display(skill.scope)}  ${skill.enabled ? "enabled" : "disabled"}`);
      }
      if (lines.length === 0) lines.push("No skills reported for this project.");
    } else {
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const page = await client.listMcpServerStatus(cursor);
        for (const server of page.data) {
          lines.push(`${display(server.name)}  ${display(server.authStatus)}  ${Object.keys(server.tools).length} tools`);
        }
        cursor = page.nextCursor;
        if (cursor === null || seen.has(cursor)) break;
        seen.add(cursor);
      } while (cursor);
      if (lines.length === 0) lines.push("No MCP servers reported.");
    }
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Could not inspect Codex."}\n`);
    process.exitCode = 1;
  } finally {
    await client?.stop().catch(() => undefined);
  }
}

function display(value: unknown): string {
  if (value == null) return "Codex default";
  if (typeof value === "object") return JSON.stringify(value);
  return stripVTControlCharacters(String(value)).replace(/\s+/gu, " ");
}
