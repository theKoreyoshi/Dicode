import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import type { DicodeCore, SessionInfo } from "@dicode/core";
import { expect, it, vi } from "vitest";

const nativeKey = "dicode-native-fixture-key";
const customKey = "dicode-custom-fixture-key";
const accountKey = "dicode-native-account-fixture-key";
const fixtureAnswer = "Response from the local provider fixture";

interface RequestObservation {
  path: string;
  model: string;
  credential: "native" | "custom" | "none" | "unexpected";
}

async function respond(
  request: IncomingMessage,
  response: ServerResponse,
  requests: RequestObservation[],
  failCustomRequest: boolean,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const path = request.url ?? "";
  if (request.method !== "POST" || !/^\/(native|custom)\/v1\/responses$/u.test(path)) {
    response.writeHead(404).end();
    return;
  }
  const { model } = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { model: string };
  const authorization = request.headers.authorization;
  const credential = authorization === `Bearer ${nativeKey}` ? "native"
    : authorization === `Bearer ${customKey}` ? "custom"
    : authorization ? "unexpected" : "none";
  requests.push({ path, model, credential });
  if (failCustomRequest && path.startsWith("/custom/")) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: `Fixture rejected credential ${customKey}` } }));
    return;
  }

  const message = {
    id: `message-${requests.length}`, type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: fixtureAnswer, annotations: [] }],
  };
  const result = {
    id: `response-${requests.length}`, object: "response", model, created_at: 1,
    status: "completed", output: [message],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  };
  response.writeHead(200, { "content-type": "text/event-stream" });
  for (const event of [
    { type: "response.created", response: { ...result, status: "in_progress", output: [], usage: null } },
    { type: "response.output_item.added", output_index: 0, item: { ...message, status: "in_progress", content: [] } },
    { type: "response.output_text.delta", output_index: 0, item_id: message.id, content_index: 0, delta: fixtureAnswer },
    { type: "response.output_item.done", output_index: 0, item: message },
    { type: "response.completed", response: result },
  ]) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  response.end();
}

async function verifyTurn(core: DicodeCore, session: SessionInfo): Promise<void> {
  const task = await core.sendMessage(session.id, { text: "Reply briefly without calling tools." });
  await vi.waitFor(() => {
    expect(core.getTask(task.id)?.status).toBe("completed");
  }, { timeout: 15_000 });
  const assistantMessages = core.getMessages(session.id).filter((message) => message.role === "assistant");
  expect(assistantMessages.at(-1)?.content).toBe(fixtureAnswer);
}

