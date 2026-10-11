# Cache Service — Design

Date: 2026-10-11
Status: Approved (pending spec review)

## Goal

A standardized, easy-to-use cache for developers. One injectable service plus an
optional decorator. Backend switches between Redis and in-memory based on
`REDIS_URL` — no code change required to move from dev to prod.

## Precedent

Mirrors the existing `src/infra/security/store/` pattern 1:1 (interface +
memory impl + redis impl + `Symbol` token + factory in module picking backend on
`REDIS_URL`). Same shape, different contract.

**Not shared with the refresh-token store.** Same structure, different
semantics: cache entries are disposable (FIFO-evictable); refresh tokens are not
(eviction = surprise logout). Copy the pattern, keep instances separate.

## Scope

In:
- `CacheService` with `get` / `set` / `del` / `getOrSet`.
- `@Cacheable()` decorator (works on any method, not just routes).
- Auto JSON serialization, typed generics.
- Redis + bounded in-memory backends, selected by `REDIS_URL`.
- Fail-open error handling.

Out (YAGNI — add when asked):
- Decorator variants beyond `@Cacheable` (e.g. `@CacheEvict`).
- `mget` / `mset`, tag-based invalidation groups.
- Pluggable serializer (superJSON etc.).
- Shared `RedisModule` deduping connections (flag only; see Cleanup).
- Fail-closed mode.

## Files

Under `src/infra/cache/`:

```
cache.types.ts        → CacheStore interface + CACHE_STORE Symbol
memory-cache.store.ts → bounded Map, lazy expiry + FIFO cap
redis-cache.store.ts  → ioredis, native EX ttl
cache.service.ts      → public API, wraps store, JSON codec, fail-open
cache.decorator.ts    → @Cacheable({ ttl, key? }) + static service ref
cache.module.ts       → @Global, factory picks store on REDIS_URL, sets static ref
```

Config:
```
src/config/cache.config.ts → configCache() (reuses redis.url; adds memory max)
```

## Interface

Stores deal in strings only. JSON codec lives in `CacheService` (one place, both
backends behave identically).

```ts
export const CACHE_STORE = Symbol('CACHE_STORE');

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, val: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

## Service API

```ts
get<T>(key: string): Promise<T | undefined>;          // undefined on miss
set<T>(key: string, val: T, ttlSec: number): Promise<void>;
del(key: string): Promise<void>;
getOrSet<T>(key: string, ttlSec: number, factory: () => Promise<T>): Promise<T>;
```

Usage:
```ts
const user = await cache.getOrSet(`user:${id}`, 300, () => this.repo.findById(id));
```

JSON limits (no Date/Map/Set round-trip) are accepted and documented. Values must
be JSON-serializable.

## Decorator

```ts
@Cacheable({ ttl: 300 })                             // auto key: Class.method(JSON.stringify(args))
@Cacheable({ ttl: 300, key: (args) => `user:${args[0]}` })  // explicit key
```

- Decorators run before DI exists, so `@Cacheable` cannot inject `CacheService`.
  A static `CacheService` reference is captured in `CacheModule.onModuleInit`.
  The decorator wraps the method and delegates to `getOrSet`.
- Works on any method (services, repos), which is the main use case
  (expensive DB/compute), not just controller routes.
- `ponytail:` the static ref is a deliberate service-locator shortcut; documented
  because decorators have no DI access.

Default key: `ClassName.method(JSON.stringify(args))`. Override via `key` fn.

## Backends

### memory-cache.store.ts
- `Map<string, { val: string; expiresAt: number }>`.
- Lazy expiry: on `get`, if expired → delete, return null.
- FIFO cap: when size exceeds `cache.memoryMax` (default 1000), drop
  oldest-inserted key. `ponytail:` FIFO, not LRU — swap to `lru-cache` only if a
  measured hit-rate problem appears. Devs needing real eviction set `REDIS_URL`.

### redis-cache.store.ts
- `new Redis(url)`. `set` uses `EX` ttl. `del` native. `get` native.
- `onModuleDestroy` → `client.quit()`.

## Config

```ts
// src/config/cache.config.ts
export const configCache = () => ({
  cache: {
    memoryMax: parseInt(process.env.CACHE_MEMORY_MAX || '1000'),
  },
});
```

- Redis URL reuses existing `redis.url` from `env.config.ts`.
- Add `CACHE_MEMORY_MAX?` (optional int) to `EnvironmentVariables`.
- Register `configCache` in `env.module.ts` `load: [...]`.

## Wiring

```ts
@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        return url
          ? new RedisCacheStore(new Redis(url))
          : new MemoryCacheStore(config.get<number>('cache.memoryMax') ?? 1000);
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule implements OnModuleInit { ... sets static ref ... }
```

Add `CacheModule` to `InfraModule.imports`. `@Global` → `CacheService` injectable
everywhere without re-import.

## Error handling — fail-open

Cache is an optimization, never a source of truth. Any backend error → behave as
cache miss, log `warn`, let the real path run. The cache layer never throws.

| Scenario | Behavior |
|----------|----------|
| Backend down on `get` | Return `undefined` (miss). Caller falls through. |
| Backend down on `set` / `del` | Swallow, log `warn`. Request succeeds. |
| Backend down in `getOrSet` | Run `factory()`, return real value; try to cache, ignore failure. |
| `JSON.parse` fails (corrupt entry) | Treat as miss, `del` bad key, return `undefined`. |
| Decorated method, cache errors | Fall through to real method. |
| `REDIS_URL` set but unreachable at boot | ioredis retries in background; ops fail-open meanwhile; no boot crash. |

Consequence: under a Redis outage, `getOrSet` / `@Cacheable` run the factory every
call — correct results, just no caching. Documented, acceptable.

## Testing

One self-check (memory backend only, no Redis needed in CI):
- `set` → `get` roundtrip (typed object).
- TTL expiry returns `undefined` after deadline.
- FIFO cap evicts oldest when over `memoryMax`.
- `getOrSet` runs factory once, second call hits cache.
- `@Cacheable` caches a method result.
- Fail-open: store throwing on `get` → `getOrSet` still returns factory value.

No frameworks beyond the project's existing test setup. Assert-based.

## Cleanup (flag, not now)

Both `SecurityModule` and `CacheModule` create their own `new Redis(url)` → two
connections. If a 3rd consumer appears, extract a shared `RedisModule` providing
one client. `ponytail:` deferred until there's a 3rd consumer.
