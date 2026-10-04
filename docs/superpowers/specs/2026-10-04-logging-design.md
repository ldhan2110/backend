# Logging Design — Winston App + SQL Logging

**Date:** 2026-10-04
**Status:** Approved, pending implementation

## Goal

Two independent logging concerns for the NestJS backend:

1. **App logging** — leveled (info / warn / error / debug), formatted for console, prod-ready for log aggregators.
2. **DB/SQL logging** — SqlMapper logs every executed query (bound SQL + params + timing + calling service) for debugging, on its own switch.

The two are controlled by **separate knobs** so turning on SQL debug noise does not change app log verbosity, and vice versa.

## Decisions

| Concern | Choice |
|---------|--------|
| Engine | `winston` + `nest-winston` (prod deploy needs transports/JSON) |
| App format (dev) | custom `printf`: `[timestamp][LEVEL][Context]: message`, colorized level |
| App format (prod) | `winston.format.json()` — same fields (level, context, message, timestamp) |
| App level knob | `LOG_LEVEL` env, default `info` |
| DB log knob | `DB_LOGGING` env (bool), independent of `LOG_LEVEL` |
| SQL logger | **dedicated** Winston logger instance, level always `debug`, gated purely by `DB_LOGGING` (option A — true independence) |
| Caller detection | stack-trace parse → `/(\w+Service)\b/`, fallback `SqlMapper` (option A) |
| Timing | include `(Nms)` per query via `performance.now()` |
| Packaging | `LoggerModule` under `src/infra/`, `@Global`, registered in `InfraModule` |

## Structure

```
src/infra/logger/
  logger.module.ts      # @Global; WinstonModule.forRootAsync; exports providers
  winston.config.ts     # factory: dev printf / prod json; level = LOG_LEVEL
  db-logger.ts          # dedicated Winston logger (level debug) for SqlMapper
  caller.ts             # stack-trace caller parse + unit self-check
```

### logger.module.ts
- `@Global()` module.
- Imports `WinstonModule.forRootAsync({ inject: [ConfigService], useFactory: buildWinstonOptions })`.
- Exports the Winston providers so `WINSTON_MODULE_NEST_PROVIDER` is injectable app-wide.
- Also provides/exports the dedicated **DB logger** token for `SqlMapper`.
- Registered in `src/infra/infra.module.ts` imports array, beside `DatabaseModule`.

### winston.config.ts
```
buildWinstonOptions(config: ConfigService) -> WinstonModuleOptions
  level  = config.get('logging.level', 'info')
  isProd = process.env.NODE_ENV === 'production'   // matches .env.example lowercase convention
  format = isProd
    ? combine(timestamp(), json())
    : combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize({ level:true }),
              printf(({timestamp, level, context, message}) =>
                `[${timestamp}][${level.toUpperCase()}][${context ?? 'App'}]: ${message}`))
  transports = [ new winston.transports.Console({ format }) ]
```

### db-logger.ts
- A standalone `winston.createLogger({ level: 'debug', transports: [Console] })`, same dev/prod format rule as app.
- Context is set per-call to the detected caller service name.
- Only ever written to when `DB_LOGGING === true` (checked in SqlMapper, so the logger itself is cheap/idle otherwise).

### caller.ts
```
callerService(): string
  stack = new Error().stack?.split('\n') ?? []
  for frame in stack:
    m = frame.match(/(\w+Service)\b/)
    if m and m[1] !== 'SqlMapper': return m[1]
  return 'SqlMapper'
```
**ponytail:** heuristic with a known ceiling — minified/deeply-async stacks can blur frames → falls back to `SqlMapper`. Acceptable because it runs only on the debug path (`DB_LOGGING=true`).

## SqlMapper changes

`src/infra/database/mapper/sql-mapper.ts`:
- Inject `ConfigService` (read `DB_LOGGING` once → `private readonly dbLog: boolean`) and the dedicated DB logger.
- The two existing choke points already centralize execution:
  - `query()` — all reads (`selectOne`, `selectList`, `selectPage`, `execute`).
  - `affected()` — all writes (`insert`, `update`, `delete`).
- In each, when `this.dbLog`:
  - resolve caller via `callerService()`.
  - `const t0 = performance.now()` before exec, `ms = (performance.now()-t0).toFixed(1)` after.
  - `dbLogger.debug({ context: caller, message: `${boundSql} -- params: ${JSON.stringify(values)} (${ms}ms)` })`.
- When `!this.dbLog`: no caller parse, no timing, no log — zero overhead.

Both choke points already compute `bound` + `values` via `bind()`; log the bound form (actual `$1` SQL hitting the driver).

## main.ts

```
app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
```
Place right after `NestFactory.create`, before other bootstrap. Unifies Nest internal logs + app logs through Winston.

## env wiring

`src/config/env.config.ts` — add to `configEnv()`:
```
logging: {
  level: process.env.LOG_LEVEL || 'info',
  db: process.env.DB_LOGGING === 'true',
},
```

`.env.example` — add:
```
# Logging
LOG_LEVEL=info          # error | warn | info | debug
# DB_LOGGING already present (true/false) — logs SQL via SqlMapper
```

`env.module.ts` (startup validation) — `LOG_LEVEL` optional (has default); no new required vars.

## Sample output

**dev:**
```
[2026-10-04 14:32:01][INFO][UserService]: user created id=42
[2026-10-04 14:32:02][WARN][AuthGuard]: missing bearer token
[2026-10-04 14:32:03][ERROR][SqlMapper]: query failed: relation "users" does not exist
[2026-10-04 14:32:03][DEBUG][UserService]: SELECT * FROM users WHERE id = $1 -- params: [42] (3.2ms)
```

**prod (JSON):**
```json
{"level":"info","context":"UserService","message":"user created id=42","timestamp":"2026-10-04T14:32:01.123Z"}
```

## Testing / self-check

- `caller.ts` ships a `demo()` / `test_caller.ts` asserting:
  - a sample stack containing `at UserService.findOne (...)` → returns `UserService`.
  - a garbage/empty stack → returns `SqlMapper`.
- Manual: run app with `DB_LOGGING=true LOG_LEVEL=info` → SQL DEBUG lines appear despite info level (proves independence); with `DB_LOGGING=false` → none.

## Out of scope (YAGNI)

- File transports / log rotation (`winston-daily-rotate-file`) — add when a deploy target needs on-disk logs; container stdout + aggregator covers prod now.
- Request-id / correlation middleware — separate concern, add later if tracing needed.
- Per-module log level overrides.
