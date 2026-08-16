<!-- PURPOSE: Systems-level context for GitHub Copilot (IDE completions and Web PR Reviews). -->
<!-- This file is automatically read by GitHub Copilot in both VS Code and github.com PR reviews. -->
<!-- It provides project-specific conventions, architectural patterns, and guardrails. -->

# Copilot Instructions — Openlytic Backend API Server

## Project Persona

This is a **multi-tenant backend API server** — the control plane for the Openlytic email/tracking platform. It is a TypeScript port of the Gain.io email stack: auth, organizations, mailbox integrations, durable email-send queueing, fan-out recipient tracking, tracked links, per-email/recipient analytics, and a deliverability report.

The primary API surface is **GraphQL** (Apollo Server 4). REST is minimal (health + provider OAuth callback only). The server runs on **Node 20+, TypeScript, Express 4, Apollo Server 4, TypeORM (PostgreSQL)**, and publishes jobs to **SQS** as transport for a durable `app_queue` table.

The email service consumer (a separate repo, `Openlytic.Backend.Service.Email`) is a TS **lambda mirroring Gain.IO's email service**: SQS event source → `src/index.ts` handler → delivers via Amazon SES. Local dev invokes the handler with `npm run invoke -- <queue_id>`. It reads the same `{ event, queue_id, params }` envelope.

---

## Architecture Overview

```
src/
├── server.ts                    # Express + Apollo bootstrap (CORS, rate limit, /graphql)
├── env.ts                       # .env → .env.{branch} → .env.local load (don't change order)
├── db-sync.ts                   # dev-only: DROPS public schema + recreates from entities
├── graphql/
│   ├── schema.ts                # Auto-merges all .graphql typeDefs (loadFilesSync)
│   ├── server.ts                # Apollo Server 4 config + context (JWT → user)
│   ├── subscription.ts          # (reserved) PubSub
│   ├── directives/auth.ts       # @auth directive (role checks from JWT — reserved for GraphQL modules)
│   ├── resolvers/{module}/      # {module}.query.ts, {module}.mutation.ts
│   └── typeDefs/{module}.graphql
├── middlewares/
│   └── authorizer.ts            # Bearer access-token auth for REST routes → req.user (+ optional role check)
├── modules/
│   ├── entities.ts              # Barrel: all TypeORM entities + dataSource registration
│   ├── helpers.ts               # Barrel: helper namespaces (common, organization)
│   ├── services.ts              # Barrel: service namespaces (auth, organization)
│   ├── app-queue/               # Durable job table: hold/ready/sent/processing/completed/failed,
│   │                            #   retry backoff (delay = retry_count*60, ≤5), stuck watchdog,
│   │                            #   hold→ready chaining, SQS publish on the ready/retry transition
│   ├── auth/                    # REST auth facade (thin wrapper over @openlytic/auth): register+OTP,
│   │                            #   login, refresh/revoke tokens, change email/password, forgot password
│   ├── auth-token/              # auth_token entity (access/refresh token rows)
│   ├── verification-token/      # verification_token entity (6-digit OTP, 5-min expiry)
│   ├── email/                   # createEmail → email_recipients → app_queue → SQS
│   ├── email-analytic/          # materialized projection upsert + link summaries + deliverability report
│   ├── email-recipient/         # fan-out target rows (type, send_status, provider_message_id)
│   ├── email-tracking/          # mail_tracking_events entity (10 event kinds)
│   ├── integration/             # gmail/outlook OAuth + encrypted tokens
│   ├── organization/            # tenant (organization + reserved_sub_domain + organization_user tenancy join)
│   ├── provider/                # OAuth URL building / token exchange
│   ├── sync-history/            # sync-run audit (entity ready; inbox sync on roadmap)
│   ├── tracked-link/            # per-email rewritten links (unique email_id+target_url)
│   └── user/                    # user entity + user.controller.ts + user.router.ts (REST auth wiring)
├── routes/index.ts              # GET /health + /auth/* (userRouter); OAuth callback in provider module
└── utils/
    ├── database.ts              # DataSource, getRepository(entity, tx), useTransaction()
    ├── error.ts                 # CustomError(statusCode, message)
    ├── sqs-client.ts            # publishSendJob / publishTrackingEvent (SQS transport)
    ├── crypto.ts                # token hashing / tracking signature
    └── logger.ts                # winston
```

