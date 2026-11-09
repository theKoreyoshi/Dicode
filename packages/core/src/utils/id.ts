import { randomUUID } from "node:crypto";

/** Generates a UUIDv4 for Dicode-managed business objects (not Codex ids). */
export function createId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}
