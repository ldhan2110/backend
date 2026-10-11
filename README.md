# Backend

NestJS 12 + TypeORM + PostgreSQL boilerplate with a lightweight, MyBatis-style
SQL mapper. This README is the developer onboarding guide: get running in
minutes, then understand how the pieces fit.

---

## 1. Quick start

Prerequisites: **Node >= 20.12** (uses native `process.loadEnvFile`), **pnpm**,
and a reachable **PostgreSQL** instance.

```bash
# 1. install deps
pnpm install

# 2. create your env file from the template
cp .env.example .env
#    then edit .env with your DB credentials

# 3. run migrations (schema is NOT auto-synced — see §6)
pnpm migration:run

# 4. start in watch mode
pnpm run start:dev
```

App listens on `PORT` (default `3000`). Swagger UI is served at
**`http://localhost:<PORT>/docs`**.

> The app **fails fast on boot** if any required env var is missing or invalid
> (see `src/infra/env/env.module.ts`). A validation error prints the offending
> fields and exits with code 1 — that is expected behaviour, not a crash.

### Environment variables

| Var           | Required | Default       | Notes                                   |
| ------------- | -------- | ------------- | --------------------------------------- |
| `NODE_ENV`    | no       | `DEVELOPMENT` | `DEVELOPMENT` \| `TEST` \| `PRODUCTION` |
| `PORT`        | no       | `3000`        | 1–65535                                 |
| `DB_TYPE`     | no       | `postgres`    | `postgres` \| `oracle` \| `mssql`       |
| `DB_HOST`     | **yes**  | —             |                                         |
| `DB_PORT`     | no       | `5432`        |                                         |
| `DB_USERNAME` | **yes**  | —             |                                         |
| `DB_PASSWORD` | **yes**  | —             |                                         |
| `DB_NAME`     | **yes**  | —             |                                         |

`.env*` files are loaded in this order (later wins):
`.env`, `.env.development`, `.env.test`, `.env.production`.

---

## 2. Scripts

```bash
pnpm run start:dev     # watch mode
pnpm run start:prod    # run compiled dist/ (build first)
pnpm run build         # nest build + tsc-alias (resolves path aliases)
pnpm run lint          # oxlint, type-aware
pnpm run format        # prettier
pnpm run test          # unit tests (jest, ESM)
pnpm run test:e2e      # e2e tests
pnpm run test:cov      # coverage

# migrations (TypeORM CLI, see §6)
pnpm migration:generate src/infra/database/migrations/<Name>
pnpm migration:create   src/infra/database/migrations/<Name>
pnpm migration:run
pnpm migration:revert
pnpm migration:show
```

---

## 3. Architecture at a glance

Standard layered flow, one directory per concern:

```
HTTP → Controller → Service → Repository → SqlMapper → PostgreSQL
         (DTO)      (rules)   (named SQL)   (bind +     
                                            camelCase)  
```

```
src/
├─ main.ts                     # bootstrap: global filters + Swagger
├─ app.module.ts               # root: imports InfraModule + feature modules
│
├─ config/
│  └─ env.config.ts            # typed config factory + NodeEnv/DatabaseType enums
│
├─ infra/                      # cross-cutting infrastructure
│  ├─ infra.module.ts          # groups Env + Database
│  ├─ env/env.module.ts        # ConfigModule + class-validator env validation
│  └─ database/
│     ├─ database.module.ts    # @Global: TypeORM + CLS transactions + SqlMapper
│     ├─ entities/             # TypeORM entities (migrations only, see §6)
│     ├─ migrations/           # generated migration files
│     └─ mapper/               # ★ the custom SQL mapper (see §5)
│
├─ common/                     # shared, feature-agnostic building blocks
│  ├─ dtos/                    # BaseDto (audit), Pagination, Sort, Success
│  ├─ exceptions/              # DomainException base + AppException envelope
│  └─ filters/                 # Domain + Runtime exception filters
│
└─ modules/                    # feature modules (one folder each)
   └─ user/                    # ★ reference implementation — copy this shape
      ├─ user.module.ts
      ├─ controllers/
      ├─ services/
      ├─ dtos/                 # *.request.dto.ts / *.response.dto.ts
      └─ repository/
         ├─ user.repository.ts
         └─ sql/user.sql       # named SQL, colocated with the module
```

