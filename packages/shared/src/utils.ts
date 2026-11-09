/** Monotonic request-id generator for the JSON-RPC client. */
export function createRequestIdFactory(start = 1): () => number {
  let next = start;
  return () => next++;
}

export function now(): number {
  return Date.now();
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
