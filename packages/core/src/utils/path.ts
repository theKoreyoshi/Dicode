import { isAbsolute, resolve, sep } from "node:path";

/** Normalizes a path for stable comparison/storage (forward slashes, lowercased). */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function toAbsolutePath(path: string): string {
  return resolve(path);
}

export function isAbsolutePath(path: string): boolean {
  return isAbsolute(path);
}

/** Case-insensitive, separator-normalized path equality (Windows-friendly). */
export function pathsEqual(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

export function joinPath(base: string, ...parts: string[]): string {
  return [base, ...parts].join(sep);
}
