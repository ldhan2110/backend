# SQL Mapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A MyBatis-style SQL mapper for the NestJS backend — write raw SQL, bind `#{name}` params safely, auto-map rows to typed DTOs, with dynamic fragments, `.sql` files, pagination, and allow-listed sort.

**Architecture:** Pure functions (param bind, case conversion) at the base; a `SqlStore` that loads `.sql` files once at boot; a chainable `DynamicSql` builder for dynamic fragments; one injectable `SqlMapper` facade wrapping TypeORM `DataSource.query()`. Built bottom-up so each layer is unit-tested without a database.

**Tech Stack:** NestJS, TypeORM (`DataSource.query`), class-transformer (`plainToInstance`), Jest 30 + ts-jest.

## Global Constraints

- TypeScript strict; `experimentalDecorators` + `emitDecoratorMetadata` on; target ES2023; module nodenext.
- Test command: `npm test -- <path>` (Jest, `testRegex .*\.spec\.ts$`, specs co-located next to source).
- All SQL values bound as params — **never** string-interpolated. Identifiers (ORDER BY columns) handled only via allow-list.
- Mapping default = loose (`plainToInstance`, copy-all); snake_case→camelCase on top-level row keys only.
- Reuse existing `PaginationDto` (`src/common/dtos/pagination.dto.ts`, has `page`, `limit`, `offset` getter) and `SortDto`/`SortOrder` (`src/common/dtos/sort.dto.ts`).
- All new code under `src/common/database/`.

---

### Task 1: Case conversion (pure)

**Files:**
- Create: `src/common/database/to-camel.ts`
- Test: `src/common/database/to-camel.spec.ts`

**Interfaces:**
- Produces: `toCamel(key: string): string`, `toSnake(key: string): string`, `rowToCamel(row: Record<string, unknown>): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

```ts
// src/common/database/to-camel.spec.ts
import { toCamel, toSnake, rowToCamel } from './to-camel';

