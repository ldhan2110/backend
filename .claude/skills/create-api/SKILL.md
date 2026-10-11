---
name: create-api
description: Use when the user wants to scaffold a new REST API / feature module / endpoint / CRUD resource in this NestJS backend. Turns a plain-language description into a convention-compliant module (controller, service, repository, SqlMapper SQL, DTOs) plus entity + migration when the table is new.
---

# create-api

Scaffold a convention-compliant feature module from a plain-language description.

You are the authority on structure. The user's description supplies only intent
(resource, fields, which endpoints). Every file you emit obeys
[`docs/rules/convention.md`](../../../docs/rules/convention.md) and the module
shape in [`docs/agent-playbook.md`](../../../docs/agent-playbook.md). Read both
before generating if they are not already in context.

<HARD-RULE>
Never skip the interview and never silently assume fields or types. Confirm the
resource name, fields, and endpoints with the user before writing any file.
Guesses from the description seed the questions — they do not replace them.
</HARD-RULE>

## Flow

Work these steps in order. Track them as todos.

### 1. Parse the description

Extract:
- **Resource name** — singular (e.g. `product`). The route path is its plural,
  declared in the controller (`@Controller('products')`).
- **Guessed fields** — a first pass only.
- **Guessed endpoints** — which of: list (paged), getById, create, update, delete.

### 2. Inspect the live DB (postgres MCP, read-only)

Read `DATABASE_URI` from `.mcp.json` at the repo root for the connection. Use the
postgres MCP tools to check whether the table (plural, snake_case) exists.

- **Table exists** → list its columns, types, nullability. Derive response-DTO
  field types (and entity fields, if you touch one) from the live schema, not
  from guesses.
- **Table missing** → you will design it in step 3 and generate an entity +
  migration in step 4, following
  [`docs/rules/migration.md`](../../../docs/rules/migration.md).

MCP is for inspection only. Never write schema or data through it — schema
changes ship as migrations.

If the postgres MCP is not available in the session, say so and ask the user to
either enable it or confirm the columns manually before proceeding.

### 3. Adaptive interview (one question at a time)

Ask only what the description left open. Branch on the endpoints:

- **List / "get many"** → paginated? which columns sortable (becomes the
  `SORTABLE` allow-list)? filters or keyword search?
- **Create / update** → which fields required vs optional, and defaults.
- **Table missing** → present the proposed schema (snake_case plural table, `id`
  PK, `BaseEntity` audit columns with `timestamptz`, deliberate types/nullability,
  FK + index where warranted) and get approval before generating the migration.
- **Ambiguous** field type or resource name → ask.

Skip any question the description already answered. Prefer multiple-choice.

### 4. Generate

Feature module — this exact shape (model on the existing `user` module):

```
src/modules/<name>/
  <name>.module.ts                     declares controller + providers
  controllers/<name>.controller.ts     routes only; ParseIntPipe on :id
  services/<name>.service.ts           logic; @Transactional() on writes; writes return SuccessDto
  repository/<name>.repository.ts      SqlMapper; SORTABLE allow-list
  repository/sql/<name>.sql            -- name: queries; #{} binds only
  dtos/<name>.request.dto.ts           Create + Query DTO; class-validator
  dtos/<name>.response.dto.ts          <Name>Dto extends BaseDto
```

Table-new case also emits:
```
src/infra/database/entities/<name>.entity.ts
src/infra/database/migrations/<timestamp>-Create<Name>.ts
```

Then register the module in `src/app.module.ts`.

Generate only the endpoints the user confirmed — drop the rest of the CRUD set.

### 5. Verify

- Typecheck / build the touched files.
- Confirm the module is registered in `src/app.module.ts`.
- Report pass/fail with the file list.

Do not generate tests unless the user asks.

## Non-negotiable generation rules (from convention.md)

- **Data access:** `SqlMapper` only (inject from `@infra/database/mapper`). `#{}`
  binds, never `${}`. No TypeORM repository or query-builder at runtime.
- **Imports:** path aliases `@infra` `@config` `@common` `@modules` — never
  relative `../../..`.
- **DTOs:** request DTOs validated with `class-validator`, no audit fields
  (clients never send `createdBy`/`updatedBy`). Response DTOs extend `BaseDto`
  (`@common/dtos/base.dto`).
- **Write responses:** `create` / `update` / `delete` service + controller
  methods return `SuccessDto` (`@common/dtos/success.dto`, `{ success: true }`),
  never the raw affected-row count. The mapper write still returns `number`; the
  service maps it — throw a `DomainException` when a required row was not
  affected (0 rows), otherwise `return { success: true }`.
- **Transactions:** wrap the **service** write method with `@Transactional()`
  (`@nestjs-cls/transactional`). Never the controller or repository. No manual
  `QueryRunner`/`DataSource` wiring. Default propagation `REQUIRED` — set a
  `Propagation` value only when semantics genuinely differ.
- **Sort:** client-controlled sort columns pass through a `SORTABLE` allow-list.
- **Errors:** throw a `DomainException` subclass (`@common/exceptions`) for
  business-rule violations.
- **Auth:** none. The boilerplate has no auth module — generate endpoints plain,
  no guards.
- **Structure:** no umbrella folders, no files off the module shape, no
  speculative abstractions, no new dependencies.

## Reference template

The `user` module (`src/modules/user/`) is the working reference. Read it when you
need the exact idiom for dynamic `.where([...])` filters, `.orderBy(sort,
SORTABLE)`, `selectPage`, `named('<file>.<query>')`, and nested
`PaginationDto`/`SortDto` on the query DTO.
