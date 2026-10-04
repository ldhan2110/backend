# Database & Migration Rules

Mandatory before any entity, table, or schema change. `synchronize` is `false`,
so **nothing reaches the database except through a migration**.

## Inspect the live DB first (postgres MCP)

A `postgres` MCP server is configured in [`.mcp.json`](../../.mcp.json). Use it to
check the **real** database before writing anything — never design a change blind.

Use it to:

- List schemas / tables and get object details — columns, types, indexes,
  constraints, foreign keys — for the tables you touch.
- Run **read-only** `SELECT` to confirm current shape, row counts, existing data.
- `EXPLAIN` a query and use index/health analysis before adding or changing an index.

**Read-only.** The server runs in `unrestricted` access mode, so it *can* write —
do not. Never `CREATE`/`ALTER`/`DROP` or mutate data through the MCP. Every schema
change goes through a migration file (below); the MCP is for inspection and
verification only.

## Model

- Entities in `src/infra/database/entities/` are the schema source. TypeORM diffs
  them against the DB to generate migrations; they are not applied at runtime
  (runtime data access is the SqlMapper — see [`convention.md`](convention.md)).
- Migrations live in `src/infra/database/migrations/`.
- The CLI uses its own `data-source.ts` (Nest's DI is not available to the CLI).
  It reads env via `process.loadEnvFile()`, so a valid `.env` must be present and
  point at the same database the MCP inspects.

## Schema design rules

- Table names: `snake_case`, plural (e.g. `users`). Column names: `snake_case`.
  They map to `camelCase` DTO fields automatically — keep that contract intact.
- Primary key: `id`.
- Every business table carries the audit columns from `BaseEntity`
  (`created_at`, `created_by`, `updated_at`, `updated_by`). Timestamps are
  `timestamptz`. Reuse `BaseEntity`; don't redeclare them per entity.
- Choose explicit column types and `NOT NULL`/defaults deliberately — match what
  the live DB and existing tables already use (verify via the MCP).
- Add a foreign key for every real reference, and index foreign keys and the
  columns the module filters or sorts on.

## Workflow

1. **Inspect** the live DB via the postgres MCP — current columns, types,
   indexes, constraints for the tables involved.
2. Add or edit the entity under `src/infra/database/entities/`.
3. Generate from the diff:
   `pnpm migration:generate src/infra/database/migrations/<PascalCaseName>`
   Use `migration:create <...>` only for an empty, hand-written migration (data
   backfills, raw changes TypeORM can't diff).
4. **Read the generated `up`/`down` SQL** and cross-check it against what the MCP
   showed — TypeORM diffs can emit destructive or wrong statements. Fix first.
5. Apply: `pnpm migration:run`. Verify with `pnpm migration:show` and by
   re-inspecting the tables through the MCP.
6. Roll back the last batch with `pnpm migration:revert` if needed.

Command definitions: `package.json` scripts. Human walkthrough: [`../../README.md`](../../README.md) §6.

## DON'T

1. No `synchronize=true`, ever — not in `data-source.ts`, not in the Nest
   `TypeOrmModule` config.
2. No schema or data changes through the postgres MCP — inspection only. Schema
   changes are migration files; nothing else.
3. Never edit a migration that has already run or been committed/shared — write a
   new one.
4. Don't run a generated migration without reading its SQL first.
5. Don't hand-edit the DB schema outside a migration.
6. Name migrations in descriptive PascalCase (e.g. `AddUserStatusIndex`).
