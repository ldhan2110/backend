# Agent Playbook

How to make a change here. Read [`AGENTS.md`](../AGENTS.md) first. The structure
below is the spec — follow it as written, not by copying whatever an existing
module currently looks like.

## Workflow

1. Classify the change into one source bucket (table below), then load only the
   rule doc(s) that bucket needs — see the task table in [`AGENTS.md`](../AGENTS.md).
2. Build the exact structure defined in this doc.
3. Keep each layer inside its ownership boundary.
4. Register the new surface in `src/app.module.ts`.
5. Update the touched doc when contract/persistence/behavior changes.
6. Verify with the narrowest check that proves the touched surface.

## Source buckets

| Bucket | Location | Use when |
|---|---|---|
| Feature module | `src/modules/<name>/` | a REST resource |
| Common building block | `src/common/` | reused across ≥2 modules |
| Infrastructure | `src/infra/<area>/` | env / db / mapper / cross-cutting wiring |
| Config | `src/config/` | typed env + enums |
| Database / schema | `src/infra/database/entities/`, `src/infra/database/migrations/` | entity or schema change → see [`rules/migration.md`](rules/migration.md) |

None fits → stop and clarify ownership. No umbrella folders (`utils/`,
`helpers/`, `services/` at `src/` root).

## Feature module structure

A feature module is exactly this shape. Lowercase `<name>` = singular resource
(e.g. `user`); the plural is the route path, declared in the controller with an
explicit version — `@Controller({ path: '<plural>', version: '1' })`, mounting
at `/v1/<plural>` (URI versioning is enabled globally in `main.ts`).

```
src/modules/<name>/
  <name>.module.ts                     declares controller + providers
  controllers/<name>.controller.ts     routes only
  services/<name>.service.ts           business logic
  repository/<name>.repository.ts      data access via SqlMapper
  repository/sql/<name>.sql            named queries
  dtos/<name>.request.dto.ts           inbound, validated
  dtos/<name>.response.dto.ts          outbound
```

No validator/guard/interceptor file per module — validation lives on the
request DTO (`class-validator`) and in the service. Add cross-cutting pieces to
`src/infra/`, not the module.

## Runtime flow

**Read:** controller → service → repository → `mapper.selectOne / selectList / selectPage` → response DTO.

**Write:** controller → service (`@Transactional()`) → repository → `mapper.insert / update / delete` → affected count.

Controllers declare routes only. They never open transactions — wrap the
**service** method with `@Transactional()` (`@nestjs-cls/transactional`); every
mapper call inside joins the same transaction automatically.

## Layer ownership

| Layer | Must | Must not |
|---|---|---|
| Controller | declare routes, bind `@Query`/`@Body`/`@Param` to request DTOs, delegate to service, set rate-limit overrides (`@Throttle`/`@SkipThrottle`) | hold logic, touch the DB, open a transaction |
| Service | business rules, orchestration, throw `DomainException` subclasses, `@Transactional()` on writes | run raw SQL, know about HTTP |
| Repository | call `SqlMapper`, keep sort/column allow-lists | hold business rules, build SQL by string concat |
| SQL file | named `-- name:` queries with `#{}` binds | contain `${}` interpolation |
| Request DTO | validated input, defaults | carry audit fields (`createdBy`, etc.) |
| Response DTO | output shape, extend `BaseDto` | expose columns the API shouldn't |
| Mapper / entities | infra-owned — use as-is | be hand-rolled or bypassed per module |

Data-access and naming rules: [`rules/convention.md`](rules/convention.md).

## Final self-check

- [ ] Path matches exactly one bucket.
- [ ] Module shape matches the tree above; registered in `src/app.module.ts`.
- [ ] Layer flow intact: controller → service → repository → mapper.
- [ ] SQL uses `#{}` bind only; client-controlled sort via allow-list.
- [ ] Schema change shipped as a migration ([`rules/migration.md`](rules/migration.md)).
- [ ] No rule in [`rules/convention.md`](rules/convention.md) violated.
- [ ] Docs + verification match the touched surface.
