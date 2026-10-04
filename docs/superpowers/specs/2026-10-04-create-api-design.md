# create-api skill + command — design

An adaptive scaffolding skill that turns a plain-language API description into a
convention-compliant feature module. Invoked with `/create-api <description>`.

## Goal

A developer describes what they want ("CRUD for products", "list orders with
pagination and status filter"). The skill interviews them for the gaps, inspects
the live DB, then generates the full module tree exactly as the playbook and
`convention.md` require — controller → service → repository → SqlMapper → DTOs,
plus entity + migration when the table is new.

The skill is the authority on structure; the user's description only supplies
intent (resource, fields, which endpoints). Every generated file obeys
`docs/rules/convention.md` and the module shape in `docs/agent-playbook.md`.

## Deliverables

Two files:

- `.claude/skills/create-api/SKILL.md` — the skill logic (folder already exists).
- `.claude/commands/create-api.md` — thin `/create-api` command that invokes the
  skill, forwarding the user's description as the argument.

## Flow

```
1. Parse description → resource name (singular) + guessed fields + guessed endpoints.
2. Inspect DB via postgres MCP (DATABASE_URI from .mcp.json):
   ├─ table exists → read columns/types/nullability; derive DTO + entity fields from the live schema.
   └─ table missing → design schema per migration.md, confirm with user, generate entity + migration.
3. Adaptive interview (one question at a time, branches on the description):
   - a list/"get many" endpoint → ask: paginated? sortable columns? filters / keyword search?
   - a create/update endpoint → ask: which fields required vs optional + defaults.
   - ambiguous field types or resource name → ask.
   - SKIP any question already answered by the description.
4. Generate the module tree (exact playbook shape) + register in src/app.module.ts.
5. Verify: typecheck touched files + confirm registration → report pass/fail.
```

### Step 1 — Parse

Extract the singular resource name (route path is its plural, declared in the
controller). Make a first guess at fields and which of the five operations
(list, getById, create, update, delete) the description implies. Guesses only
seed the interview; they are confirmed, never assumed silently.

### Step 2 — DB inspection

Read `DATABASE_URI` from `.mcp.json` and use the postgres MCP to check whether
the table exists.

- **Exists:** list columns, types, nullability. Field types in the response DTO
  and (if needed) the entity are taken from the live schema, not guessed.
- **Missing:** design the schema following `docs/rules/migration.md` (snake_case
  plural table, `id` PK, `BaseEntity` audit columns with `timestamptz`,
  deliberate types/nullability, FK + index where warranted). Present the proposed
  table to the user, get approval, then generate the entity under
  `src/infra/database/entities/` and a migration under
  `src/infra/database/migrations/`. `synchronize` stays `false`.

MCP use is **read-only** — inspection only. No schema or data writes through MCP;
schema changes ship as migrations.

### Step 3 — Adaptive interview

One question at a time. Questions branch on what the description contains and
skip whatever it already answered:

- List endpoint present → paginated? which columns sortable (→ `SORTABLE`
  allow-list)? filters / keyword search?
- Create/update present → required vs optional fields, defaults.
- Unclear field type or resource name → ask.

### Step 4 — Generate

Feature module, exact shape (modeled on the existing `user` module):

```
src/modules/<name>/
  <name>.module.ts                     declares controller + providers
  controllers/<name>.controller.ts     routes only; ParseIntPipe on :id
  services/<name>.service.ts           logic; @Transactional() on writes
  repository/<name>.repository.ts      SqlMapper; SORTABLE allow-list
  repository/sql/<name>.sql            -- name: queries; #{} binds only
  dtos/<name>.request.dto.ts           Create + Query DTO; class-validator
  dtos/<name>.response.dto.ts          <Name>Dto extends BaseDto
```

Table-new case also emits the entity + migration from step 2.

Register the module in `src/app.module.ts`.

### Step 5 — Verify

Run the project's typecheck/build on the touched files, confirm the module is
registered, and report pass/fail. No tests are generated unless the user asks.

## Rules baked into generation

From `convention.md` (authoritative) — the skill never emits code that violates
these:

- SqlMapper only; `#{}` binds, never `${}`; no TypeORM repository/query-builder
  at runtime.
- Path aliases `@infra` `@config` `@common` `@modules`, never relative imports.
- Request DTOs validated with `class-validator`, no audit fields; response DTOs
  extend `BaseDto`.
- Writes wrap the **service** method with `@Transactional()`; controllers open no
  transaction; no manual `QueryRunner`/`DataSource` wiring.
- Client-controlled sort via a `SORTABLE` allow-list.
- Business-rule violations throw a `DomainException` subclass.
- **No auth guards** — the boilerplate has no auth module yet; endpoints are
  generated plain.
- No umbrella folders, no files off the module shape, no speculative
  abstractions.

## Out of scope

- Authentication / guards (no auth module exists yet).
- Test generation (only on explicit request).
- Schema or data mutation through the postgres MCP (inspection only).
- Non-REST surfaces (GraphQL, queues, etc.).
