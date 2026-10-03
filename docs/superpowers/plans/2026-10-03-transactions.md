# Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable atomic multi-statement transactions via an ambient `@Transactional()` decorator, with repositories unchanged.

**Architecture:** Add `@nestjs-cls/transactional` (AsyncLocalStorage engine) wired through a TypeORM adapter in the global `DatabaseModule`. `SqlMapper` stops injecting `DataSource` and instead reads the active transaction's `EntityManager` from `TransactionHost`, so every query auto-routes to the tx connection when inside `@Transactional`, or the pool otherwise.

**Tech Stack:** NestJS, TypeORM, `@nestjs-cls/transactional`, `nestjs-cls`, PostgreSQL, pnpm.

## Global Constraints

- Package manager: **pnpm** (`pnpm add ...`, never npm/yarn).
- No test harness in repo — verification is **typecheck + build + manual smoke**, no jest specs (per user).
- TypeORM is pinned `^1.1.1` (unusual) — adapter must resolve against it; `EntityManager.query` / `.queryRunner` / `.connection` confirmed present.
- Path aliases: `@infra/*`, `@common/*`, `@config/*` (see `tsconfig.json`).
- Typecheck command: `pnpm exec tsc --noEmit -p tsconfig.json`.
- Build command: `pnpm build`.
- Commit attribution footer on every commit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- Modify: `package.json` — 3 new deps (via pnpm).
- Modify: `src/infra/database/database.module.ts` — register `ClsModule` + transactional plugin.
- Modify: `src/infra/database/mapper/sql-mapper.ts` — `DataSource` → `TransactionHost`; `query()` and `affected()` route through `txHost.tx`.
- (Optional, temporary) `src/modules/user/services/user.service.ts` — throwaway smoke method, reverted after proof.

---

## Task 1: Install deps and wire the transactional engine

**Files:**
- Modify: `package.json` (via `pnpm add`)
- Modify: `src/infra/database/database.module.ts`

**Interfaces:**
- Consumes: existing `TypeOrmModule.forRootAsync` registration (provides `DataSource` under `getDataSourceToken()`).
- Produces: app-wide injectable `TransactionHost<TransactionalAdapterTypeOrm>` and the `@Transactional()` decorator.

- [ ] **Step 1: Install the three packages**

Run:
```bash
pnpm add nestjs-cls @nestjs-cls/transactional @nestjs-cls/transactional-adapter-typeorm
```
Expected: all three added to `dependencies`; pnpm reports no peer-dep errors for `typeorm`. If a peer warning for typeorm appears, note it and continue — the adapter only uses standard `DataSource`/`EntityManager` API.

- [ ] **Step 2: Register ClsModule in DatabaseModule**

Edit `src/infra/database/database.module.ts`. Add imports at top:
```ts
import { ClsModule } from "nestjs-cls";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
```
Change the `@nestjs/typeorm` import to also pull `getDataSourceToken`:
```ts
import { getDataSourceToken, TypeOrmModule } from "@nestjs/typeorm";
```
Add `ClsModule.forRoot(...)` to the module `imports` array, after the existing `TypeOrmModule.forRootAsync(...)` block:
```ts
ClsModule.forRoot({
  plugins: [
    new ClsPluginTransactional({
      imports: [TypeOrmModule],
      adapter: new TransactionalAdapterTypeOrm({
        dataSourceToken: getDataSourceToken(),
      }),
    }),
  ],
}),
```
Leave `providers`, `exports`, and `onModuleInit` unchanged.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new errors in `src/infra/database/`.

- [ ] **Step 4: Boot to prove DI resolves**

Run: `pnpm start` (let it reach "Nest application successfully started", then Ctrl-C).
Expected: no `TransactionHost`/`ClsPluginTransactional` provider resolution errors at startup.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/infra/database/database.module.ts
git commit -m "feat(db): wire @nestjs-cls/transactional engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Make SqlMapper transaction-aware

**Files:**
- Modify: `src/infra/database/mapper/sql-mapper.ts`

**Interfaces:**
- Consumes: `TransactionHost<TransactionalAdapterTypeOrm>` from Task 1.
- Produces: unchanged public `SqlMapper` API (`named`, `selectOne`, `selectList`, `selectPage`, `execute`, `insert`, `update`, `delete`) — now tx-aware. No consumer signature changes.

