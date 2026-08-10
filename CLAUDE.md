# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Deep conventions live in [`.github/copilot-instructions.md`](.github/copilot-instructions.md)** (style, naming, patterns, PR review, self-maintenance). **[`.agents/instructions.md`](.agents/instructions.md)** holds agent-behavior rules (planning, scope, model tiering). This file is the orientation layer — commands + big-picture architecture. On any conflict, copilot-instructions wins on conventions.

## Commands

Package manager: **npm** (repo lockfile is `package-lock.json`). This is a **TypeScript** project — `tsx` runs source directly, esbuild bundles it.

```bash
npm install                # install
cp .env.sample .env        # first-time env setup (or .env.local, which overrides)
npm run db:sync            # dev-only: DROPS the public schema + recreates from TypeORM entities
npm run dev                # tsx watch src/server.ts (hot reload; PORT, default 8000)
npm run lint               # eslint --quiet . --ignore-pattern build/ --ignore-pattern dist/
npm run lint-fix           # eslint --fix
npm run typecheck          # tsc --noEmit
npm run build              # lint + typecheck + esbuild → dist/index.js (CJS)
```

- **No test framework is configured** (no `test` script). Don't assume tests exist — verify with `npm run lint`, `npm run typecheck`, and by running `npm run dev`.
- husky: `pre-commit` runs lint + lint-staged (prettier on staged files); `pre-push` runs build (skippable via `BUILD_ON_PRE_PUSH=false` in `.env`/`.env.local`).

## Architecture (big picture)

GraphQL-first, **multi-tenant** control plane for **Openlytic** — a lightweight port of Gain.io's email/tracking stack. **Apollo Server 4 + Express 4**, **PostgreSQL via TypeORM**, **TypeScript** (Node 20+). ES modules source, bundled to CommonJS.

### Request entry — `src/server.ts`

- Express: CORS `origin: true`, JSON/urlencoded **50 MB** limit, `express-rate-limit` (50 req/min global).
- REST routes from `src/routes` (health + OAuth callback only); 404 wildcard; global error middleware.
- Boot order: `connectToPostgresDB()` → `buildGraphQLServer({ httpServer })` → `server.start()` → `app.use('/graphql', ...)` → listen.

### GraphQL — `src/graphql/`

- **`schema.ts`** auto-merges **all** `typeDefs/*.graphql` via `loadFilesSync` + `mergeTypeDefs` — never hand-list typeDefs.
- Executable schema is wrapped with the **`@auth` directive** (`directives/auth.ts`), served via `@apollo/server`.
- **`resolvers/`** — one folder per domain, each `*.query.ts` + `*.mutation.ts` (default-export objects), spread together in `resolvers/index.ts`.
- Fields inside type/input/enum definitions must be in **ascending alphabetical order**, with two exceptions:
  - **`id`** — always the **first** field
  - **`created_at` / `updated_at`** — always the **last** fields (in that order)

### Domain modules — `src/modules/<kebab-domain>/`

Strict pipeline **Entity → Helper → Service → Resolver**, TypeScript files:

- `<m>.entity.ts` — TypeORM entity class (`@Entity({ name: 'table_name' })`, snake_case columns via `@Column({ name })`; **`@PrimaryColumn` uuid + `@BeforeInsert generateId()`** convention)
- `<m>.helper.ts` — data access via `getRepository(entity, transaction?)` + `…ForQuery` functions → **query resolvers call helpers**
- `<m>.service.ts` — business logic `…ForMutation` functions → **mutation resolvers call services** wrapped in `useTransaction()` (transaction threaded through every `getRepository` call)
- Resolvers under `src/graphql/resolvers/<m>/`; typedef under `src/graphql/typeDefs/<m>.graphql`
- Registered via barrels: `src/modules/entities.ts`, `helpers.ts`, `services.ts`

### Cross-cutting things that bite (read before editing)

