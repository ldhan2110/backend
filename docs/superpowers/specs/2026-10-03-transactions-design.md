# Transactions — Design Spec

**Date:** 2026-10-03
**Status:** Approved (pending written review)
**Depends on:** SqlMapper (`src/infra/database/mapper/`)

## Problem

`SqlMapper.query()` calls `dataSource.query()`, which checks out a **random pooled
connection per call**. A transaction requires every query to run on **one
connection** wrapped in `BEGIN/COMMIT/ROLLBACK`. Today, multiple repository calls
inside a service method cannot be atomic:

```
service.register()
  ├─ userRepo.create()     → connection A  ┐  not the same tx —
  └─ profileRepo.create()  → connection B  ┘  cannot roll back together
```

## Decision

Ambient `@Transactional()` on the **service method**. Repositories stay unchanged
and auto-join the active transaction. Engine supplied by **`@nestjs-cls/transactional`**
(AsyncLocalStorage under the hood); we only wire it and make `SqlMapper` read the
active transaction instead of the raw `DataSource`.

Chosen over hand-rolling because the library gives Spring-style propagation modes,
isolation levels, and battle-tested nesting for free.

## Dependencies (3 — adapter is its own package)

```
nestjs-cls
@nestjs-cls/transactional
@nestjs-cls/transactional-adapter-typeorm
```

Peer dep `typeorm` already present. **Risk:** project pins `typeorm ^1.1.1` (unusual).
Adapter relies only on `DataSource.transaction` + `EntityManager.query`/`.queryRunner`/
`.connection`, all standard — verify install resolves and a smoke tx runs.

## Touch points (3)

### 1. Wire ClsModule — in `DatabaseModule` (already `@Global`, owns TypeORM)

```ts
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';

ClsModule.forRoot({
  plugins: [
    new ClsPluginTransactional({
      imports: [TypeOrmModule],
      adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
    }),
  ],
})
```

Added to `DatabaseModule` imports. No request middleware needed — `@Transactional()`
opens its own CLS context. `TransactionHost` becomes injectable app-wide.

### 2. SqlMapper — inject `TransactionHost`, not `DataSource`

```ts
constructor(
  private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  private readonly store: SqlStore,
) {}

// reads: selectOne / selectList / selectPage / execute all route through:
private query(text, params) {
  const { text: bound, values } = bind(text, params);
  return this.txHost.tx.query(bound, values);   // tx connection in tx, pool outside
}
```

`txHost.tx` is a TypeORM `EntityManager`. In a tx it binds the tx connection; outside
a tx it is the default manager (pool). Same call works both ways.

### 3. SqlMapper.affected() — reuse tx runner, else throwaway

Structured affected-count needs a `QueryRunner` (EntityManager.query has no count flag):

```ts
private async affected(sql, params) {
  const { text, params: p } = this.resolve(sql, params);
  const { text: bound, values } = bind(text, p);
  const runner = this.txHost.tx.queryRunner ?? this.txHost.tx.connection.createQueryRunner();
  const owns = !this.txHost.tx.queryRunner;      // only release what we created
  try {
    const result = await runner.query(bound, values, true);
    return Number(result?.affected ?? 0);
  } finally {
    if (owns) await runner.release();            // never release the tx's runner
  }
}
```

Drops the `DataSource` inject entirely (`tx.connection` is the DataSource).

## Developer usage

Decorate the **boundary** method. Repos untouched.

```ts
@Transactional()
async register(dto: CreateUserDto, by: string) {
  const id = await this.userRepo.create(dto, by);
  await this.profileRepo.create(id, by);     // same tx, auto
  return id;
}                                            // return → COMMIT, throw → ROLLBACK
```

Rules:
- Put `@Transactional()` on the outermost method that owns atomicity, never on repos.
- Default propagation `Required` → nested `@Transactional` calls join the parent tx.
- Transaction follows the `await` chain. Un-awaited / fire-and-forget work escapes it.

## Propagation (first arg) + options (second arg)

| Mode | Behavior |
|------|----------|
| `Required` | default — join existing, else start |
| `RequiresNew` | always new tx, commits independently of parent |
| `NotSupported` | suspend tx, run on pool, resume after |
| `Mandatory` | must already be in tx, else throw |
| `Never` | must not be in tx, else throw |
| `Supports` | join if exists, else run non-tx |
| `Nested` | savepoint subtransaction — **adapter-dependent, verify for TypeORM** |

```ts
@Transactional(Propagation.RequiresNew, { isolationLevel: 'Serializable' })
```

Isolation levels (pg): `ReadCommitted` (default), `RepeatableRead`, `Serializable`,
`ReadUncommitted`.

## Rollback semantics

No `rollbackFor` / `noRollbackFor` (Spring-only; JS has no checked-exception split).

```
callback throws  → ROLLBACK (any error, always)
callback returns → COMMIT
```

- Commit despite a non-critical failure → catch + swallow (return normally).
- Rollback only for specific errors → catch, return for ignorable, rethrow the rest.

Existing exception filters are unaffected: the decorator rolls back when the service
method throws, **before** the exception reaches `DomainExceptionFilter` /
`RuntimeExceptionFilter`, which then format the HTTP response. No filter changes.

## Verification

- Typecheck clean in `src/infra/database/` and `src/modules/`.
- Existing SqlMapper unit suite stays green after the `DataSource` → `TransactionHost`
  swap (mock `txHost.tx` as a fake `EntityManager`; assert reads route through
  `txHost.tx.query` and `affected()` releases only a self-created runner).
- Manual smoke: a `@Transactional` method with two writes + a forced throw leaves zero
  rows (confirms real rollback against the dev DB).

## Out of scope (YAGNI)

- DB integration / testcontainers harness (excluded by request).
- Request-scoped CLS middleware (other CLS uses beyond transactions).
- Manual mid-method commit via `TransactionHost.withTransaction` escape hatch.
- Multi-datasource / named connections.