---

## Style Guide

### Formatting (enforced by ESLint + Prettier)

- **No semicolons** (`semi: false` via prettier config)
- **Single quotes**
- **2-space indentation**
- **No trailing commas** (`trailingComma: 'none'` via prettier)
- **120-character print width**
- **`prefer-const`**, **`object-shorthand`**, concise arrow bodies (`as-needed`)
- **Organized imports** (prettier-plugin-organize-imports) — alphabetical

### Naming Conventions

| Element                 | Convention                                    | Example                                               |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Files                   | kebab-case with dot-suffix                    | `app-queue.entity.ts`, `email-analytic.service.ts`    |
| Variables & functions   | camelCase                                     | `recipientEmail`, `getEmailAnalyticForQuery`          |
| Constants               | UPPER_SNAKE_CASE                              | `APP_QUEUE_ENTITY_NAME`, `DELIVERY_WARNING_THRESHOLD` |
| TypeORM entities        | PascalCase                                    | `EmailAnalytic`, `AppQueue`                           |
| GraphQL types           | PascalCase                                    | `Email`, `EmailDetail`, `LinkClickSummary`            |
| GraphQL input types     | `{Name}InputType` / `{Name}{Action}InputType` | `EmailCreateInputType`                                |
| Database columns/tables | snake_case                                    | `organization_id`, `app_queue`, `email_recipients`    |
| Error codes             | UPPER_SNAKE_CASE strings                      | `INTEGRATION_NOT_FOUND`, `EMAIL_NOT_FOUND`            |
| Module folders          | kebab-case                                    | `email-analytic/`, `tracked-link/`                    |
| GraphQL operations      | `create{Entity}` / `{entities}` queries       | `createEmail`, `emails`, `emailAnalytics`             |

**Exception — the auth module (`src/modules/auth/auth.service.ts`) uses the `@openlytic/auth` (Gain.io) **snake_case** params contract verbatim** (`user_id`, `access_token`, `custom_claims`, `new_email`, `old_passwords`). `.eslintrc.json` has a **per-file override** turning `camelcase`/`default-param-last` off for this file — global rules are NOT relaxed, and **no `eslint-disable` comments exist anywhere in the codebase** (camelCase locals + snake_case object keys/properties everywhere else). Do not globalize camelCase here.

### Import Rules (CRITICAL)

- **Always use absolute imports** from the `src/` alias: `import { emailService } from 'src/modules/services'`
- **Relative imports (`../`) are prohibited** — tsconfig `paths` maps `src` → `./src`; esbuild/tsx honor it
- **No file extension** in imports (`from 'src/modules/email/email.service'`, not `.../email.service.ts`)
- **Barrel imports**: import services, helpers, entities from `src/modules/services`, `src/modules/helpers`, `src/modules/entities` — never import deep into a module file when a barrel export exists

### Export Rules

- **Named exports** from helpers/services; entity classes are named exports
- **Default exports** allowed only for GraphQL resolver objects and the schema (`src/graphql/schema.ts` exports `default schema`)
- **Barrels** re-export namespaces: `export * as emailService from 'src/modules/email/email.service'`

---

## Architectural Patterns

### Layer Separation (MUST follow)

```
GraphQL Resolver → Service → Helper → Entity (TypeORM)
```

- **Resolvers/Controllers**: Thin — extract args, call service inside `useTransaction()`, return result; camelCase aliases on snake_case DB fields
- **Services**: Business logic — validation, orchestration, multi-entity coordination, queue writes
- **Helpers**: Pure data operations — `getRepository(entity, transaction?)`, raw SQL literal builders, constants
- **Entities**: TypeORM class definitions only — no business logic

### Transaction Pattern

All mutations MUST be wrapped in `useTransaction()`:

```typescript
const createEmail = async (parent, args, context) =>
  useTransaction((transaction) => emailService.createEmailForMutation(args?.inputData, context?.user, transaction))
```

