# SQL Mapper — Design Spec

**Date:** 2026-10-03
**Status:** Draft for review

## Goal

A MyBatis-style SQL mapper for the NestJS backend. You write the SQL; it binds
params in safely and maps result rows back to a typed DTO automatically. No
per-entity ActiveRecord classes, no query builder, no dynamic SQL.

## Non-Goals (YAGNI)

- Dynamic SQL (`<if>`/`<where>`/`<foreach>`) — write the SQL yourself.
- File-based `*.sql` mapper namespaces — SQL lives inline in service methods.
- ORM features (relations cascade, change tracking, entity lifecycle).
- Transactions API — v1 uses the default connection; add later if needed.

## Shape

One injectable service, `SqlMapper`, wrapping TypeORM `DataSource.query()`.

```ts
interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
class SqlMapper {
  constructor(private readonly dataSource: DataSource) {}

  selectOne<T>(target: ClassConstructor<T>, sql: string, params?: object): Promise<T | null>;
  selectList<T>(target: ClassConstructor<T>, sql: string, params?: object): Promise<T[]>;
  selectPage<T>(target: ClassConstructor<T>, sql: string, page: PaginationDto, params?: object): Promise<Paginated<T>>;

  insert(sql: string, params?: object): Promise<number>; // rows affected
  update(sql: string, params?: object): Promise<number>;
  delete(sql: string, params?: object): Promise<number>;

  execute<T>(target: ClassConstructor<T>, sql: string, params?: object): Promise<T[]>; // raw escape hatch
}
```

## Behavior

### 1. Named param binding (`#{name}` → `$1,$2,...`)

MyBatis-style `#{name}` placeholders. Before running, rewrite each `#{name}` to
a positional Postgres placeholder and collect the matching values in order.

- `SELECT * FROM users WHERE id = #{id} AND status = #{status}`, `{ id: 5, status: 'A' }`
- → `SELECT * FROM users WHERE id = $1 AND status = $2`, `[5, 'A']`

Rules:
- Same name used twice → two placeholders, value repeated (simplest; no dedupe).
- Missing key in params → throw (fail fast, not silent `undefined`).
- Values always bound as params — never string-interpolated. SQL injection safe.

### 2. Result mapping (rows → T)

- Rows come back snake_case from Postgres.
- Auto-convert each row's keys snake_case → camelCase (MyBatis
  `mapUnderscoreToCamelCase` behavior).
- `plainToInstance(target, camelRow)` — **loose** copy-all by default. You wrote
  the SELECT, so you control the columns; no "leaked column" risk.
- Strict mode (`excludeExtraneousValues` + `@Expose`) stays opt-in per DTO if a
  caller wants it — not the default.

### 3. Pagination (`selectPage`)

Caller passes a SELECT without LIMIT/OFFSET. The mapper:
1. Wraps it to count: `SELECT count(*) FROM (<sql>) AS _c` → `total`.
2. Appends `LIMIT #{__limit} OFFSET #{__offset}` using `page.limit` / `page.offset`.
3. Returns `{ data, meta: { page, limit, total, totalPages } }`.

`totalPages = Math.ceil(total / limit)`. Reuses existing `PaginationDto`
(`page`, `limit`, `offset` getter).

Caller keeps ownership of `ORDER BY` (put it in the SQL). No sort magic.

### 4. Writes

`insert`/`update`/`delete` run the statement, return affected row count
(`result.rowCount` / TypeORM raw result). Caller does `RETURNING` + `selectOne`
if it wants the row back.

## File Layout

```
src/common/database/
  sql-mapper.ts          # SqlMapper service
  sql-mapper.types.ts    # Paginated<T>, ClassConstructor<T>
  bind-params.ts         # #{name} -> $n rewrite (pure fn)
  to-camel.ts            # snake_case keys -> camelCase (pure fn)
  sql-mapper.module.ts   # @Global() module exporting SqlMapper
  bind-params.spec.ts    # self-check for the binding logic
```

## Testing

Non-trivial logic = the `#{name}` rewrite and key conversion. One spec file:

- `bind-params`: single param, repeated param, multiple params, missing key
  throws, no params.
- `to-camel`: `created_at` → `createdAt`, already-camel untouched, nested
  not required (flat rows only).

Mapping + pagination verified via one integration test against a booted module
if a test DB is available; otherwise unit-level on the pure functions only.

## Usage

```ts
// read one
mapper.selectOne(UserDto, 'SELECT * FROM users WHERE id = #{id}', { id });

// list
mapper.selectList(UserDto, 'SELECT * FROM users WHERE status = #{status}', { status: 'ACTIVE' });

// paginated (no LIMIT/ORDER in caller's hands)
mapper.selectPage(
  UserDto,
  'SELECT * FROM users WHERE status = #{status} ORDER BY created_at DESC',
  page,
  { status: 'ACTIVE' },
);

// write
await mapper.insert('INSERT INTO users (email, created_by) VALUES (#{email}, #{by})', { email, by });
```

## Open Questions

1. Inline SQL (this spec) vs file-based `*.sql` namespaces — confirm inline.
2. Loose map default OK? (strict opt-in)
3. `selectPage` count-wrap: acceptable to wrap the whole query as subquery for
   count? Works for all SELECTs but adds one extra query per page call.
