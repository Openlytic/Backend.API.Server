# Openlytic.Backend.API.Server

Control plane of Openlytic â€” Node 20+ + Express + Apollo GraphQL + **TypeScript** +
**TypeORM** (PostgreSQL). Mirrors the conventions of `Gain-IO.Backend.API.Server`:

- `src/modules/<domain>/` â€” `<domain>.entity.ts` (TypeORM entity), `<domain>.helper.ts`
  (data access, transaction manager-aware), `<domain>.service.ts` (business logic,
  wrapped in `useTransaction`).
- `src/graphql/typeDefs/*.graphql` â€” auto-merged by `schema.ts`.
- `src/graphql/resolvers/<domain>/{<domain>.query.ts,<domain>.mutation.ts}`.
- Barrels: `src/modules/{entities,helpers,services}.ts`.
- Imports via the `src/` alias (`tsconfig paths` + esbuild alias) â€” no relative `../`, no
  extension in imports.
- TypeORM entities are plain classes with `@Entity` decorators; DB columns stay snake_case
  via explicit `@Column({ name })`. Password is `select: false` (opts in via `addSelect`).

## Quick start

```bash
npm install
cp .env.sample .env
npm run db:sync      # drops + recreates the schema from TypeORM entities
npm run dev          # tsx watch, hot-reload
```

Open `http://localhost:8000/graphql` and run the `me` query with a bearer token obtained
from `signUp`.

## Scripts

- `dev` â€” run via tsx with watch
- `start` â€” run via tsx
- `db:sync` â€” dev-only schema rebuild (TypeORM `synchronize`, drops the `public` schema first)
- `typecheck` â€” `tsc --noEmit`
- `build` â€” lint + typecheck + esbuild bundle to `dist/index.js` (CJS; GraphQL SDL copied beside it)

## Env

Copy `.env.sample` to `.env` (or `.env.local`, which overrides). Requires a reachable
PostgreSQL â€” see the root `docker-compose.yml`.

OAuth secrets (`GMAIL_CLIENT_ID` / `OUTLOOK_CLIENT_ID` + secrets) are optional in dev;
leave blank and integration connects will return a clear "not configured" error.

## GraphQL surface

- `signUp(inputData)` / `logIn(inputData)` â†’ `AuthPayload` (access+refresh JWT + user)
- `me` â†’ current user profile (AppUser token)
- `integrations` â†’ the org's connected mailboxes
- `connectIntegration(provider)` â†’ OAuth authorize URL (browser redirect)
- `disconnectIntegration(id)`
- `createEmail(...)` â†’ queues a send job to the email service (SQS)

## Domains

- auth (sign up / log in)
- organization (tenant)
- user
- integration (gmail / outlook OAuth + token store)
- provider (OAuth URL building, token exchange)
- email (draft â†’ queue â†’ track)

## REST routes

- `GET /health`
- `GET /oauth/callback` â€” provider redirect target for integration connects