- [ ] **Step 1: Swap the constructor injection**

In `src/infra/database/mapper/sql-mapper.ts`, replace the `DataSource` import:
```ts
// remove: import { DataSource } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
```
Replace the constructor:
```ts
constructor(
  private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  private readonly store: SqlStore,
) {}
```

- [ ] **Step 2: Route reads through the active tx manager**

Replace the private `query` method:
```ts
private query(text: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const { text: bound, values } = bind(text, params);
  return this.txHost.tx.query(bound, values);
}
```
(`txHost.tx` is the tx `EntityManager` inside a transaction, the default manager — pool — outside one.)

- [ ] **Step 3: Route affected-count through the tx runner, else a throwaway**

Replace the private `affected` method:
```ts
private async affected(sql: Sql, params?: object): Promise<number> {
  const { text, params: p } = this.resolve(sql, params);
  const { text: bound, values } = bind(text, p);
  // Structured result (affected count) is exposed on QueryRunner, not EntityManager.query.
  // In a tx, reuse the tx's runner so the write participates and commits with it.
  const runner = this.txHost.tx.queryRunner ?? this.txHost.tx.connection.createQueryRunner();
  const owns = !this.txHost.tx.queryRunner;
  try {
    const result = await runner.query(bound, values, true);
    return Number(result?.affected ?? 0);
  } finally {
    if (owns) await runner.release(); // never release the tx's own runner
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: zero errors. Confirm `DataSource` is no longer referenced in this file.

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: build succeeds; `.sql` files copied to `dist` as before.

- [ ] **Step 6: Commit**

```bash
git add src/infra/database/mapper/sql-mapper.ts
git commit -m "feat(db): route SqlMapper through TransactionHost for tx awareness

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Manual rollback smoke (temporary — revert after proof)

No permanent sample code and no jest test (per user). This task proves atomicity by hand, then reverts.

**Files:**
- Modify (temporary): `src/modules/user/services/user.service.ts`

- [ ] **Step 1: Add a throwaway transactional method**

In `UserService`, add the import and method (temporary):
```ts
import { Transactional } from '@nestjs-cls/transactional';

@Transactional()
async _smokeRollback(input: CreateUserDto, by: string) {
  await this.users.create(input, by);   // insert 1
  throw new Error('forced rollback');   // must undo insert 1
}
```

- [ ] **Step 2: Note the current row count**

Run (psql against the dev DB, adjust table/schema name if different):
```bash
psql "$DATABASE_URL" -c "select count(*) from users;"
```
Record the number.

- [ ] **Step 3: Invoke the method once**

Simplest path: temporarily call `_smokeRollback` from an existing controller route, or add a throwaway route, start the app, hit it once, and expect a 500. (Ponytail: pick whichever is fewer edits in the current controller.) The thrown error is expected.

- [ ] **Step 4: Confirm rollback**

Run the same count query:
```bash
psql "$DATABASE_URL" -c "select count(*) from users;"
```
Expected: **unchanged** from Step 2 — the insert was rolled back by the thrown error. If the count increased, transactions are NOT working — stop and debug Task 1/2 wiring before reverting.

- [ ] **Step 5: Revert the throwaway code**

Remove `_smokeRollback`, its import, and any temporary route/call. Confirm:
```bash
git diff --stat   # should show no remaining changes under src/modules/user/
```

- [ ] **Step 6: Final typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: zero errors. Nothing to commit (revert left the tree clean).

---

## Self-Review

- **Spec coverage:** deps (Task 1), ClsModule wiring (Task 1), SqlMapper `DataSource`→`TransactionHost` (Task 2), `affected()` runner branch (Task 2), dev usage / propagation / rollback semantics (documented in spec, no code needed — decorator is library-provided), rollback proof (Task 3). Excluded by request: testcontainers integration test, request-scoped middleware, manual commit escape hatch, multi-datasource. ✔
- **Placeholder scan:** none.
- **Type consistency:** `TransactionHost<TransactionalAdapterTypeOrm>` used identically in Tasks 1 and 2; `txHost.tx` (EntityManager) `.query` / `.queryRunner` / `.connection` all verified present.