The `transaction` parameter must be threaded into every write via `getRepository(entity, transaction)`. Queries (read resolvers) call helpers without a transaction.

### Error Handling Pattern

- Use `CustomError(statusCode, message)` for all thrown errors (`src/utils/error`)
- Messages are stable codes (`UPPER_SNAKE_CODE` or a clear message); never dynamic user-entered strings
- Common status codes: 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server)

### Queue / SQS Envelope (durable job table)

The API server **never publishes to SQS directly without a durable `app_queue` row**:

1. `createEmail` writes the `Email` (stage `sent` when to/cc/bcc exist, else `draft`; `thread_id` self-assigned when missing), fans out `email_recipients` (type `to`/`cc`/`bcc`, each requiring exactly one of `contact_org_id`/`contact_person_id`/`org_user_id` — Gain's `INVALID_RECIPIENT` contract), inserts an `app_queue` row (`category: 'send_email'`, `event: 'send_email'`, `destination: 'email'`, `params: { emailId, organizationId, integrationId, provider, toEmails, trackingEnabled }`), status `hold`/`ready` (hold if another send_email is running **for the same `org_id`** — org-scoped, a deliberate multi-tenant fix over Gain's global category check → promoted to `ready` on completion).
2. When `ready`, the API publishes `{ event: 'send_email', queue_id, params }` via `src/utils/sqs-client.ts` (`publishSendJob` — `SQSClient` + `SendMessageCommand` to `SQS_QUEUE_URL`; falls back to a stub log + fake `MessageId` when the queue is unreachable, so dev keeps working offline). The durable `app_queue` row is the source of truth — the consumer re-reads it, so SQS is transport only.
3. The consumer (**`Openlytic.Backend.Service.Email`**, separate repo, a **lambda like Gain.IO's** — `src/index.ts` handler, SQS event source, SAM `template.yaml`) delivers: it re-reads `app_queue` rows (`category: 'send_email'`, status `ready`/`sent`) from the same Postgres, marks `processing` → sends via **Amazon SES** (`@aws-sdk/client-ses`, `SendEmailCommand`) → `completed`/`failed`. Success persists `provider_message_id` + `send_status='sent'`/`sent_at` on each recipient and `message_id`/`sent_at`/`queued_at` on the email; failures re-queue with backoff `delay = retry_count * 60` (≤ 300 s, `max_retries` 5) and a terminal queue promotes the org's next `hold` row to `ready`. Dev mode `EMAIL_DELIVERY_MODE=stub` (no AWS creds) logs + fake MessageId instead; local dev invokes the handler via `npm run invoke -- <queue_id>` (or `--all`).

Keep this envelope intact. New job categories must follow the same hold→ready→processing→completed/failed lifecycle and use `app_queue.service` helpers.

### Authentication & Authorization

- **JWT issued/verified by the `@openlytic/auth` package** (`configureRepositoryAccessor` wired in `src/modules/auth/auth-repository.ts`, called at boot in `server.ts`). Tokens carry `roles`, `sub`, `user_id`/`contact_id`, `org_id`, `org_brand_id`.
- **The auth surface is REST, not GraphQL** — `src/modules/user/user.router.ts` (mounted at `/auth`) + `user.controller.ts` mirror Gain.io's `user.router.js`/`user.controller.js`: `/auth/register`, `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/change-password`, `/auth/forgot-password`, `/auth/verify-forgot-password`, etc. Responses are `{ data, message }` (200) or `CustomError` status codes. `src/graphql/typeDefs/auth.graphql` + `resolvers/auth/` were removed — do not reintroduce a GraphQL auth surface.
- **REST endpoints are protected with `authorizer()`** (`src/middlewares/authorizer.ts`) — verifies the Bearer access token via `authService.verifyToken({ token, type: 'access_token' })`, sets `req.user` (JWT claims incl. `roles`), optional `authorizer(['admin', 'manager'])` role gate. Missing/invalid token → `401`, insufficient roles → `403`.
- **GraphQL stays JWT-aware for future modules**: `buildContext` in `src/graphql/server.ts` verifies the token and exposes `context.user` (with `roles`/`role` for the `@auth` directive). `src/utils/jwt.ts` is **unused dead code** (no imports) — do not import it or reintroduce a parallel JWT layer.
- GraphQL `@auth` directive (`directives/auth.ts` + SDL declaration in `typeDefs/base.graphql`) gates the organization and **email** module queries/mutations (`roles: ["admin", "manager"]`); app-queue read queries use `roles: ["service_manager"]`; reserved for tracking.
- Multi-tenancy enforced via `organization_id`/`user_id` **derived from the JWT** — never accepted as request input.
- **Roles are computed server-side** (`auth.service.ts` defaults to `['user']`; `loginAnApplication` issues `public`/`service_manager` for app users). Client-supplied `roles` in login/register input is rejected.
- Passwords hashed (bcrypt via the auth package), provider tokens encrypted (`src/utils/crypto.ts`)

### Organization / tenancy (`src/modules/organization/` + `src/graphql/resolvers/organization/` — `feature/multi-tenancy`)

- **GraphQL-first, mirroring Gain.io's organization module** (unlike the REST auth facade). Surface: `createAnOrganization` / `updateAnOrganization` / `deleteAnOrganization` mutations + `getAnOrganization` / `getOrganizations` queries in `src/graphql/typeDefs/organization.graphql`, resolvers in `src/graphql/resolvers/organization/`, mutations wrapped in `useTransaction()` and gated with `@auth(roles: ["admin", "manager"])`.
- Entities: `organization` (OrganizationEntity), `reserved_sub_domain` (ReservedSubDomainEntity), `organization_user` (OrganizationUserEntity tenancy join). All follow the `@PrimaryColumn` uuid + `@BeforeInsert generateId()` convention.
- **REST complement** (mirrors Gain.io's `organization.router.js` — 3 routes only): `GET /organization?sub_domain=…`, `GET /organization/check-availability?sub_domain=…`, `POST /organization` (create org for a user, `{ user_id, org_name, sub_domain, location, time_zone }` → 201). `POST /organization` is rate-limited (3 req/min) and NOT `authorizer()`-gated (bootstrap path, mirrors Gain.io).
- **Snake_case Gain contract:** `organization.helper.ts` / `organization.service.ts` keep snake_case keys/properties verbatim — `camelcase.properties: 'never'` (airbnb base) allows object keys, so locals stay camelCase and **no `eslint-disable` comments are needed**; only `auth.service.ts` gets `camelcase`/`default-param-last` off, via `.eslintrc.json`.
- **Simplified from Gain.io (deferred modules):** org settings/files (logo/icon keys → `null`), location entity, plans, roles/permissions, work schedules, SES tenant, PostHog, mock-data seed, subscription/usage, `reset*` mutations and the realtime subscription. `getAnOrganizationBySubDomain` returns `{ id, created_at, logo_key: null, logo_icon_key: null, name, sub_domain }`.

### GraphQL Schema File Ordering (`.graphql` files)

In each `*.graphql` file, all **type/input/enum definitions** come **first**, followed by the **operation blocks at the bottom**:

1. Type definitions (`type`, `input`, `enum`, `scalar`, etc.)
2. `extend type Query { ... }`
3. `extend type Mutation { ... }`
4. `extend type Subscription { ... }` (if applicable)

**Never place type/input/enum definitions between or after the Query/Mutation/Subscription blocks.**

### GraphQL Field Ordering (within `type`, `input`, `enum`)

Fields in ascending **alphabetical order**, two exceptions:

1. **`id`** — always the **first** field
2. **`created_at` / `updated_at`** — always the **last** fields (in that order)

---

## PR Review Guardrails

### DO NOT Refactor

1. **`src/modules/entities.ts`** — the centralized entity registry (array + named re-exports) is intentional. Do not split registration into individual files.

2. **Raw SQL in `email-analytic.helper.ts` / `email-analytic.service.ts`** (`upsertEmailAnalytic`, `listLinkClickSummariesForQuery`, deliverability queries) — PostgreSQL-specific, performance-critical (idempotent `ON CONFLICT` upserts, forward-only counters/timestamps). Do not convert to generic TypeORM `save`.

3. **`useTransaction()` with `SET lock_timeout TO 40000`** (`src/utils/database.ts`) — intentional deadlock/lock prevention mirrored from Gain.io. Do not remove or restructure.

4. **The SQS envelope `{ event, queue_id, params }`** — the durable `app_queue` row is the source of truth; SQS is transport only. Do not publish full email payloads to SQS or bypass the queue for sends.

5. **`@PrimaryColumn` uuid + `@BeforeInsert generateId()` entity convention** — every entity follows it. Do not introduce auto-increment surrogate keys.

6. **`db:sync` / `syncDBEntities()`** — `src/db-sync.ts` drops the `public` schema (dev-only). `syncDBEntities()` stays commented in `entities.ts`. Do not wire `.synchronize()` into startup or request flow.

7. **CORS `origin: true`** — API server behind infrastructure access controls. Do not flag as a security issue.

8. **`src/modules/auth/auth.service.ts`** — the snake_case params contract, the `.eslintrc.json` per-file override (`camelcase`/`default-param-last` off for this file — the only one), and the server-side roles derivation (`custom_claims.roles` is never taken from client input). Executed via the `@openlytic/auth` package.

9. **`configureAuthRepositories()`** (`src/modules/auth/auth-repository.ts`) — the name→entity accessor seam that mirrors Gain.io's `sequelize.models.<name>`. Do not replace with entity-class-keyed lookups or call it per-request.

10. **`src/utils/jwt.ts` is unused dead code** (no imports) — the auth package owns JWT issue/verify. Do not import it or reintroduce a parallel JWT helper; the REST `authorizer()` and GraphQL `buildContext` are the only token-verification points.

11. **`src/middlewares/authorizer.ts`** — the REST auth gate (Bearer → `authService.verifyToken` → `req.user`, `401`/`403` semantics). Do not reimplement token verification inline in controllers.

12. **`src/modules/user/user.router.ts` / `user.controller.ts`** — the `/auth` REST facade mirrors Gain.io's `user.router.js`/`user.controller.js` routes and `{ data, message }` response shapes. Do not convert it to GraphQL.

### ALWAYS Flag

1. **Missing `transaction` parameter** in any service/helper function that performs writes
2. **`organization_id` / `user_id` accepted as GraphQL/API input** instead of derived from the JWT (cross-tenant leak)
3. **Direct SQS publish for a send without an `app_queue` row** (queue bypass)
4. **Relative imports** (`../`) or **extension on `src/` imports**
5. **Default exports** in non-resolver/non-schema files
6. **Semicolons, double quotes, or trailing commas** (prettier rules)
7. **Raw SQL string-concatenating user input** (must be parameterized)
8. **Sensitive REST route without `authorizer()`** — or a GraphQL mutation/query without `@auth` (email/tracking modules) — on auth/tenant data
9. **Entity without the uuid `@PrimaryColumn` + `@BeforeInsert generateId()` convention**
10. **`roles` (or any authorization claim) accepted from client input** in auth endpoints — auth claims must be derived server-side (`auth.service.ts`)
11. **A second JWT/`verify` layer** alongside `@openlytic/auth` (e.g. importing the unused `src/utils/jwt.ts`)

---

## Tech Debt & Legacy Warnings

1. **TypeORM 0.3**: Follow 0.3 API (class entities with decorators, `dataSource.getRepository`, `EntityManager`). Do not suggest v0.4/v1 migrations.
2. **`CustomError` is a single class** — no subclass hierarchy. Services re-throw with `new CustomError(err?.statusCode || 500, err?.message)`.
3. **`ssl: { rejectUnauthorized: false }` in production** (`database.ts`) — required for current DB infrastructure. Do not enable strict verification without explicit permission.
4. **50 MB JSON body limit** (`server.ts`) — intentional. Do not reduce.
5. **`email.service.ts` `to_emails`/`cc_emails`/`bcc_emails` arrays are the source of truth** — `email_recipients` rows are the per-recipient projection; edits must stay consistent with Gain.io semantics.
6. **Inbox sync (`sync_emails` → `sync_history`) is out of scope** — the entity/table exists and is registered; there is intentionally no service or queue `sync_emails` trigger yet.

7. **`@openlytic/auth` reads its env directly from `process.env`**: `ACCESS_TOKEN_EXPIRY` (default `1d`), `REFRESH_TOKEN_EXPIRY` (default `30d`), `APPLICATION_TOKEN`, `JWT_SECRET`, `APP_URL`. These are documented in `.env.sample`; do not remove them.

8. **Login roles default to `['user']`** in `auth.service.ts` — the `app_user`/`organization_user`/roles tables (with per-user roles) are not ported yet. `loginAnApplication` provides `public`/`service_manager` for the seeded app users. Admin REST routes (`/auth/set-user-email`, `/auth/set-user-password`) exist behind `authorizer(['admin', 'manager', ...])` but are unreachable until those roles are granted (future branch).

---

## Technology Stack Reference

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js 20+                                       |
| Framework       | Express 4                                         |
| GraphQL         | Apollo Server 4, @graphql-tools, graphql-ws       |
| Database        | PostgreSQL via TypeORM 0.3                        |
| Language        | TypeScript (tsx for dev, esbuild for build → CJS) |
| Auth            | `@openlytic/auth` (bcryptjs, jsonwebtoken) — file: dependency on ../Backend.Service.Auth |
| Cloud           | AWS (SQS) — localstack for local dev              |
| Lint            | ESLint 8 + Prettier                               |
| Package Manager | pnpm                                              |

---

## Self-Maintenance — Keeping This File Current

<!-- LAST AUDITED: 2026-08-16 -->

This file is the single source of truth for Copilot and agent behavior. **Agents MUST update this file as part of any change that alters the facts documented here.** Do not treat this file as read-only — it is a living document.

### When to Update (Triggers)

| Trigger                                  | What to Update                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **New module added**                     | Update the module list in "Architecture Overview", and any counts in "Project Persona".                                |
| **New dependency introduced**            | Add a row to "Technology Stack Reference" if foundational. Add a "Tech Debt & Legacy Warnings" entry if it has quirks. |
| **New naming convention adopted**        | Add a row to the "Naming Conventions" table.                                                                           |
| **New architectural pattern**            | Add a subsection under "Architectural Patterns" with rationale + example.                                              |
| **New "DO NOT Refactor" guardrail**      | Add a numbered item to "PR Review Guardrails → DO NOT Refactor" with a clear rationale.                                |
| **New "ALWAYS Flag" rule**               | Add a numbered item to "PR Review Guardrails → ALWAYS Flag".                                                           |
| **Queue/SQS envelope convention change** | Update the "Queue / SQS Envelope" subsection — co-commit with the email service consumer.                              |
| **Build/deploy pipeline change**         | Update "Architecture Overview" or "Technology Stack Reference" as appropriate.                                         |
| **Formatting/lint rule change**          | Update "Formatting" under "Style Guide".                                                                               |
| **New top-level `src/` directory**       | Add the directory to "Architecture Overview" with a comment.                                                           |

### How to Update

1. **Inline edit** — modify the specific section, table row, count, or code example. Do not append a changelog.
2. **Update the `LAST AUDITED` date** in the HTML comment above this section to the current date.
3. **Run `npm run lint`** after saving.
4. **Commit this file alongside the code changes** that triggered the update — never in a separate PR.

### Periodic Audit

When an agent detects staleness during normal work, fix it immediately:

- Module/barrel counts that no longer match actual files
- Architecture tree entries for files/directories added or removed
- Tech stack versions that differ from `package.json`
- Naming convention examples that reference deleted/renamed files
- "Tech Debt & Legacy Warnings" items that have been resolved

---

## PR Review Process (Impact Analysis & Senior-Dev Checklist)

> Complements "PR Review Guardrails" above. This is the **process**: review the diff, then the **blast radius** (unchanged code the diff affects), then the checklist. Keep reviews cheap: delegate mechanical fan-out (call-site discovery, context gathering) to the **cheapest capable model** and reserve the strong model for judgment — see `.agents/instructions.md` (Model Selection & Cost Efficiency).

### Impact Analysis — review unchanged files too

A change is not just its diff. For every **exported** symbol the PR touches — service/helper function, entity, GraphQL type/field, barrel export, middleware, util — find and re-verify **all call sites, including files not in the PR**:

| If the PR changes…                                   | Trace and re-verify (often unchanged files)                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A service/helper **signature or return shape**       | Every resolver + sibling service that calls it (`useTransaction` threading, return shape, camelCase aliases)                              |
| An **entity** (column / association / table)         | Helpers' query builders + raw-SQL literals, the module's `.graphql` type, and whether a schema rebuild (`db:sync`) or migration is needed |
| A **GraphQL typedef** (field / type / nullability)   | The matching resolver exists + is registered in `resolvers/index.ts`; **breaking changes** vs frontend consumers                          |
| A **barrel export** (`entities/helpers/services.ts`) | Every importer of that alias                                                                                                              |
| **Auth directive / middleware / subscription**       | All resolvers gated by `@auth`; PubSub publishers ↔ subscribers                                                                           |
| `src/utils/*` (database, error, sqs-client, jwt)     | High fan-out — verify broadly, not just the diff                                                                                          |
| The **SQS envelope** or `app_queue` lifecycle        | Email service consumer (separate repo) compatibility — `event`/`queue_id`/`params` contract, retry/backoff semantics                      |

**Find call sites mechanically (don't eyeball):**

- `graphify affected "functionName()"` (reverse traversal / blast-radius) when `graphify-out/` exists, or `graphify query "who calls functionName"`.
- Otherwise grep the **barrel alias** + bare name: `grep -rn "emailService.createEmail\|createEmailForMutation" src/`.
- Fan this out with cheap, parallel agents; reserve a stronger model to judge whether each site actually breaks.

### Senior-Dev Review Checklist

Beyond the "ALWAYS Flag" spot rules, verify:

- **Tenancy (highest risk):** `organization_id` / `user_id` derived from the JWT, never client input; queries scoped by org. A missing scope is a cross-tenant data leak.
- **Auth:** new mutations / sensitive queries carry `@auth(roles)`; never reimplement JWT.
- **Transactions:** mutations wrapped in `useTransaction()`; transaction threaded into every write (no half-commits).
- **Queue discipline:** every send/retry goes through `app_queue`; SQS publish only after a durable row is `ready`; retry backoff by `retry_count`.
- **Projection idempotency:** `email_analytics` upserts only move counters/timestamps forward; `dedupe_key` on `mail_tracking_events` collapses duplicates.
- **Query efficiency:** no per-row queries (N+1); list endpoints paginate; raw SQL where performance-critical is kept raw.
- **GraphQL back-compat:** no removed/renamed fields or new non-null on existing types; type/field ordering respected.
- **Error handling:** `CustomError(statusCode, message)`; correct status; services re-throw wrapped errors.
- **DB safety:** schema changes via `db:sync` only in dev; `syncDBEntities()` never called at runtime; no column drops without a plan.
- **Security:** parameterized SQL only; no secrets in code or logs; tracking tokens HMAC-signed with `TRACKING_SECRET`.
- **Observability:** dev logging deliberate; no PII in logs; failures recorded as `last_error` in the `app_queue` row.
- **Conventions:** barrel imports; `src/` alias; no semicolons/double quotes/trailing commas; uuid entities.
- **Verification (no test framework):** the PR states how it was verified; `lint` + `typecheck` clean; entity/auth/queue changes call out manual testing performed.
- **Scope:** the PR does one thing; flag unrelated drive-by edits and instruction-doc drift (update docs in the **same** PR per Self-Maintenance).

### Review Efficiency

1. **Triage:** read the diff + PR description; classify risk (entities / auth / queue-lifecycle / migrations = high).
2. **Scope the blast radius** with `graphify`/grep — open only the impacted unchanged files, highest-risk first.
3. **Delegate** mechanical discovery to cheap agents; spend the strong model on judgment calls.
4. **Report** concrete, line-anchored findings with a suggested fix; separate blocking issues from nits.
