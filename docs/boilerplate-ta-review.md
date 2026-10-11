# Boilerplate TA Review

**Date:** 2026-10-11
**Scope:** NestJS 12 + TypeORM + PostgreSQL backend boilerplate
**Question:** Ready for a developer to jump into enterprise application development?

---

## Verdict

**~70% there. Strong foundation, NOT enterprise-ready to ship.**

- **For a dev starting feature work:** Yes — jump in. DX is excellent; layering, conventions, auth and scaffolding beat most teams' day-500 code.
- **For an enterprise app shipped to prod:** No, not yet. Missing enterprise table-stakes (tests, authz, hardening). ~1–2 weeks of hardening.

---

## Strengths (production-grade)

### Architecture
- Clean layering: controller → service → repository → `SqlMapper`.
- Clear layer ownership (`AGENTS.md` + `docs/rules`), path aliases, proper DI.
- No god-objects.

### Auth (genuinely well done)
- Dual JWT secrets, enforced-different at boot — `src/infra/security/services/token.service.ts:26`.
- Refresh rotation + SHA-256-hashed storage, revoke-on-use — `src/modules/auth/services/auth.service.ts:53-58`.
- Refresh cookie `httpOnly + secure + sameSite:strict`, path-scoped to `/auth/refresh`.
- bcrypt password hashing, swappable refresh store (memory/redis), `@Transactional` on register.

### Data layer
- Custom MyBatis-style SQL mapper: named queries, param binding, pagination with count, camel mapping.
- Tx-aware affected-rows — reuses the tx runner, releases only the runner it owns (`sql-mapper.ts:118-143`).

### Error handling
- Domain vs runtime filter split, `application/problem+json`, stable error codes.

### Tooling & the rest
- Strict `tsconfig`, oxlint type-aware, `ValidationPipe` (whitelist + transform).
- Migrations (no auto-sync = correct), Winston + DB query timing, Swagger.
- Dockerfile, CORS credential-aware, audit columns in base entity.
- `create-api` scaffolding skill for convention-compliant modules.

---

## Blockers for "enterprise" (ranked)

| # | Blocker | Evidence | Why it matters |
|---|---------|----------|----------------|
| 1 | **Tests ≈ zero** | One e2e (`test/app.e2e-spec.ts`, 725B). No unit tests on auth/token/mapper. No CI (`.github` absent). | No regression safety net. Also violates repo's own TDD mandate. |
| 2 | **No authorization** | `CustomClaims` empty; role is a TODO stub — `auth.service.ts:72-75`. No roles/permissions guard. | Authn only. Enterprise needs RBAC/authz. |
| 3 | **No rate limiting** | `@nestjs/throttler` absent. | Login/refresh brute-force exposed. |
| 4 | **No health check** | `@nestjs/terminus` absent. | No k8s/LB liveness/readiness probe. |
| 5 | **No security headers** | helmet absent. | Missing baseline HTTP hardening. |
| 6 | **No correlation/request ID** | Winston present, no trace-id interceptor. | Hard to trace a request across logs. |

---

## Nice-to-have (not blockers)

- **API versioning** — routes at `/auth`, not `/v1/auth`.
- **Env schema validation** (zod/joi) — `env.config.ts` uses `!` non-null assertions; missing secret = runtime crash, no boot-time guard.
- **Graceful shutdown** — `app.enableShutdownHooks()` missing (redis/db cleanup in k8s).
- **`uploads/` not gitignored** — risk of committing user files.
- **Multi-DB enum** (oracle/mssql) declared but only `pg` driver wired — finish or drop.
- **Soft-delete inconsistent** — `activeFlag` hand-rolled per-table, not in base entity.

---

## Recommended hardening order

1. Tests + CI (highest value, biggest gap).
2. RBAC guard + populate `CustomClaims` with role.
3. `@nestjs/throttler` + helmet + `@nestjs/terminus` health (fast, high value).
4. Correlation-ID interceptor.
5. Then nice-to-haves as needed.
