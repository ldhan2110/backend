# AGENTS.md

NestJS 12 REST service. TypeORM + PostgreSQL. Data access via a custom
MyBatis-style SQL mapper (not the TypeORM repository API).

**Source code is the truth.** When docs and code disagree, follow the code and
report the gap before widening scope. These docs define the required patterns;
existing modules are examples, not the spec — follow the docs, not whatever a
given module happens to do.

## What to read

Always (short — read fully):

1. This file.
2. [`docs/agent-playbook.md`](docs/agent-playbook.md) — workflow, buckets, layer ownership, checklists.

Then load **only** the rule docs the task touches — don't read them all:

| Task | Also read |
|---|---|
| Any code change | [`docs/rules/convention.md`](docs/rules/convention.md) |
| DB design / table / entity / schema / migration | + [`docs/rules/migration.md`](docs/rules/migration.md) |
| File upload / download endpoint | + [`docs/rules/file-upload.md`](docs/rules/file-upload.md) |
| Cache a value / method result | + [`docs/rules/caching.md`](docs/rules/caching.md) |
| Add / edit a controller or route, or set a request limit | + [`docs/rules/rate-limit.md`](docs/rules/rate-limit.md) |
| Read-only (explain / locate) | nothing more — go straight to source |
| Setup / run / env | [`README.md`](README.md) |

Then read the task-relevant source only. New rule docs go under `docs/rules/`
and get a row here — keep each task's required reading minimal.

## Golden rule

Make the smallest change that satisfies the request. No unasked refactors,
dependencies, abstractions, or comment churn.
