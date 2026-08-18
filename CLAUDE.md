# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Deep conventions live in [`.github/copilot-instructions.md`](.github/copilot-instructions.md)** (style, naming, patterns, PR review, self-maintenance). **[`.agents/instructions.md`](.agents/instructions.md)** holds agent-behavior rules (planning, scope, model tiering). This file is the orientation layer — commands + big-picture architecture. On any conflict, copilot-instructions wins on conventions.

## Commands

Package manager: **pnpm** (repo lockfile is `pnpm-lock.yaml`). This is a **TypeScript** project — `tsx` runs source directly, esbuild bundles it.

```bash
pnpm install              # install
cp .env.sample .env       # first-time env setup (or .env.local, which overrides)
pnpm run db:sync          # dev-only: DROPS the public schema + recreates from TypeORM entities
pnpm run dev              # tsx watch src/server.ts (hot reload; PORT, default 8000)
pnpm run lint             # eslint --quiet . --ignore-pattern build/ --ignore-pattern dist/
pnpm run lint-fix         # eslint --fix
pnpm run typecheck        # tsc --noEmit
pnpm run build            # lint + typecheck + esbuild → dist/index.js (CJS)
```

- **No test framework is configured** (no `test` script). Don't assume tests exist — verify with `pnpm run lint`, `pnpm run typecheck`, and by running `pnpm run dev`.
- husky: `pre-commit` runs lint + lint-staged (prettier on staged files); `pre-push` runs build (skippable via `BUILD_ON_PRE_PUSH=false` in `.env`/`.env.local`).
- **CI (`.github/workflows/build.yml`):** PRs to `master`/`test`/`staging`/`release` run gitleaks + `pnpm i --frozen-lockfile` + `pnpm run build`. The `@openlytic/auth` `file:` dependency (`file:../Backend.Service.Auth`) is resolved by checking out `Backend.Service.Auth` as a sibling repo and building it (its `dist/` is gitignored) — keep that checkout step and the `file:` specifier in sync.

## Architecture (big picture)

GraphQL-first, **multi-tenant** control plane for **Openlytic** — a lightweight port of Gain.io's email/tracking stack. **Apollo Server 4 + Express 4**, **PostgreSQL via TypeORM**, **TypeScript** (Node 20+). ES modules source, bundled to CommonJS.

### Request entry — `src/server.ts`

- Express: CORS `origin: true`, JSON/urlencoded **50 MB** limit, `express-rate-limit` (50 req/min global).
- REST routes from `src/routes` (health + OAuth callback only); 404 wildcard; global error middleware.
- Boot order: `connectToPostgresDB()` → **`configureAuthRepositories()`** (wires `@openlytic/auth` repo accessor) → `buildGraphQLServer({ httpServer })` → `server.start()` → `app.use('/graphql', ...)` → listen.

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

### Auth (`src/modules/auth/` + `src/modules/user/` — first populated module, `feature/auth`)

- **Owns no JWT logic and exposes no GraphQL surface.** All logic delegates to the **`@openlytic/auth`** package (a `file:` dependency on `../Backend.Service.Auth`, its own repo). The surface is **REST**, mirroring Gain.io: `user.router.ts` mounted at `/auth` (register, login, refresh-token, logout, change-email/change-password, forgot-password family, app-login) with `user.controller.ts` returning `{ data, message }` and wrapping every op in `useTransaction()`.
- `auth-repository.ts` → `configureAuthRepositories()` maps the package's entity names (`user` / `auth_token` / `verification_token`) to the real TypeORM entities; called once at boot in `server.ts`.
- `auth.service.ts` is a thin wrapper: derives identity from the JWT context (`req.user` for REST), keeps Gain's **snake_case params verbatim** (`.eslintrc.json` per-file override turns `camelcase`/`default-param-last` off for this file — the only such override), maps library `Error('UPPER_SNAKE')` → `CustomError(status, code)`, and **never accepts `roles` from clients** — roles are derived from org membership when `org_id` is present at login/refresh (owner → `['admin','manager']`, member → `['manager']`; unknown org → `INVALID_ORGANIZATION`, non-member → `UNREGISTERED_USER_OF_THE_ORG`, inactive → `INACTIVE_ORGANIZATION_USER`), default `['user']` without an org; `loginAnApplication` gives `public`/`service_manager`.
- **REST auth gate:** `src/middlewares/authorizer.ts` verifies the Bearer access token → sets `req.user`; `authorizer(['admin', 'manager'])` gates admin routes (`/auth/set-user-email`, `/auth/set-user-password`).
- Entities: `user/` (UserEntity) + `auth/` (`auth_token`, `verification_token`). GraphQL `@auth` directive + `buildContext` are retained for the email/tracking modules.

