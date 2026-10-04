# Auth — JWT + Rotating Refresh Token (design)

**Date:** 2026-10-04
**Status:** approved, pre-implementation
**Scope:** reusable JWT authentication for the NestJS boilerplate — login, register,
refresh (rotating), logout, `me`. Access token stateless; refresh token stateful,
rotated, revocable, stored in Redis or in-memory.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Refresh strategy | Stateful + rotation (revocable). No reuse-detection (add later if needed). |
| 2 | Revocation model | Short access TTL + revoke/rotate refresh only. **No access-token blacklist** — access verified by signature only, 0 store hits per request. |
| 3 | Refresh store | `RefreshTokenStore` port, 2 adapters: **Redis** if `REDIS_URL` set, else **in-memory Map**. |
| 4 | JWT plumbing | Plain `@nestjs/jwt` + custom `JwtAuthGuard`. No Passport. |
| 5 | Transport | Access token in **body** (client sends `Authorization: Bearer`). Refresh token in **httpOnly cookie** (`SameSite=Strict`, `Secure`, `Path=/auth/refresh`). |
| 6 | Endpoints | login, register, refresh, logout, me. |
| 7 | `users` schema | Reshaped: `user_id` varchar PK (= login id), `password_hash`, `active_flag`, 4 audit. No email. |
| 8 | Hashing | **bcrypt** (72-byte input cap guarded). |
| 9 | Sessions | Multi-device — key per token (`refresh:{userId}:{jti}`). |

### In-memory store ceiling (accepted)

In-memory fallback is **single-instance + wiped on restart** — redeploy logs everyone
out, no shared state across replicas. Dev/small only; set `REDIS_URL` for prod.
Marked in code: `// ponytail: in-memory store, single-instance/dev only — set REDIS_URL for prod`.

## Dependencies (required — unavoidable for auth)

`@nestjs/jwt`, `bcrypt` (+`@types/bcrypt`), `ioredis`, `cookie-parser` (+`@types/cookie-parser`).

## Module layout — `src/modules/auth/`

```
controllers/auth.controller.ts
services/auth.service.ts
repository/auth.repository.ts
repository/sql/auth.sql
dtos/auth.request.dto.ts        # LoginDto, RegisterDto
dtos/auth.response.dto.ts       # TokenResponseDto
guards/jwt-auth.guard.ts
decorators/current-user.decorator.ts
decorators/public.decorator.ts
store/refresh-token.store.ts     # interface + injection token
store/redis-refresh-token.store.ts
store/memory-refresh-token.store.ts
auth.module.ts
```

Redis client provider lives **in the auth module** for now. Convention: do not promote
to `infra/` before a second consumer exists. Moves to `infra/redis` when one appears.
`// ponytail: redis client in auth module — move to infra/ at 2nd consumer`

## Guard strategy — secure by default

Global `JwtAuthGuard` registered via `APP_GUARD`. Every route requires a valid access
token unless marked `@Public()`. Public routes: `login`, `register`, `refresh`.

- `JwtAuthGuard`: reads `Authorization: Bearer`, verifies with `JWT_ACCESS_SECRET`,
  attaches payload to `req.user`. Skips if handler/class has `@Public()` metadata.
- `@CurrentUser()`: param decorator returning `req.user` (`{ sub: userId }`).
- `@Public()`: sets metadata read by the guard.

## `users` table (reshaped) + migration

| Col | Type | Note |
|---|---|---|
| `user_id` | `VARCHAR(20)` PK | login id / username; also the actor in `created_by`/`updated_by` |
| `password_hash` | `VARCHAR(255)` | bcrypt hash |
| `active_flag` | `CHAR(1)` default `'Y'` | `'Y'`/`'N'` |
| `created_at, created_by, updated_at, updated_by` | — | existing 4 audit fields |

Migration (per `docs/rules/migration.md`) drops old `id`/`email`/`status`, creates the
new shape. `synchronize` stays `false`.

## Tokens