it("selects and resets custom providers and restores a saved custom session with isolated credentials", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "dicode-custom-model-test-"));
  const codexHome = join(scratch, "codex");
  const projectPath = join(scratch, "project");
  const configDir = join(scratch, "config");
  const dataDir = join(scratch, "data");
  const logDir = join(scratch, "logs");
  const requests: RequestObservation[] = [];
  let failCustomRequest = false;
  const server = createServer((request, response) => {
    void respond(request, response, requests, failCustomRequest).catch(() => response.destroy());
  });
  let core: DicodeCore | undefined;
  try {
    await Promise.all([mkdir(codexHome), mkdir(projectPath)]);
    await new Promise<void>((ready, fail) => {
      server.once("error", fail);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", fail);
        ready();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture requires a TCP listener");
    const loopback = `http://127.0.0.1:${address.port}`;
    const nativeConfig = `model = "fixture-native-model"
model_provider = "fixture_native"
cli_auth_credentials_store = "file"
[analytics]
enabled = false
[model_providers.fixture_native]
name = "Native fixture"
base_url = "${loopback}/native/v1"
wire_api = "responses"
env_key = "DICODE_NATIVE_FIXTURE_KEY"
requires_openai_auth = false
`;
    const nativeConfigPath = join(codexHome, "config.toml");
    await writeFile(nativeConfigPath, nativeConfig);
    await writeFile(join(codexHome, "auth.json"), JSON.stringify({ OPENAI_API_KEY: accountKey }));

    // The adapter's default logger also uses APPDATA. Keep it within the fixture.
    vi.stubEnv("APPDATA", scratch);
    const { CodexClient, Logger, resolveCodexExecutable } = await import("@dicode/codex-adapter");
    const { createDicodeCore } = await import("@dicode/core");
    const executablePath = resolveCodexExecutable(undefined, resolve("release", "runtime", "codex"));
    const systemEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(SystemRoot|SystemDrive|WINDIR|ComSpec|PATH|PATHEXT)$/iu.test(key)));
    async function startCore(): Promise<DicodeCore> {
      const client = new CodexClient({
        config: {
          executablePath, cwd: projectPath, args: ["app-server", "--listen", "stdio://"],
          env: {
            ...systemEnvironment, CODEX_HOME: codexHome, APPDATA: scratch, LOCALAPPDATA: scratch,
            TEMP: scratch, TMP: scratch, NO_PROXY: "127.0.0.1,localhost",
            OPENAI_API_KEY: accountKey, DICODE_NATIVE_FIXTURE_KEY: nativeKey, DICODE_CUSTOM_FIXTURE_KEY: customKey,
          },
        },
        logger: new Logger({ logDir, level: "debug" }),
      });
      const instance = createDicodeCore({ configDir, dataDir, adapter: client });
      core = instance;
      await instance.initialize();
      instance.openProject(projectPath);
      return instance;
    }

    const native = { path: "/native/v1/responses", model: "fixture-native-model", credential: "native" };
    const custom = { path: "/custom/v1/responses", model: "fixture-custom-model", credential: "custom" };
    const model = { model: custom.model, baseUrl: `${loopback}/custom/v1`, apiKeyEnv: "DICODE_CUSTOM_FIXTURE_KEY" };
    core = await startCore();
    await verifyTurn(core, await core.createSession({ projectPath }));
    core.saveCustomModel(model);
    const selected = await core.createSession({ projectPath });
    expect(selected.customModel).toEqual(model);
    await verifyTurn(core, selected);

    core.saveCustomModel(null);
    await verifyTurn(core, await core.createSession({ projectPath }));
    await core.shutdown();
    core = await startCore();
    const resumed = await core.resumeSession(selected.id);
    expect(resumed.codexThreadId).toBe(selected.codexThreadId);
    await verifyTurn(core, resumed);

    failCustomRequest = true;
    const failed = await core.sendMessage(resumed.id, { text: "Verify a provider error is redacted." });
    await vi.waitFor(() => {
      expect(core?.getTask(failed.id)?.status).toBe("failed");
    }, { timeout: 15_000 });
    expect(core.getTask(failed.id)?.error).toMatch(/Fixture rejected credential \[redacted\]/iu);
    failCustomRequest = false;

    core.saveCustomModel({ model: model.model, baseUrl: model.baseUrl });
    await verifyTurn(core, await core.createSession({ projectPath }));
    expect(requests).toEqual([native, custom, native, custom, custom, { ...custom, credential: "none" }]);

    await core.shutdown();
    expect(await readFile(nativeConfigPath, "utf8")).toBe(nativeConfig);
    for (const path of [join(configDir, "config.json"), join(dataDir, "dicode.db"), join(logDir, "adapter.log")]) {
      const contents = await readFile(path);
      expect([nativeKey, customKey, accountKey].some((key) => contents.includes(key))).toBe(false);
    }
  } finally {
    await core?.shutdown().catch(() => undefined);
    await new Promise<void>((closed) => { server.close(() => closed()); });
    vi.unstubAllEnvs();
    if (resolve(scratch).startsWith(resolve(tmpdir()) + sep) && basename(scratch).startsWith("dicode-custom-model-test-")) {
      await rm(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    }
  }
}, 90_000);
