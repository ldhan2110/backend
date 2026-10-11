# Rate limiting

Rate limiting is **infra**, not a feature concern. One global guard —
`ThrottlerGuard` (`@nestjs/throttler`, wired in `src/infra/security/`) — limits
**every** route by default. You do not add anything to get baseline protection.
Backend counter storage is Redis-upgradeable but in-memory by default.

**Every route is already limited** at 100 req / 60s per IP. Only touch a route
when it needs a **tighter**, **looser**, or **no** limit than the default. Do
not sprinkle `@Throttle` where the default already fits — the global default is
the point.

## When to override

| Situation | Action |
|-----------|--------|
| Normal authenticated CRUD route | Nothing — default covers it |
| Login / register / forgot-password / OTP | `@Throttle` tighter, e.g. `{ limit: 5, ttl: seconds(60) }` — brute-force surface |
| Expensive op (report export, bulk job, search) | `@Throttle` tighter on that route |
| Public high-traffic read (health, static config) | `@SkipThrottle()` or looser limit |
| Webhook from a trusted provider | `@SkipThrottle()` — provider controls its rate |
| Whole controller is sensitive (all auth routes) | `@Throttle` on the `@Controller` class |

Rule of thumb: **unauthenticated or abusable → tighten. Everything else →
leave default.**

## How to use

Import from the security barrel — never from `@nestjs/throttler` directly in
feature code:

```ts
import { Throttle, SkipThrottle, seconds, minutes } from '@infra/security';
```

Per-route tighten:
```ts
@Throttle({ default: { limit: 5, ttl: seconds(60) } })
@Post('login')
login() {}
```

Per-controller (all its routes; a route may still override its own):
```ts
@Throttle({ default: { limit: 10, ttl: seconds(60) } })
@Controller('auth')
export class AuthController {}
```

Exempt:
```ts
@SkipThrottle()
@Get('health')
health() {}
```

Cooldown — block longer once the limit trips:
```ts
@Throttle({ default: { limit: 3, ttl: seconds(60), blockDuration: seconds(300) } })
```

## Config

Env-driven, `src/config/throttle.config.ts`:

| Env | Default | Meaning |
|-----|---------|---------|
| `THROTTLE_TTL` | `60000` | sliding window, **milliseconds** |
| `THROTTLE_LIMIT` | `100` | max requests per window per IP |

`ttl` is milliseconds in config. In decorators use `seconds()` / `minutes()`
helpers (they return ms) for readability.

## Facts — don't relearn these

- Guard registered in `src/infra/security/security.module.ts` via `APP_GUARD`.
  **Order: `ThrottlerGuard` before `JwtAuthGuard`** — throttle runs before auth
  so unauthenticated floods are capped too. Preserve this order if you edit the
  providers array.
- Storage is **in-memory** (per instance). Correct for single-node; multi-node
  deployments share no counter, so each node allows the full limit. Fix: add
  `@nest-lab/throttler-storage-redis` and pass `storage:` in
  `ThrottlerModule.forRootAsync` (comment marks the spot).
- Default key is **client IP**. Per-user / per-API-key limits need a
  `ThrottlerGuard` subclass overriding `getTracker()`. Login is IP-keyed only —
  add a username-keyed tracker if credential-stuffing is a real threat.
- Guard is **HTTP-only**. GraphQL/WS/microservice transports need extra setup.
- `ThrottlerModule` is global — never re-import it or register another
  `ThrottlerGuard` in a feature module.
