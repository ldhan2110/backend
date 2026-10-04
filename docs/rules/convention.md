# Convention

The rules. Follow strictly to prevent unwanted code. This doc is authoritative —
do not infer patterns by copying an existing module, which may drift.
Workflow: [`../agent-playbook.md`](../agent-playbook.md).
Schema changes: [`migration.md`](migration.md).

## Structure & naming

- Imports use path aliases `@infra` `@config` `@common` `@modules` — never
  relative `../../..`. Aliases are defined in `tsconfig.json`.
- File names: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`,
  `<name>.repository.ts`, `<name>.sql`, `<name>.request.dto.ts`,
  `<name>.response.dto.ts`. Folder layout: see the playbook.
- DTO **class** names carry their direction as a suffix: inbound end
  `RequestDto`, outbound end `ResponseDto` (e.g. `LoginRequestDto`,
  `UserInfoResponseDto`). No bare `...Dto`.
- Every DTO class lives in the module's `dtos/` folder — never declared inside a
  `.repository.ts`, `.service.ts`, or `.controller.ts` file.

## Data access — SqlMapper only

Inject `SqlMapper` (from `@infra/database/mapper`). No TypeORM repository or
query-builder at runtime.

- Reference a query by `named('<file>.<query>')` where `<file>` is the `.sql`
  filename and `<query>` is its `-- name:` marker (e.g. `user.findById`).
- Bind values with `#{param}` only. `#{}` compiles to a parameterized
  placeholder (injection-safe); a missing param throws at call time.
- `${}` string interpolation is forbidden — never concatenate SQL.
- Client-controlled sort columns pass through an allow-list array; only listed
  columns are honored.

Mapper API:

| Method | Returns | For |
|---|---|---|
| `selectOne(Dto, sql, params)` | `T \| null` | single row |
| `selectList(Dto, sql, params)` | `T[]` | many rows |
| `selectPage(Dto, sql, pagination)` | `Paginated<T>` | paged list `{ data, meta }` |
| `execute(Dto, sql, params)` | `T[]` | arbitrary projection |
| `insert / update / delete(sql, params)` | `number` | writes → affected rows |

Rows map `snake_case` columns → `camelCase` DTO fields automatically.
Dynamic SQL: chain `.where([ when(cond, 'frag = #{x}', { x }) ])` and
`.orderBy(sort, allowedColumns)` off `named(...)`.

## Transactions

Transactions are declarative via `@Transactional()` (`@nestjs-cls/transactional`).
The mapper runs every query on the CLS-active transaction, so any mapper call
inside a decorated method joins it automatically — no manual `QueryRunner`,
`DataSource`, or `manager` wiring.

- Wrap the **service** method that performs writes with `@Transactional()`.
  Never the controller (opens no transaction) and never the repository (holds no
  boundary).
- Read-only methods take no decorator.
- A write method that calls one mapper write still gets `@Transactional()` — the
  boundary is per business operation, not per statement count.
- One `@Transactional()` service method calling another joins the caller's
  transaction by default (`REQUIRED`): a single boundary, committed or rolled
  back as one unit.
- Default propagation is `REQUIRED` (reuse or create). Pass a `Propagation` value
  only when the semantics genuinely differ (e.g. `RequiresNew` for an
  independent audit write that must survive the caller's rollback). Don't set
  propagation speculatively.

```ts
import { Transactional } from '@nestjs-cls/transactional';

@Transactional()
async create(input: CreateUserDto, by: string): Promise<number> {
  return this.users.create(input, by); // mapper write joins this transaction
}
```

## DTOs & errors

- Request DTOs: validated with `class-validator`; no audit fields (clients never
  send `createdBy`/`updatedBy`).
- Response DTOs: extend `BaseDto` (`@common/dtos/base.dto`).
- Internal projections (a repo-only row shape never serialized to a client, e.g.
  a credential lookup) live in `<name>.response.dto.ts` too, keep a plain `Dto`
  suffix, and do not extend `BaseDto`.
- Throw a `DomainException` subclass (`@common/exceptions`) for business-rule
  violations. Global filters emit a `problem+json` envelope; filter registration
  order in `main.ts` is load-bearing — don't reorder it.

## Database

- `synchronize` stays `false`. Schema changes ship as migrations only —
  [`migration.md`](migration.md).

## DON'T

1. **Wrong data access** — no TypeORM repository/query-builder at runtime, no raw
   string SQL, no `${}` interpolation (only `#{}`), no manual transaction wiring
   (`QueryRunner`/`DataSource`/`manager`) — use `@Transactional()` on the service.
2. **Structural sprawl** — no umbrella folders (`utils/`/`helpers/`/`services/` at
   `src/` root), no files off the module shape, no skipping path aliases.
3. **Over-engineering** — no speculative abstractions, no config for constants, no
   error handling for impossible cases, no new dependencies, no promoting to
   `common/` before a real second consumer.
4. **Contract/registration gaps** — no unregistered module, no audit fields in
   request DTOs, no missing validation, no transaction opened in a controller, no
   `synchronize=true`.
5. **Unnecessary comments** — code self-documents. Comment only non-obvious *why*,
   never restate *what* the line does. No comment churn on untouched code.
