import { CodexClient } from "@dicode/codex-adapter";

export async function login(): Promise<void> {
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error("Codex sign-in cancelled."));
  const timeout = setTimeout(() => controller.abort(new Error("Codex sign-in timed out.")), 5 * 60_000);
  let client: CodexClient | undefined;
  process.once("SIGINT", interrupt);
  try {
    client = new CodexClient();
    await client.start();
    await client.loginWithChatGpt((url) => {
      process.stdout.write(`Open this link in your browser to sign in to Codex:\n${url}\n\nWaiting for sign-in. Press Ctrl+C to cancel.\n`);
    }, controller.signal);
    process.stdout.write("Signed in to Codex. Run dicode to start.\n");
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Codex sign-in failed."}\n`);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    process.off("SIGINT", interrupt);
    await client?.stop().catch(() => undefined);
  }
}