- **Access**: JWT `{ sub: userId }`, TTL `JWT_ACCESS_TTL` (default `15m`), secret
  `JWT_ACCESS_SECRET`. Verified by signature only — no store lookup.
- **Refresh**: JWT `{ sub: userId, jti }`, TTL `JWT_REFRESH_TTL` (default `7d`), secret
  `JWT_REFRESH_SECRET`. Store entry `refresh:{userId}:{jti}` → `sha256(token)`; Redis
  `EXPIRE` = TTL, memory adapter keeps `expiresAt` + lazy expiry on read.

`jti` = random UUID per issue.

## Store interface

```ts
interface RefreshTokenStore {
  save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void>;
  get(userId: string, jti: string): Promise<string | null>;  // stored hash, or null
  del(userId: string, jti: string): Promise<void>;
  delAll(userId: string): Promise<void>;                      // logout-all-devices
}
```

Adapter selected at startup by `REDIS_URL` presence. Redis keys use native `EXPIRE`;
`delAll` scans `refresh:{userId}:*`. Memory adapter uses a nested `Map`.

## Flows

| Endpoint | Public | Behaviour |
|---|---|---|
| `POST /auth/register` | yes | `@Transactional()` — bcrypt-hash password, insert user (`active_flag='Y'`, `created_by`=self), then issue access + set refresh cookie (auto-login). Reject duplicate `user_id` via `DomainException`. |
| `POST /auth/login` | yes | fetch `password_hash` by `user_id` → `bcrypt.compare` → require `active_flag='Y'` → issue access + refresh, store jti, set cookie, return access in body. Invalid creds → `DomainException` (generic message). |
| `POST /auth/refresh` | yes | read refresh cookie → verify JWT (`JWT_REFRESH_SECRET`) → `store.get` + hash match → **rotate**: `del` old jti, issue new jti, `save` → new access + new refresh cookie. Missing/invalid → 401. |
| `POST /auth/logout` | no | `store.del(userId, jti)` (jti from refresh cookie) + clear cookie. |
| `GET /auth/me` | no | return user looked up by `req.user.sub`. |

Login/invalid-credentials returns a generic message (no user-enumeration).

## Env additions

`EnvironmentVariables` (validated at startup) + `.env.example`:

- `JWT_ACCESS_SECRET` — string, required
- `JWT_REFRESH_SECRET` — string, required
- `JWT_ACCESS_TTL` — string, default `15m`
- `JWT_REFRESH_TTL` — string, default `7d`
- `REDIS_URL` — string, optional (presence toggles Redis vs in-memory)

## main.ts changes

- `app.use(cookieParser())`.
- CORS `credentials: true`.
- **`CORS_ORIGIN='*'` is invalid once credentials are on** (CORS spec). Validate at
  startup: reject wildcard when credentials enabled; require explicit origin allowlist.

## User module rework (existing `modules/user/`)

Adapt to the new schema — no new endpoints:

- `user.entity.ts`: `id`→`user_id` (string PK), drop `email`, `status`→`activeFlag`, add `passwordHash`.
- DTOs + `user.sql`: `email`→`userId`, `status`→`activeFlag`.
- Controller: PK `int`→`string` (drop `ParseIntPipe`); `by:'system'`→`@CurrentUser()`.
- Password-change endpoint **out of scope** — add when a project needs it.

## Testing (smallest runnable checks — convention)

- bcrypt hash + compare round-trip (and 72-byte cap behaviour).
- access token issue + verify; expired token rejected.
- refresh rotation: old `jti` invalid after rotate, new one valid.
- `JwtAuthGuard` rejects missing/expired token, allows `@Public()`.
- memory store: save/get/del/delAll + lazy expiry.
- `active_flag='N'` blocks login.

## Out of scope (YAGNI — add when a project needs it)

Reuse-detection/token-family, access-token blacklist, password reset/change, email
verification, OAuth/social login, rate-limiting on login, RBAC/roles.