**Path aliases** (`tsconfig.json`): `@infra/*`, `@config/*`, `@common/*`,
`@modules/*`. Always import through these, not relative `../../..` paths.

---

## 4. The `user` module — your template

To add a feature, copy `src/modules/user/` and rename. The layering:

- **Controller** (`controllers/user.controller.ts`) — routes only. Binds
  `@Query`/`@Body`/`@Param`, delegates to the service. No logic.
- **Service** (`services/user.service.ts`) — business rules, throws domain
  errors (`NotFoundException`, etc.).
- **Repository** (`repository/user.repository.ts`) — data access via
  `SqlMapper`. Holds the `SORTABLE` allow-list for safe sorting.
- **SQL** (`repository/sql/user.sql`) — named queries, loaded at boot.
- **DTOs** (`dtos/`) — split by direction:
  - `user.request.dto.ts` — inbound, validated with `class-validator`.
    Create/update DTOs **do not** carry audit fields (clients never send them).
    List DTOs compose nested `SortDto` + `PaginationDto`.
  - `user.response.dto.ts` — outbound. Response rows extend `BaseDto`
    (audit columns) and are the mapping target for the SQL mapper.

Remember to register the new module in `app.module.ts`.

---

## 5. SQL mapper — the one thing to learn

This project does **not** use the TypeORM repository/query-builder for reads and
writes. Instead it uses a small MyBatis-style mapper: SQL lives in `.sql` files,
referenced by name, with injection-safe bind placeholders.

### Named queries

SQL files are plain text with `-- name:` markers. At boot, `SqlStore` recursively
scans the working directory for every `*.sql` file and registers each query as
`<filename>.<name>`:

```sql
-- src/modules/user/repository/sql/user.sql
-- name: findById
SELECT * FROM users WHERE id = #{id};
```

→ referenced as `this.mapper.named('user.findById')`
(filename `user.sql` → namespace `user`).

### Bind parameters — always `#{name}`

`#{name}` compiles to a numbered placeholder (`$1`, `$2`, …) and the value is
passed separately to the driver — **safe against SQL injection**. String
interpolation (`${}`) is intentionally rejected; never build SQL by concatenation.

A missing param throws `Missing SQL param: <name>` at call time.

### Mapper API (`@infra/database/mapper`)

Inject `SqlMapper` into a repository. Results are auto-mapped from `snake_case`
columns to `camelCase` fields of the target DTO class.

| Method                                   | Returns          | Use for                        |
| ---------------------------------------- | ---------------- | ------------------------------ |
| `selectOne(Dto, sql, params)`            | `T \| null`      | single row                     |
| `selectList(Dto, sql, params)`           | `T[]`            | many rows                      |
| `selectPage(Dto, sql, pagination)`       | `Paginated<T>`   | paged list (`{ data, meta }`)  |
| `execute(Dto, sql, params)`              | `T[]`            | arbitrary projection           |
| `insert / update / delete(sql, params)`  | `number`         | writes → affected row count    |

### Dynamic SQL

For conditional filters and safe ordering, chain off `named(...)`:

```ts
const sql = this.mapper
  .named('user.base')
  .where([
    when(query.status,  'status = #{status}', { status: query.status }),
    when(query.keyword, 'email ILIKE #{kw}',  { kw: `%${query.keyword}%` }),
  ])
  .orderBy(query.sort, SORTABLE); // SORTABLE = column allow-list

return this.mapper.selectPage(UserDto, sql, query.pagination);
```