- **Tenancy:** `organization_id`/`user_id` come from the JWT (`context.user`) — **never accept them as GraphQL input** (tenant-crossing risk).
- **`CustomError(statusCode, message)`** is the error type (`src/utils/error`). Throw it in services for client-visible codes.
- **`useTransaction()`** (`src/utils/database.ts`) sets a 40 s `lock_timeout` outside the transaction — intentional, mirroring Gain.io.
- **SQS envelope:** the durable `app_queue` row is the source of truth; SQS is only transport. The published message is `{ event, queue_id, params }` (legacy `{ job_type, payload }` still supported by the email service). API never publishes anything without an `app_queue` row.
- **`db:sync` is destructive** — it drops the `public` schema. Never call `syncDBEntities()` in request flow/startup; it stays commented in `entities.ts`.
- **Raw SQL** is allowed only where the existing helpers already use it (e.g. the `email-analytic` projection upsert + `listLinkClickSummariesForQuery`).
- **Imports:** always the `src/` alias (tsconfig `paths` + tsx/esbuild alias), no relative `../`, no file extension.
- **Logging:** real code paths avoid `console.log` noise; track via the queue/analytic rows. Dev boot logging is fine in `server.ts`.

### Env — `src/env.ts`

Loads `.env` → `.env.{branch}` → `.env.local` (later overrides earlier). Key vars: `PORT`, `NODE_ENV`, `POSTGRES_URL`, `JWT_SECRET`, `TRACKING_SECRET`, `SQS_QUEUE_URL`, `SQS_ENDPOINT` (localstack), OAuth client ids/secrets. **Don't change the load order.**

## Adding a domain module

1. `src/modules/<domain>/` → `<domain>.entity.ts`, `.helper.ts`, `.service.ts`; register in `entities.ts` / `helpers.ts` / `services.ts` barrels (alphabetical).
   - New entities: `@PrimaryColumn` uuid + `@BeforeInsert generateId()`, snake_case table/columns.
2. `src/graphql/typeDefs/<domain>.graphql` (auto-merged — no manual registration).
3. `src/graphql/resolvers/<domain>/<domain>.query.ts` + `.mutation.ts` → spread into `resolvers/index.ts`.
4. REST (rare): register route in `src/routes/index.ts`.
5. Per copilot-instructions self-maintenance: update the instruction docs in the **same commit** when adding a module / convention / guardrail / env var.

## Do NOT change

- `src/env.ts` load order; `src/graphql/schema.ts` auto-merge (never hand-list typedefs); `src/graphql/directives/auth.ts`.
- `CustomError` constructor behavior; the `useTransaction` 40 s `lock_timeout`.
- `src/modules/entities.ts` export shape (the `entities` array + named re-exports); `syncDBEntities()` stays commented.
- The SQS envelope contract (`{ event, queue_id, params }`) without updating both the API publisher and the email service handler.

## Automation in this repo

Two layers keep context fresh — both **safe no-ops** if the underlying tool isn't installed:

**Claude Code hooks** (`.claude/settings.json`, `PostToolUse` on `Write|Edit`):

| Hook                     | Action                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `check-config-change.sh` | Edited a config file → reminds to update the instruction docs                             |
| `lint-on-change.sh`      | Edited a `.ts`/`.js` → runs local ESLint on it inline                                     |
| `track-changes.sh`       | Logs structural edits to `.claude/changes.md` (git-ignored; **read it at session start**) |
| `regen-graph.sh`         | Edited `src/**.{ts,tsx,js,graphql}` → `graphify update .` (background)                    |

**Git hooks** (husky): `graphify update .` after each commit (`.husky/post-commit`), on branch switch (`.husky/post-checkout`, branch checkouts only), after a merge/pull (`.husky/post-merge`), plus `npm install` after branch checkouts.

**Knowledge graph (graphify)** — optional per-machine power tool:

```bash
pipx install graphifyy && graphify install --platform claude
```

Query it: `graphify query "..."`, `graphify explain "X"`, `graphify affected "fn()"` (blast-radius). Output (`graphify-out/`) is git-ignored.
