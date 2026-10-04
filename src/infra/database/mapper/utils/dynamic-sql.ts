import { SortDto, SortOrder } from '@common/dtos/sort.dto';
import { toSnake } from './to-camel';

export type Fragment = { frag: string; params: object } | null;

export function when(cond: unknown, frag: string, params: object = {}): Fragment {
  return cond ? { frag, params } : null;
}

export class DynamicSql {
  private readonly parts: string[] = [];
  private readonly params: Record<string, unknown> = {};

  private constructor(initial: string, params: object = {}) {
    this.parts.push(initial);
    Object.assign(this.params, params);
  }

  static of(initial: string, params: object = {}): DynamicSql {
    return new DynamicSql(initial, params);
  }

  append(frag: string, params: object = {}): this {
    this.parts.push(frag);
    Object.assign(this.params, params);
    return this;
  }

  appendIf(cond: unknown, frag: string, params: object = {}): this {
    if (cond) this.append(frag, params);
    return this;
  }

  private live(frags: Fragment[]): { frag: string; params: object }[] {
    return frags.filter((f): f is { frag: string; params: object } => f !== null);
  }

  where(frags: Fragment[]): this {
    const live = this.live(frags);
    if (live.length) {
      this.parts.push('WHERE ' + live.map((f) => f.frag).join(' AND '));
      for (const f of live) Object.assign(this.params, f.params);
    }
    return this;
  }

  set(frags: Fragment[]): this {
    const live = this.live(frags);
    if (live.length) {
      this.parts.push('SET ' + live.map((f) => f.frag).join(', '));
      for (const f of live) Object.assign(this.params, f.params);
    }
    return this;
  }

  orderBy(sort: SortDto | SortDto[] | undefined, allowed: string[]): this {
    const list = Array.isArray(sort) ? sort : sort ? [sort] : [];
    const cols = list
      .filter((s) => s.sortBy && allowed.includes(s.sortBy))
      .map((s) => `${toSnake(s.sortBy as string)} ${s.order === SortOrder.ASC ? 'ASC' : 'DESC'}`);
    if (cols.length) this.parts.push('ORDER BY ' + cols.join(', '));
    return this;
  }

  build(): { sql: string; params: object } {
    return { sql: this.parts.join(' '), params: this.params };
  }
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): DynamicSql {
  if (values.length) throw new Error('use #{} params, not interpolation');
  return DynamicSql.of(strings.join(''));
}
