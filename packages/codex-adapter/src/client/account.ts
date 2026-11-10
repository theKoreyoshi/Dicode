import { ClientMethods, ServerNotificationMethods } from "../protocol.js";
import type { JsonRpcClient } from "../transport/jsonrpc-client.js";

export interface CodexAccountStatus {
  account: { type: string } | null;
  requiresOpenaiAuth: boolean;
}

interface LoginCompletion {
  loginId: string;
  success: boolean;
}

export async function loginWithBrowser(rpc: JsonRpcClient, showUrl: (url: string) => void, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  let loginId: string | undefined;
  let finished = false;
  const early = new Map<string, boolean>();
  let settle!: (success: boolean) => void;
  const result = new Promise<boolean>((resolve) => { settle = resolve; });
  let cancel!: (reason: Error) => void;
  const cancellation = new Promise<never>((_, reject) => { cancel = reject; });
  const onAbort = () => {
    cancel(signal.reason instanceof Error ? signal.reason : new Error("Codex sign-in cancelled."));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const stop = rpc.onNotification((method, params) => {
    if (method !== ServerNotificationMethods.accountLoginCompleted) return;
    const event = params as Partial<LoginCompletion> | null;
    if (typeof event?.loginId !== "string" || typeof event.success !== "boolean") return;
    if (loginId === event.loginId) settle(event.success);
    else if (loginId === undefined) early.set(event.loginId, event.success);
  });

  try {
    const response = await Promise.race([
      rpc.request(ClientMethods.accountLoginStart, { type: "chatgpt" }),
      cancellation,
    ]) as {
      type?: string;
      loginId?: string;
      authUrl?: string;
    } | null;
    loginId = response?.loginId;
    if (response?.type !== "chatgpt" || !loginId || !response.authUrl) {
      throw new Error("Codex did not return a browser sign-in request.");
    }
    signal.throwIfAborted();
    const previous = early.get(loginId);
    if (previous !== undefined) settle(previous);
    else {
      const url = new URL(response.authUrl);
      if (url.protocol !== "https:") throw new Error("Codex returned an invalid sign-in URL.");
      showUrl(url.href);
    }
    const success = await Promise.race([result, cancellation]);
    finished = true;
    if (!success) throw new Error("Codex sign-in failed. Run dicode login to try again.");
  } finally {
    stop();
    signal.removeEventListener("abort", onAbort);
    if (loginId && !finished) {
      await rpc.request(ClientMethods.accountLoginCancel, { loginId }, 2000).catch(() => undefined);
    }
  }
}