- `when(cond, fragment, params)` — fragment is included only when `cond` is
  truthy; the fragments are `AND`-joined.
- `.orderBy(sort, allowed)` — only columns in the `allowed` list are honoured
  (prevents sort-column injection); camelCase is mapped to snake_case.

### Transactions

Wrap a service method with `@Transactional()` from `@nestjs-cls/transactional`.
It uses CLS (async context) under the hood — every `SqlMapper` call inside the
method automatically joins the same transaction, no manual `QueryRunner` passing:

```ts
import { Transactional } from '@nestjs-cls/transactional';

@Transactional()
async transfer(...) {
  await this.repo.debit(...);
  await this.repo.credit(...); // same tx; both roll back on throw
}
```

---

## 6. Database & migrations

- **`synchronize` is `false`** everywhere. The schema is managed **only** by
  migrations — entities are never auto-applied to the DB.
- **Entities** (`src/infra/database/entities/`) exist so TypeORM can
  *generate* migrations and provide audit columns via `BaseEntity`
  (`created_at/by`, `updated_at/by`). Runtime reads/writes go through the SQL
  mapper, not the entities.
- The TypeORM CLI uses its own `data-source.ts` (it can't read Nest's DI). It
  loads env natively (`process.loadEnvFile`) — no `dotenv` dependency.

Typical workflow after changing an entity:

```bash
pnpm migration:generate src/infra/database/migrations/AddFooColumn
pnpm migration:run
```

---

## 7. Errors & responses

- `main.ts` registers two global filters. **Order matters**:
  `RuntimeExceptionFilter` (catch-all) is registered first, then
  `DomainExceptionFilter`, so domain errors out-rank the catch-all.
- Throw a subclass of `DomainException` (`@common/exceptions`) for business-rule
  violations — it carries a stable `code`, `detail`, and HTTP `status`.
- Both filters emit the same JSON envelope (`AppException`, an RFC 9457 subset)
  with content type `application/problem+json`:

  ```json
  { "code": "USER_NOT_FOUND", "detail": "User 42 not found", "status": 404 }
  ```

---

## 8. Caching

`CacheService` (`@infra/cache`) is the one cache API — `@Global`, so inject it
anywhere. Redis when `REDIS_URL` is set, otherwise an in-process LRU for
dev/test. It is **fail-open**: any backend error is logged and treated as a
miss, so the cache can never break a request.

```ts
// read-through
const user = await this.cache.getOrSet(`user:${id}`, 300_000, () => this.repo.findById(id));

// or declaratively on a method
@Cacheable({ ttl: 300_000 })
async findById(id: string) { ... }
```

TTL is in **milliseconds**, optional (omit → `CACHE_DEFAULT_TTL`). Invalidate
manually on writes (`cache.del(key)`).
Full rules: [`docs/rules/caching.md`](docs/rules/caching.md).

| Var | Default | Notes |
| ----------------- | ------- | ----------------------------------------- |
| `REDIS_URL`        | —       | unset → in-memory LRU (per-process)       |
| `CACHE_MEMORY_MAX` | `1000`  | LRU max entries; ignored when Redis is on |
| `CACHE_DEFAULT_TTL`| `60000` | fallback TTL (ms) when a write omits one  |

---

## 9. Conventions checklist

When adding code, match the existing shape:

- [ ] Feature lives under `src/modules/<name>/` with controller/service/repository/dtos.
- [ ] SQL in a colocated `repository/sql/<name>.sql`, referenced as `<name>.<query>`.
- [ ] Bind values with `#{param}` — never interpolate.
- [ ] Any client-controlled sort column goes through an allow-list.
- [ ] Request DTOs validated with `class-validator`; response DTOs extend `BaseDto`.
- [ ] Imports use `@infra`/`@config`/`@common`/`@modules` aliases.
- [ ] New module registered in `app.module.ts`.
- [ ] Schema changes ship as a migration (no `synchronize`).
