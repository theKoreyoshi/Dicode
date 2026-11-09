export function nowMs(): number {
  return Date.now();
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
