# SQL Mapper — Design Spec

**Date:** 2026-10-03
**Status:** Approved (v1 shape; refine later)

## Goal

A MyBatis-style SQL mapper for the NestJS backend. You write the SQL; it binds
params safely, maps result rows back to a typed DTO, and supports dynamic
fragments, named statements in `.sql` files, pagination, and allow-listed sort.
No per-entity ActiveRecord classes, no query builder DSL, no XML.

## Decisions (locked)

- **One injectable facade:** `SqlMapper`. Features inject only this.
- **SQL is king:** raw SQL via `#{name}` params. JOIN/GROUP BY/CTE/subquery =
  plain SQL, no ORM limits.
- **Named statements:** `.sql` files, one file = one namespace, many statements
  by `-- name:` marker (MyBatis XML mapper analog).
- **Dynamic SQL:** TS-native chainable builder (`when`/`where`/`set`/`orderBy`).
  No XML, no `<if test>` expression evaluator.
- **Mapping:** rows snake_case → camelCase (top-level keys), then
  `plainToInstance(target)` loose copy-all by default; strict (`@Expose` +
  `excludeExtraneousValues`) opt-in per DTO.
- **Nesting:** no auto `<resultMap>` collection/association. Use Postgres
  `json_agg`/`json_build_object` in SQL → maps for free.

## Non-Goals (YAGNI)

- XML mappers / in-file template language / `<if test>` eval.
- Auto collection/association nesting engine.
- Transactions API (v1 uses default connection; add later).
- Change tracking / entity lifecycle / relations cascade.

## Types

```ts
interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
type ClassConstructor<T> = new () => T;
type Fragment = { frag: string; params: object } | null;
```

## `SqlMapper` (the one facade)

```ts
@Injectable()
class SqlMapper {
  constructor(private readonly dataSource: DataSource, private readonly store: SqlStore) {}

  named(id: string): DynamicSql;   // pull file SQL by 'namespace.name', composable

  selectOne<T>(target: ClassConstructor<T>, sql: string | DynamicSql, params?: object): Promise<T | null>;
  selectList<T>(target: ClassConstructor<T>, sql: string | DynamicSql, params?: object): Promise<T[]>;
  selectPage<T>(target: ClassConstructor<T>, sql: string | DynamicSql, page: PaginationDto, params?: object): Promise<Paginated<T>>;

  insert(sql: string | DynamicSql, params?: object): Promise<number>;  // rows affected
  update(sql: string | DynamicSql, params?: object): Promise<number>;
  delete(sql: string | DynamicSql, params?: object): Promise<number>;

  execute<T>(target: ClassConstructor<T>, sql: string | DynamicSql, params?: object): Promise<T[]>; // camel rows, skips plainToInstance
}
```

## `DynamicSql` builder + `when()`

```ts
function when(cond: unknown, frag: string, params?: object): Fragment; // the <if>

class DynamicSql {
  static of(sql: string, params?: object): DynamicSql;

  append(frag: string, params?: object): this;                 // always
  appendIf(cond: unknown, frag: string, params?: object): this;// single <if>
  where(fragments: Fragment[]): this;  // join truthy w/ AND, prefix WHERE, omit if none, strip leading AND/OR
  set(fragments: Fragment[]): this;    // join truthy w/ ',', prefix SET
  orderBy(sort: SortDto | SortDto[] | undefined, allowed: string[]): this; // allow-listed, see Security
  build(): { sql: string; params: object };
}

function sql(strings: TemplateStringsArray, ...v: unknown[]): DynamicSql; // sugar
```

## `SqlStore` (internal; reached via `mapper.named()`)

```ts
@Injectable()
class SqlStore {
  constructor();              // globs *.sql at boot → Map<'namespace.name', sql>
  get(name: string): string; // throws if missing
}
```

- Namespace = filename without ext (`user.sql` → `user`).
- Statements split on `-- name: <id>` markers.
- Loaded **once at boot**. Zero runtime file IO.
- Optional `SqlMapperModule.forRoot({ glob })`; default `src/**/*.sql`.

## Param binding

- `#{name}` → positional `$1,$2,...`, values collected in order.
- Repeated name → placeholder repeated, value repeated.
- Missing key → throw (fail fast).
- Values always bound — never string-interpolated. Injection-safe.
- Parse cached per statement text: `sql → { text, paramNames }`. Repeat calls =
  Map lookup, no re-regex.

## Result mapping

- pg returns snake_case rows. Convert top-level keys → camelCase
  (`mapUnderscoreToCamelCase` behavior).
- `plainToInstance(target, camelRow)` — loose default, strict opt-in.
- JSON blobs (`json_build_object`/`json_agg`) pass through as-is → name their
  keys camelCase in SQL (snake→camel does not recurse into JSON).

## Pagination

`selectPage`:
1. Count-wrap: `SELECT count(*)::int AS total FROM (<sql>) AS _c` → `total`.
   Valid for GROUP BY / CTE / subquery (counts result rows).
2. Append `LIMIT $n OFFSET $n` from `page.limit` / `page.offset`.
3. Return `{ data, meta: { page, limit, total, totalPages } }`,
   `totalPages = Math.ceil(total / limit)`.
Caller owns `ORDER BY` (via `.orderBy()` or in the SQL).

## Security — sort allow-list

ORDER BY column is an **identifier, not a bindable value**. `#{}`/`$n` cannot
parameterize it. `.orderBy(sort, allowed)`:
- `sort.sortBy` must be in `allowed` (camelCase whitelist) → else dropped.
- mapped camel→snake for the column.
- `order` validated against `SortOrder` enum (ASC|DESC); never interpolated raw.
- Multi-column via `SortDto[]`. None valid → ORDER BY omitted (put a default in
  the `.sql`).

## File layout

```
src/common/database/
  sql-mapper.ts            # SqlMapper facade
  sql-mapper.module.ts     # @Global() module (forRoot optional)
  sql-mapper.types.ts      # Paginated<T>, ClassConstructor<T>, Fragment
  dynamic-sql.ts           # DynamicSql + when() + sql`` tag
  sql-store.ts             # .sql loader + parser
  bind-params.ts           # #{name} -> $n (pure fn, cached by caller)
  to-camel.ts              # snake_case keys -> camelCase (pure fn)
  __tests__/
    bind-params.spec.ts
    to-camel.spec.ts
    sql-store.spec.ts
    dynamic-sql.spec.ts    # where/set/orderBy incl. allow-list reject
```

## Testing (self-checks on the non-trivial logic)

- `bind-params`: single, repeated, multiple, missing-key throws, none.
- `to-camel`: `created_at`→`createdAt`, already-camel untouched, flat only.
- `sql-store`: multi-statement parse, namespace key, missing name throws.
- `dynamic-sql`:
  - `where` omits when all null, strips leading AND.
  - `set` joins with comma.
  - `orderBy` allows whitelisted, **drops non-whitelisted (injection guard)**,
    rejects bad `order`.
- Integration (if test DB available): `selectPage` count + LIMIT/OFFSET, nested
  JSON maps to DTO.

## Known ceilings (perfect later)

- No auto nested result mapping → `json_agg` covers it.
- `DynamicSql.where()` appends linearly; complex JOIN/GROUP BY/HAVING structure
  belongs in the `.sql` file, not the builder.
- No transactions API yet.
- `.sql` files must be copied to `dist/` — add to `nest-cli.json` assets:
  `"assets": [{ "include": "**/*.sql", "watchAssets": true }]`.
