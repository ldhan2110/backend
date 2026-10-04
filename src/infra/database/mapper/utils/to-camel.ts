export function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

export function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[toCamel(k)] = row[k];
  return out;
}
