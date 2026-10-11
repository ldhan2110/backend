# Caching

Caching is **infra**, not a feature concern. One service — `CacheService`
(`src/infra/cache/`) — is the only cache API. `CacheModule` is `@Global`, so
inject `CacheService` anywhere without importing the module. Backend is
Redis when `REDIS_URL` is set, else an in-process LRU (dev/test).

**Fail-open:** every cache error (backend down, timeout, serialization) is
logged at `warn` and treated as a miss. The cache never throws, never breaks a
request. Treat it as an optimization, never a source of truth.

## Layout

```
src/infra/cache/
  cache.module.ts                  @Global; wires NestCacheModule store, provides+exports CacheService
  services/cache.service.ts        get / set / del / getOrSet — typed, fail-open
  decorators/cache.decorator.ts    @Cacheable({ ttl, key? }) — cache a method result
```

`CacheModule` is already wired through `InfraModule` — no `app.module` change.

## Two ways to cache

### 1. `@Cacheable` — cache a whole method result

Least code. Put it on a method whose return depends only on its args.

```ts
import { Cacheable } from '@infra/cache/decorators/cache.decorator';

@Cacheable()                                              // default TTL, auto key
async findById(id: string) { ... }

@Cacheable({ ttl: 300_000 })                              // key: Class.method(JSON args)
async findById(id: string) { ... }

@Cacheable({ ttl: 300_000, key: (a) => `user:${a[0]}` })  // explicit key
async findById(id: string) { ... }
```

TTL is optional everywhere — omit it to use `CACHE_DEFAULT_TTL`.

Give an explicit `key` when the auto key (`JSON.stringify(args)`) is fragile —
non-primitive args, args with volatile fields, or when you need a stable
namespace to invalidate (`cache.del('user:' + id)`).

### 2. `CacheService` — manual control

Inject it when you need read-through with side effects, or targeted
invalidation on writes.

```ts
constructor(private readonly cache: CacheService) {}

// read-through
const user = await this.cache.getOrSet(`user:${id}`, 300_000, () => this.repo.findById(id));

// invalidate on write
async update(id: string, dto: UpdateDto) {
  await this.repo.update(id, dto);
  await this.cache.del(`user:${id}`); // next read repopulates
}
```

## Contract

| Piece | Rule |
|---|---|
| `get<T>(key)` | `T \| undefined`; miss or error → `undefined` |
| `set<T>(key, val, ttlMs?)` | fire-and-forget; error swallowed (warn) |
| `del(key)` | remove one key; error swallowed (warn) |
| `getOrSet<T>(key, ttlMs, factory)` | hit → cached; miss → run `factory`, cache, return |
| `@Cacheable({ ttl?, key? })` | wraps the method in `getOrSet`; works on any method |
| **TTL unit** | **milliseconds** (`300_000` = 5 min); omit it → `CACHE_DEFAULT_TTL` |
| Values | must be JSON-serializable — `Date` → string, class instance → plain object on read |
| Stampede | `getOrSet` is **not** atomic: concurrent misses each run `factory`. Fine for a cache. Add a lock only if a hot key measurably hammers the origin. |
| Invalidation | manual — there is no tag/pattern purge. Own your key scheme; `del` exact keys on write. |

## Config (env)

| Var | Meaning | Default |
|---|---|---|
| `REDIS_URL` | Redis connection; unset → in-memory LRU | *(empty)* |
| `CACHE_MEMORY_MAX` | in-memory LRU max entries (ignored when `REDIS_URL` set — Redis evicts itself) | `1000` |
| `CACHE_DEFAULT_TTL` | fallback TTL (ms) when a write omits one | `60000` (1 min) |

In-memory cache is **per-process** and dies on restart — don't rely on it in
multi-instance deploys; set `REDIS_URL` there.

## Self-check

- [ ] TTL passed in **milliseconds**.
- [ ] Cached value is JSON-serializable; readers tolerate `Date`-as-string.
- [ ] Write paths `del` the keys they invalidate (or accept TTL staleness).
- [ ] No business logic depends on a hit — fail-open means the value can vanish.
- [ ] Key scheme is stable and namespaced enough to invalidate.