describe('case conversion', () => {
  it('toCamel converts snake_case', () => {
    expect(toCamel('created_at')).toBe('createdAt');
    expect(toCamel('updated_by')).toBe('updatedBy');
  });
  it('toCamel leaves camelCase untouched', () => {
    expect(toCamel('email')).toBe('email');
    expect(toCamel('createdAt')).toBe('createdAt');
  });
  it('toSnake converts camelCase', () => {
    expect(toSnake('createdAt')).toBe('created_at');
    expect(toSnake('email')).toBe('email');
  });
  it('rowToCamel converts all top-level keys', () => {
    expect(rowToCamel({ id: 1, created_at: 'x', role_name: 'admin' }))
      .toEqual({ id: 1, createdAt: 'x', roleName: 'admin' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/common/database/to-camel.spec.ts`
Expected: FAIL — cannot find module `./to-camel`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/common/database/to-camel.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/common/database/to-camel.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/common/database/to-camel.ts src/common/database/to-camel.spec.ts
git commit -m "feat(db): snake/camel case conversion helpers"
```

---

### Task 2: Param binding `#{name}` → `$n` (pure, cached)

**Files:**
- Create: `src/common/database/bind-params.ts`
- Test: `src/common/database/bind-params.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `bind(sql: string, params?: Record<string, unknown>): { text: string; values: unknown[] }`

- [ ] **Step 1: Write the failing test**

```ts
// src/common/database/bind-params.spec.ts
import { bind } from './bind-params';

describe('bind', () => {
  it('rewrites a single param', () => {
    expect(bind('WHERE id = #{id}', { id: 5 }))
      .toEqual({ text: 'WHERE id = $1', values: [5] });
  });
  it('rewrites multiple params in order', () => {
    expect(bind('a = #{a} AND b = #{b}', { a: 1, b: 2 }))
      .toEqual({ text: 'a = $1 AND b = $2', values: [1, 2] });
  });
  it('repeats value for a repeated name', () => {
    expect(bind('a = #{x} OR b = #{x}', { x: 7 }))
      .toEqual({ text: 'a = $1 OR b = $2', values: [7, 7] });
  });
  it('throws on a missing key', () => {
    expect(() => bind('id = #{id}', {})).toThrow('Missing SQL param: id');
  });
  it('handles no params', () => {
    expect(bind('SELECT 1', {})).toEqual({ text: 'SELECT 1', values: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/common/database/bind-params.spec.ts`
Expected: FAIL — cannot find module `./bind-params`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/common/database/bind-params.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/common/database/bind-params.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/common/database/bind-params.ts src/common/database/bind-params.spec.ts
git commit -m "feat(db): #{name} to \$n param binding with compile cache"
```

---

### Task 3: `.sql` file parsing + `SqlStore` loader

**Files:**
- Create: `src/common/database/sql-store.ts`
- Test: `src/common/database/sql-store.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseSqlFile(content: string): Record<string, string>`; class `SqlStore` with `load(root: string): void` and `get(name: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/common/database/sql-store.spec.ts
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSqlFile, SqlStore } from './sql-store';

describe('parseSqlFile', () => {
  it('splits multiple named statements and strips trailing semicolons', () => {
    const content = [
      '-- name: findById',
      'SELECT * FROM users WHERE id = #{id};',
      '',
      '-- name: countAll',
      'SELECT count(*) FROM users;',
    ].join('\n');
    expect(parseSqlFile(content)).toEqual({
      findById: 'SELECT * FROM users WHERE id = #{id}',
      countAll: 'SELECT count(*) FROM users',
    });
  });
});

describe('SqlStore', () => {
  it('loads files, namespaces by filename, resolves by key', () => {
    const root = mkdtempSync(join(tmpdir(), 'sqlstore-'));
    mkdirSync(join(root, 'modules'), { recursive: true });
    writeFileSync(
      join(root, 'modules', 'user.sql'),
      '-- name: findById\nSELECT * FROM users WHERE id = #{id};\n',
    );
    const store = new SqlStore();
    store.load(root);
    expect(store.get('user.findById')).toBe('SELECT * FROM users WHERE id = #{id}');
  });

  it('throws on a missing statement', () => {
    const store = new SqlStore();
    expect(() => store.get('nope.missing')).toThrow('SQL not found: nope.missing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/common/database/sql-store.spec.ts`
Expected: FAIL — cannot find module `./sql-store`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/common/database/sql-store.ts
import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function parseSqlFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = content.split(/--\s*name:\s*/).slice(1); // discard preamble before first marker
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const name = block.slice(0, nl).trim();
    const sql = block.slice(nl + 1).trim().replace(/;\s*$/, '');
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/common/database/sql-store.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/common/database/sql-store.ts src/common/database/sql-store.spec.ts
git commit -m "feat(db): .sql file parser and SqlStore loader"
```

---

### Task 4: `DynamicSql` builder + `when()`

**Files:**
- Create: `src/common/database/dynamic-sql.ts`
- Test: `src/common/database/dynamic-sql.spec.ts`

**Interfaces:**
- Consumes: `toSnake` (Task 1); `SortDto`, `SortOrder` from `src/common/dtos/sort.dto.ts`.
- Produces:
  - `type Fragment = { frag: string; params: object } | null`
  - `when(cond: unknown, frag: string, params?: object): Fragment`
  - `sql(strings: TemplateStringsArray, ...v: unknown[]): DynamicSql`
  - class `DynamicSql` with: `static of(sql, params?)`, `append(frag, params?)`, `appendIf(cond, frag, params?)`, `where(frags)`, `set(frags)`, `orderBy(sort, allowed)`, `build(): { sql: string; params: object }`

- [ ] **Step 1: Write the failing test**

```ts
// src/common/database/dynamic-sql.spec.ts
import { DynamicSql, when, sql } from './dynamic-sql';
import { SortOrder } from '../dtos/sort.dto';

describe('DynamicSql', () => {
  it('where joins truthy fragments with AND and merges params', () => {
    const { sql: text, params } = DynamicSql.of('SELECT * FROM users')
      .where([
        when('A', 'status = #{status}', { status: 'A' }),
        when(null, 'name = #{n}', { n: 'x' }),
        when('k', 'email ILIKE #{kw}', { kw: '%k%' }),
      ])
      .build();
    expect(text).toBe('SELECT * FROM users WHERE status = #{status} AND email ILIKE #{kw}');
    expect(params).toEqual({ status: 'A', kw: '%k%' });
  });

  it('where omits the clause when all fragments are null', () => {
    const { sql: text } = DynamicSql.of('SELECT * FROM users')
      .where([when(undefined, 'x = #{x}', { x: 1 })])
      .build();
    expect(text).toBe('SELECT * FROM users');
  });

  it('set joins fragments with commas', () => {
    const { sql: text } = DynamicSql.of('UPDATE users')
      .set([
        when('a@b', 'email = #{email}', { email: 'a@b' }),
        when('u1', 'updated_by = #{by}', { by: 'u1' }),
      ])
      .append('WHERE id = #{id}', { id: 3 })
      .build();
    expect(text).toBe('UPDATE users SET email = #{email}, updated_by = #{by} WHERE id = #{id}');
  });

  it('orderBy emits only allow-listed columns, snake-cased', () => {
    const { sql: text } = DynamicSql.of('SELECT * FROM users')
      .orderBy(
        [
          { sortBy: 'createdAt', order: SortOrder.DESC },
          { sortBy: 'email', order: SortOrder.ASC },
        ],
        ['createdAt', 'email'],
      )
      .build();
    expect(text).toBe('SELECT * FROM users ORDER BY created_at DESC, email ASC');
  });

  it('orderBy drops a non-allow-listed column (injection guard)', () => {
    const { sql: text } = DynamicSql.of('SELECT * FROM users')
      .orderBy([{ sortBy: 'password; DROP TABLE users', order: SortOrder.ASC }], ['email'])
      .build();
    expect(text).toBe('SELECT * FROM users');
  });

  it('orderBy forces order to ASC or DESC only', () => {
    const { sql: text } = DynamicSql.of('SELECT * FROM users')
      .orderBy([{ sortBy: 'email', order: 'DROP' as unknown as SortOrder }], ['email'])
      .build();
    expect(text).toBe('SELECT * FROM users ORDER BY email DESC');
  });

  it('sql`` tag builds from a static template', () => {
    expect(sql`SELECT 1`.build().sql).toBe('SELECT 1');
  });

  it('sql`` tag rejects value interpolation', () => {
    const v = 5;
    expect(() => sql`SELECT ${v}`).toThrow('use #{} params');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/common/database/dynamic-sql.spec.ts`
Expected: FAIL — cannot find module `./dynamic-sql`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/common/database/dynamic-sql.ts
import { SortDto, SortOrder } from '../dtos/sort.dto';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/common/database/dynamic-sql.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/common/database/dynamic-sql.ts src/common/database/dynamic-sql.spec.ts
git commit -m "feat(db): DynamicSql builder with where/set/orderBy allow-list"
```

---

### Task 5: `SqlMapper` facade

**Files:**
- Create: `src/common/database/sql-mapper.types.ts`
- Create: `src/common/database/sql-mapper.ts`
- Test: `src/common/database/sql-mapper.spec.ts`

**Interfaces:**
- Consumes: `bind` (Task 2), `rowToCamel` (Task 1), `DynamicSql` (Task 4), `SqlStore` (Task 3); TypeORM `DataSource`; `PaginationDto` from `src/common/dtos/pagination.dto.ts`; `plainToInstance` from class-transformer.
- Produces:
  - `src/common/database/sql-mapper.types.ts`: `interface Paginated<T>`, `type ClassConstructor<T> = new () => T`
  - class `SqlMapper` with `named`, `selectOne`, `selectList`, `selectPage`, `insert`, `update`, `delete`, `execute` (signatures in the spec).

- [ ] **Step 1: Write the types file (no test — type-only)**

```ts
// src/common/database/sql-mapper.types.ts
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type ClassConstructor<T> = new () => T;
```

- [ ] **Step 2: Write the failing test**

```ts
// src/common/database/sql-mapper.spec.ts
import { DataSource } from 'typeorm';
import { SqlMapper } from './sql-mapper';
import { SqlStore } from './sql-store';
import { PaginationDto } from '../dtos/pagination.dto';

class UserDto {
  id: number;
  email: string;
  createdAt: Date;
}

function makeMapper(queryImpl: jest.Mock) {
  const ds = { query: queryImpl } as unknown as DataSource;
  const store = { get: () => 'SELECT * FROM users WHERE id = #{id}' } as unknown as SqlStore;
  return { mapper: new SqlMapper(ds, store), ds, store };
}

describe('SqlMapper', () => {
  it('selectOne binds params, camel-maps the row, returns a DTO', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 1, email: 'a@b', created_at: '2026-01-01' }]);
    const { mapper } = makeMapper(query);
    const row = await mapper.selectOne(UserDto, 'SELECT * FROM users WHERE id = #{id}', { id: 1 });
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    expect(row).toBeInstanceOf(UserDto);
    expect(row).toMatchObject({ id: 1, email: 'a@b', createdAt: '2026-01-01' });
  });

  it('selectOne returns null on no rows', async () => {
    const { mapper } = makeMapper(jest.fn().mockResolvedValue([]));
    expect(await mapper.selectOne(UserDto, 'SELECT 1', {})).toBeNull();
  });

  it('selectList maps every row', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { mapper } = makeMapper(query);
    const rows = await mapper.selectList(UserDto, 'SELECT * FROM users', {});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBeInstanceOf(UserDto);
  });

  it('selectPage count-wraps then appends LIMIT/OFFSET', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const { mapper } = makeMapper(query);
    const page = new PaginationDto();
    page.page = 1;
    page.limit = 20;
    const result = await mapper.selectPage(UserDto, 'SELECT * FROM users', page, {});

    expect(query.mock.calls[0][0]).toBe('SELECT count(*)::int AS total FROM (SELECT * FROM users) AS _c');
    expect(query.mock.calls[1][0]).toBe('SELECT * FROM users LIMIT $1 OFFSET $2');
    expect(query.mock.calls[1][1]).toEqual([20, 0]);
    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('insert returns the affected count via structured result', async () => {
    const query = jest.fn().mockResolvedValue({ affected: 1, records: [], raw: [] });
    const { mapper } = makeMapper(query);
    const n = await mapper.insert('INSERT INTO users (email) VALUES (#{email})', { email: 'a@b' });
    expect(query).toHaveBeenCalledWith('INSERT INTO users (email) VALUES ($1)', ['a@b'], true);
    expect(n).toBe(1);
  });

  it('named() pulls SQL from the store and stays composable', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 1 }]);
    const { mapper } = makeMapper(query);
    await mapper.selectOne(UserDto, mapper.named('user.findById'), { id: 1 });
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
  });

  it('execute returns camel rows without class instances', async () => {
    const query = jest.fn().mockResolvedValue([{ total_count: 5 }]);
    const { mapper } = makeMapper(query);
    const rows = await mapper.execute(UserDto, 'SELECT count(*) AS total_count FROM users');
    expect(rows).toEqual([{ totalCount: 5 }]);
    expect(rows[0]).not.toBeInstanceOf(UserDto);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/common/database/sql-mapper.spec.ts`
Expected: FAIL — cannot find module `./sql-mapper`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/common/database/sql-mapper.ts
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';
import { PaginationDto } from '../dtos/pagination.dto';
import { bind } from './bind-params';
import { DynamicSql } from './dynamic-sql';
import { SqlStore } from './sql-store';
import { rowToCamel } from './to-camel';
import { ClassConstructor, Paginated } from './sql-mapper.types';

type Sql = string | DynamicSql;

@Injectable()
export class SqlMapper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly store: SqlStore,
  ) {}

  named(id: string): DynamicSql {
    return DynamicSql.of(this.store.get(id));
  }

  private resolve(sql: Sql, params?: object): { text: string; params: Record<string, unknown> } {
    if (typeof sql === 'string') return { text: sql, params: (params ?? {}) as Record<string, unknown> };
    const built = sql.build();
    return { text: built.sql, params: { ...built.params, ...(params ?? {}) } };
  }

  private query(text: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const { text: bound, values } = bind(text, params);
    return this.dataSource.query(bound, values);
  }

  async selectOne<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T | null> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.length ? plainToInstance(target, rowToCamel(rows[0])) : null;
  }

  async selectList<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T[]> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.map((r) => plainToInstance(target, rowToCamel(r)));
  }

  async selectPage<T>(
    target: ClassConstructor<T>,
    sql: Sql,
    page: PaginationDto,
    params?: object,
  ): Promise<Paginated<T>> {
    const { text, params: p } = this.resolve(sql, params);

    const countRows = await this.query(`SELECT count(*)::int AS total FROM (${text}) AS _c`, p);
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await this.query(`${text} LIMIT #{__limit} OFFSET #{__offset}`, {
      ...p,
      __limit: page.limit,
      __offset: page.offset,
    });

    return {
      data: rows.map((r) => plainToInstance(target, rowToCamel(r))),
      meta: {
        page: page.page,
        limit: page.limit,
        total,
        totalPages: Math.ceil(total / page.limit),
      },
    };
  }

  async execute<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T[]> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.map((r) => rowToCamel(r)) as T[];
  }

  insert(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  update(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  delete(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  private async affected(sql: Sql, params?: object): Promise<number> {
    const { text, params: p } = this.resolve(sql, params);
    const { text: bound, values } = bind(text, p);
    // TypeORM 0.3+ structured result: { records, affected, raw }
    const result = await this.dataSource.query(bound, values, true);
    return Number(result?.affected ?? 0);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/common/database/sql-mapper.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/common/database/sql-mapper.ts src/common/database/sql-mapper.types.ts src/common/database/sql-mapper.spec.ts
git commit -m "feat(db): SqlMapper facade (select/page/write/execute/named)"
```

---

### Task 6: Global module + barrel + asset wiring

**Files:**
- Create: `src/common/database/sql-mapper.module.ts`
- Create: `src/common/database/index.ts`
- Modify: `src/app.module.ts` (add `SqlMapperModule` to `imports`)
- Modify: `nest-cli.json` (copy `.sql` to `dist`)

**Interfaces:**
- Consumes: `SqlMapper`, `SqlStore` (Tasks 3, 5).
- Produces: `SqlMapperModule` (global, exports `SqlMapper`); barrel `index.ts` re-exporting `SqlMapper`, `DynamicSql`, `when`, `sql`, `Paginated`, `ClassConstructor`.

- [ ] **Step 1: Write the module**

The store loads from the current working directory at boot. `DataSource` is taken from the DI container (provided by the existing `TypeOrmModule`).

```ts
// src/common/database/sql-mapper.module.ts
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SqlMapper } from './sql-mapper';
import { SqlStore } from './sql-store';

@Global()
@Module({
  providers: [SqlStore, SqlMapper],
  exports: [SqlMapper],
})
export class SqlMapperModule implements OnModuleInit {
  constructor(private readonly store: SqlStore) {}

  onModuleInit(): void {
    // Loads *.sql under the process working directory once at startup.
    this.store.load(process.cwd());
  }
}
```

- [ ] **Step 2: Write the barrel**

```ts
// src/common/database/index.ts
export { SqlMapper } from './sql-mapper';
export { SqlMapperModule } from './sql-mapper.module';
export { DynamicSql, when, sql } from './dynamic-sql';
export type { Fragment } from './dynamic-sql';
export type { Paginated, ClassConstructor } from './sql-mapper.types';
```

- [ ] **Step 3: Register the module in AppModule**

Open `src/app.module.ts`. Add the import and list `SqlMapperModule` in `imports`:

```ts
import { SqlMapperModule } from './common/database';
```

Add `SqlMapperModule` to the `@Module({ imports: [...] })` array (after the existing `TypeOrmModule` entry).

- [ ] **Step 4: Copy `.sql` files to dist on build**

Open `nest-cli.json`. Inside `compilerOptions`, add the assets entry (merge with any existing keys — do not overwrite the `plugins` array from the Swagger setup):

```json
{
  "compilerOptions": {
    "assets": [{ "include": "**/*.sql", "watchAssets": true }]
  }
}
```

- [ ] **Step 5: Verify the build compiles and nothing broke**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors in `src/common/database/`.

Run: `npm test -- src/common/database`
Expected: PASS (all database specs green).

- [ ] **Step 6: Commit**

```bash
git add src/common/database/sql-mapper.module.ts src/common/database/index.ts src/app.module.ts nest-cli.json
git commit -m "feat(db): wire global SqlMapperModule and .sql asset copy"
```

---

## Known ceilings (perfect later — do not implement now)

- No auto nested result mapping → use Postgres `json_agg`/`json_build_object` in SQL.
- `DynamicSql.where()` appends linearly; JOIN/GROUP BY/HAVING structure belongs in `.sql` files.
- No transactions API yet.
- `SqlStore.load(process.cwd())` scans the working dir; if a prod image runs from `dist/` with sources stripped, point it at the dist root (add `forRoot({ root })` when that need is real).
- Write methods rely on TypeORM's structured-result arg (`query(sql, values, true)` → `{ affected }`). Verify against the installed TypeORM version during Task 5; if unavailable, fall back to `RETURNING` + row count.

## Self-Review

- **Spec coverage:** facade (T5), `named` (T5), where/set/orderBy + `when`/`sql` (T4), `.sql` multi-statement + loader (T3), param bind + cache (T2), snake→camel + loose map (T1/T5), pagination count-wrap (T5), sort allow-list security (T4), module wiring + assets (T6). All spec sections mapped.
- **Placeholder scan:** none — every code/test step is complete.
- **Type consistency:** `ClassConstructor<T>`/`Paginated<T>` defined T5 types file, used consistently; `Fragment`/`when`/`DynamicSql` defined T4, consumed T5; `bind` signature stable T2→T5; `SqlStore.get` stable T3→T5.