### Organization (`src/modules/organization/` + `src/graphql/resolvers/organization/` — `feature/multi-tenancy`)

- **GraphQL-first, mirroring Gain.io** (unlike the REST auth facade): `createAnOrganization` / `updateAnOrganization` / `deleteAnOrganization` mutations + `getAnOrganization` / `getOrganizations` queries in `src/graphql/typeDefs/organization.graphql`, resolvers in `src/graphql/resolvers/organization/`, mutations wrapped in `useTransaction()` and gated with `@auth(roles: ["admin", "manager"])`.
- Entities: `organization` (OrganizationEntity), `reserved_sub_domain` (ReservedSubDomainEntity), `organization_user` (OrganizationUserEntity tenancy join) — all under `src/modules/organization/`, registered in `entities.ts`.
- **REST complement** (mirrors Gain.io, 3 routes): `GET /organization?sub_domain=…`, `GET /organization/check-availability?sub_domain=…`, `POST /organization` (create org for a user → 201). `POST /` rate-limited 3 req/min and NOT `authorizer()`-gated (bootstrap path, mirrors Gain.io).
- `organization.helper.ts` / `organization.service.ts` keep Gain's **snake_case contract verbatim** (snake_case appears only as object keys/properties — `camelcase.properties: 'never'` from the airbnb base allows them; locals stay camelCase); **no `eslint-disable` comments exist in the codebase**.
- **Simplified from Gain.io:** org settings/files (logo/icon keys → `null`), plans, roles/permissions, work schedules, SES tenant, PostHog, mock-data seed, subscription/usage, `reset*` mutations, realtime subscription. `location` stays **required in the create input** (Gain's contract, mirrored via `LocationUpdateInputType`) but is **not persisted** — no location entity.

### Email / send pipeline (`src/modules/email/` + `email-recipient/` + `app-queue/` — `feature/email`)

- **GraphQL-first, mirroring Gain.io**: `createEmail` / `updateEmail` / `deleteEmail` mutations + `getAnEmail` / `getEmails` / `getEmailRecipients` / `getAnAppQueue` / `getAppQueues` queries. Email mutations/queries gated `@auth(roles: ["admin", "manager"])`; app-queue read queries gated `@auth(roles: ["service_manager"])`.
- **Create pipeline** (`createEmailForMutation`): writes the `Email` (stage `sent` when to/cc/bcc exist, else `draft`), self-assigns `thread_id` when missing, fans out `email_recipients` (type `to`/`cc`/`bcc`, each requiring exactly one of `contact_org_id`/`contact_person_id`/`org_user_id` — Gain's `INVALID_RECIPIENT` contract), then `enqueueEmailSend` inserts an `app_queue` row (`category: 'send_email'`, `event: 'send_email'`, `destination: 'email'`, `params: { emailId, organizationId, integrationId, provider, toEmails, trackingEnabled }`). The row goes `ready` unless another `send_email` is running **for the same `org_id`** (hold-chaining, org-scoped — a deliberate multi-tenant fix over Gain's global category check).
- **SQS transport** — `src/utils/sqs-client.ts` (`publishSendJob({ event, queue_id, params })`) publishes the envelope to SQS (`SQSClient` + `SendMessageCommand`; `SQS_QUEUE_URL`/`SQS_ENDPOINT`/`SQS_REGION`); if the queue is unreachable it falls back to a stub (log + fake `MessageId`) so dev runs offline. The `app_queue` row stays the durable source of truth. Delivery is handled by the **consumer repo `Openlytic.Backend.Service.Email`** — a **lambda mirroring Gain.IO's email service** (`src/index.ts` handler, SQS event source, SAM `template.yaml`): it re-reads the `app_queue` row from the same Postgres and sends via **Amazon SES** (`@aws-sdk/client-ses`; `EMAIL_DELIVERY_MODE=stub` in dev logs + fake MessageId instead of sending). Local dev invokes it via `npm run invoke -- <queue_id>`.
- `updateEmail` handles `is_read`/`is_trashed` thread propagation, recipient add/remove, and stage→`sent` enqueue (`EMAIL_ALREADY_SENT` guard); `deleteEmail` deletes the whole thread + its recipients (queue rows are retained — durable source of truth).
- **Skipped in core scope:** sender `from` recipient (the GraphQL context user carries no `email`/`org_user_id`), attachments, labels, integrations, standalone recipient mutations, inbox sync.

### Email tracking / analytics (`src/modules/email-tracking/` + `src/graphql/resolvers/email-tracking/`)

- **Entities** (registered in `entities.ts`): `email_tracking_events` (append-only event log, `dedupe_key` unique, `source`/`tracking_scope`/`link_id`/`link_name` nullable), `tracked_link` (unique `email_id` + `target_url`), `email_analytic` (materialized projection, **keyed by `email_id`** for now — `email_recipient_id` stays NULL until per-recipient identity lands; the ER's `unique(email_id, email_recipient_id)` is future work).
- **The event log + projection are written by the email-service consumer** (`Openlytic.Backend.Service.Email`), not this API: it renders the tracked body at send time (cheerio rewrite — click links → `/email-tracking/click`, `<img src="cid:…">` attachments → `/email-tracking/attachment-view`, open pixel → `/email-tracking/open`), inserts `tracked_link` rows (`kind` `click`/`attachment`), records `email_tracking_events` (HMAC-verified tokens, dedupe by `email_id|recipient_email|event_type|target_url`), and idempotently upserts `email_analytic` (forward-only counters/timestamps incl. `attachment_view_count`). `TRACKING_SECRET` here must match the consumer's `EMAIL_TRACKING_SECRET`.
- **Tracking token:** base64url(JSON) payload `{ email_id, recipient_email | recipients, tracking_scope, target_url?, link_name? }` + HMAC-SHA256 signature. Recipient scope when exactly 1 `to` and no cc/bcc, else email scope.
- **This API only reads analytics** — `getAnEmailAnalytic` / `getEmailAnalytics` / `getTrackedLinks` (per-link summaries via a raw-SQL JOIN of `tracked_link` + `email_tracking_events`; attachment-kind links count `attachment_viewed` events as `click_count`) / `getEmailTrackingEvents`, all gated `@auth(roles: ["admin", "manager"])`. `src/modules/email-tracking/email-tracking.helper.ts` is query-only (no service file — no mutations yet); raw SQL allowed there for the aggregate JOIN (`listLinkClickSummariesForQuery`).
- `createEmail` accepts `tracking_enabled` (default **true** when sendable recipients exist); `enqueueEmailSend` passes it as `params.trackingEnabled` (was hardcoded `false`).

### Shared layer (ported from Gain.IO)

- **Centralized error middleware** — `src/middlewares/error.ts` (headersSent guard, answers `{ message, metadata? }` with `err.statusCode || 500`), barrel in `src/middlewares/index.ts`. Mounted in `server.ts` after the 404 wildcard: `app.use(error)`.
- **Common helpers** — `src/modules/common/common.helper.ts` (namespace `commonHelper`, barrel `src/modules/helpers.ts`): `checkRequiredFields`, `checkRequireAtLeastOneField`, `validateEmail`, `validateUUID`, `isUrlValid`, `isValidatePhoneNumber`, `getModifiedObjectProperties`, `getTopRoleOfAUser`, `isUserOnlyAgent`, URL/date/rounding utils. Built-ins only — no `validator`/`moment`/`lodash`.
- **Shared HTTP mapping** — `src/utils/http-status.ts`: `UPPER_SNAKE_STATUS` + `toHttpError()`; the auth wrapper maps library `Error('UPPER_SNAKE')` throws through it (unmapped → 400, mirroring Gain).
- **Logger** — `src/utils/logger.ts`: module-scoped gated `logger.info('server', msg, …)`; gated by `DEBUG` + `DEBUG_MODULE` (`server` always logs). No `console.log` in request paths.

### Cross-cutting things that bite (read before editing)

- **Tenancy:** `organization_id`/`user_id` come from the JWT (`req.user` on REST, `context.user` on GraphQL) — **never accept them as request input** (tenant-crossing risk).
- **Auth context:** REST routes use `authorizer()` (`src/middlewares/authorizer.ts`) — verifies the Bearer access token via `authService.verifyToken({ token, type: 'access_token' })` (DB row + JWT), sets `req.user` (claims incl. `roles`). GraphQL `buildContext` does the same for `@auth` modules (organization + email today), mapping `roles` into `context.user.roles` **and** `context.user.role`. `src/utils/jwt.ts` is **unused dead code** (no imports) — the auth package owns JWT issue/verify.
- **`@auth` directive SDL** (`@auth(roles: [...]) on FIELD_DEFINITION`) is declared in `typeDefs/base.graphql`; `directives/auth.ts` enforces it. Gates the organization + email modules and the email-tracking read queries (`roles: ["admin", "manager"]`); app-queue read queries use `roles: ["service_manager"]`.
- **`CustomError(statusCode, message)`** is the error type (`src/utils/error`). Throw it in services for client-visible codes.
- **`useTransaction()`** (`src/utils/database.ts`) sets a 40 s `lock_timeout` outside the transaction — intentional, mirroring Gain.io.
- **SQS envelope:** the durable `app_queue` row is the source of truth; SQS is only transport. The published message is `{ event, queue_id, params }` (legacy `{ job_type, payload }` still supported by the email service). API never publishes anything without an `app_queue` row.
- **`db:sync` is destructive** — it drops the `public` schema. Never call `syncDBEntities()` in request flow/startup; it stays commented in `entities.ts`.
- **Raw SQL** is allowed only where the existing helpers already use it — `src/modules/email-tracking/email-tracking.helper.ts` (the link-summary/deliverability aggregates, `listLinkClickSummariesForQuery`). The write-side projection upsert (`upsertEmailAnalytic`) lives in the **consumer repo**'s `email-tracking.service.ts`, not here.
- **Imports:** always the `src/` alias (tsconfig `paths` + tsx/esbuild alias), no relative `../`, no file extension.
- **Logging:** real code paths avoid `console.log` noise; track via the queue/analytic rows. Dev boot logging is fine in `server.ts`.

### Env — `src/env.ts`

Loads `.env` → `.env.{branch}` → `.env.local` (later overrides earlier). Key vars: `PORT`, `NODE_ENV`, `POSTGRES_URL`, `JWT_SECRET`, `TRACKING_SECRET`, `SQS_QUEUE_URL`, `SQS_ENDPOINT` (localstack), OAuth client ids/secrets. **Don't change the load order.**

Auth env vars (`ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`, `APPLICATION_TOKEN`) are read **directly from `process.env` by `@openlytic/auth`** (documented in `.env.sample`); they're not part of `env.ts`'s loading chain.

## Adding a domain module

1. `src/modules/<domain>/` → `<domain>.entity.ts`, `.helper.ts`, `.service.ts`; register in `entities.ts` / `helpers.ts` / `services.ts` barrels (alphabetical).
   - New entities: `@PrimaryColumn` uuid + `@BeforeInsert generateId()`, snake_case table/columns.
2. `src/graphql/typeDefs/<domain>.graphql` (auto-merged — no manual registration).
3. `src/graphql/resolvers/<domain>/<domain>.query.ts` + `.mutation.ts` → spread into `resolvers/index.ts`.
4. REST (rare): register route in `src/routes/index.ts`.
5. Per copilot-instructions self-maintenance: update the instruction docs in the **same commit** when adding a module / convention / guardrail / env var.

Module-naming exceptions (mirroring Gain.io's auth surface, applied in `src/modules/auth/`): tables `user`, `auth_token`, `verification_token` and their GraphQL fields use **snake_case** (DB contract) — only `auth.service.ts` has `camelcase`/`default-param-last` disabled (via `.eslintrc.json`); elsewhere snake_case appears only as object keys/properties.

## Do NOT change

- `src/env.ts` load order; `src/graphql/schema.ts` auto-merge (never hand-list typedefs); `src/graphql/directives/auth.ts`.
- `CustomError` constructor behavior; the `useTransaction` 40 s `lock_timeout`.
- `src/modules/entities.ts` export shape (the `entities` array + named re-exports); `syncDBEntities()` stays commented.
- The SQS envelope contract (`{ event, queue_id, params }`) without updating both the API publisher and the email service handler.
- `src/modules/auth/auth-repository.ts` (`configureAuthRepositories`), the snake_case auth contract in `auth.service.ts`, and `src/middlewares/authorizer.ts` — the auth package (`@openlytic/auth`) owns the business logic.
- Reintroducing any parallel JWT layer (including importing the existing unused `src/utils/jwt.ts`) — `authorizer()` (REST) and `buildContext` (GraphQL) are the only verification points.
- Converting the `/auth` REST facade (`user.router.ts`/`user.controller.ts`) back to GraphQL.

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
