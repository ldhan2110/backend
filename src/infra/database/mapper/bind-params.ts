interface CompiledSql {
  text: string;
  paramNames: string[];
}

const cache = new Map<string, CompiledSql>();

function compile(sql: string): CompiledSql {
  const cached = cache.get(sql);
  if (cached) return cached;

  const paramNames: string[] = [];
  const text = sql.replace(/#\{(\w+)\}/g, (_, name: string) => {
    paramNames.push(name);
    return `$${paramNames.length}`;
  });
  const compiled = { text, paramNames };
  cache.set(sql, compiled);
  return compiled;
}

export function bind(
  sql: string,
  params: Record<string, unknown> = {},
): { text: string; values: unknown[] } {
  const { text, paramNames } = compile(sql);
  const values = paramNames.map((n) => {
    if (!(n in params)) throw new Error(`Missing SQL param: ${n}`);
    return params[n];
  });
  return { text, values };
}
