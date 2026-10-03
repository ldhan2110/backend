import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function parseSqlFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = content.split(/--\s*name:\s*/).slice(1); // discard preamble before first marker
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const name = block.slice(0, nl).trim();
    const sql = block
      .slice(nl + 1)
      .trim()
      .replace(/;\s*$/, '');
    out[name] = sql;
  }
  return out;
}

@Injectable()
export class SqlStore {
  private readonly map = new Map<string, string>();

  load(root: string): void {
    const entries = readdirSync(root, { recursive: true, encoding: 'utf8' });
    for (const rel of entries) {
      if (!rel.endsWith('.sql') || rel.includes('node_modules')) continue;
      const ns = basename(rel, '.sql');
      const content = readFileSync(join(root, rel), 'utf8');
      for (const [name, sql] of Object.entries(parseSqlFile(content))) {
        this.map.set(`${ns}.${name}`, sql);
      }
    }
  }

  get(name: string): string {
    const sql = this.map.get(name);
    if (!sql) throw new Error(`SQL not found: ${name}`);
    return sql;
  }
}
