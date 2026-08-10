<!-- PURPOSE: Behavioral and planning rules for Antigravity Agent Manager and autonomous coding agents. -->
<!-- This file governs how AI agents plan, execute, and validate multi-file changes in this repository. -->
<!-- Agents MUST read and follow .github/copilot-instructions.md for all style and architectural rules. -->

# Agent Instructions — Openlytic Backend API Server

## Knowledge Inheritance

**Before performing any code generation or modification, agents MUST read and internalize the rules in `.github/copilot-instructions.md`.** That file is the single source of truth for:

- Formatting rules (no semicolons, single quotes, 2-space indent, no trailing commas)
- Naming conventions (file names, variables, constants, entities, GraphQL types)
- Import rules (absolute `src/` imports only, barrel files only, no extension)
- Export rules (named exports only, default exports only for resolvers + schema)
- Layer separation (Resolver → Service → Helper → Entity)
- Transaction patterns (`useTransaction()` wrapping all mutations)
- Error handling (`CustomError(statusCode, message)` — `UPPER_SNAKE_CODE` messages optional)
- Queue / SQS envelope conventions (`{ event, queue_id, params }`)

**If any instruction below conflicts with `.github/copilot-instructions.md`, the copilot-instructions file takes precedence.**

---

## The Planning Protocol

### Mandatory Plan-Before-Edit Rule

For any task that modifies **2 or more files**, the agent MUST output a structured plan in Markdown and wait for user approval before executing changes.

### Plan Format

```markdown
## Change Plan: [Brief Description]

### Affected Files

| #   | File Path                               | Action | Summary                          |
| --- | --------------------------------------- | ------ | -------------------------------- |
| 1   | src/modules/{module}/{module}.entity.ts | CREATE | New TypeORM entity              |
| 2   | src/modules/entities.ts                 | MODIFY | Add entity import + registration |

### Dependency Order

1. Entity first (other layers depend on it)
2. Helper (data access, query builders)
3. Service (business logic)
4. GraphQL typeDefs + resolvers
5. Barrel file registrations (entities.ts, helpers.ts, services.ts)

### Risks & Assumptions

- [Any assumptions about existing data or schema]
- [Any destructive operations requiring confirmation]
```

### Exceptions to Planning

A plan is **not required** for:

- Single-file edits (bug fixes, adding a field to an entity)
- Formatting-only changes
- Adding entries to barrel files as part of an already-approved plan

---

## Tool Usage Rules

### After Every Code Change

1. **Run the linter**: `npm run lint` — all changes must pass ESLint + Prettier before committing
2. **Run the typecheck**: `npm run typecheck` (`tsc --noEmit`) — the API server is TypeScript
3. **Verify imports**: Confirm all new imports use `src/` absolute paths (tsconfig `paths` + tsx/esbuild alias) and reference barrel files

### Terminal Commands

| Action               | Command                       | Notes                                    |
| -------------------- | ----------------------------- | ---------------------------------------- |
| Install dependencies | `npm i`                       | Uses npm (the repo lockfile is npm)      |
| Run dev server       | `npm run dev`                 | `tsx watch src/server.ts` (hot reload)   |
| Lint check           | `npm run lint`                | ESLint validation                        |
| Lint fix             | `npm run lint-fix`            | Auto-fix linting issues                  |
| Typecheck            | `npm run typecheck`           | `tsc --noEmit`                           |
| Format               | `npm run format`              | Prettier format all files                |
| Build                | `npm run build`               | lint + typecheck + esbuild bundle → dist |
| Schema rebuild       | `npm run db:sync`             | dev-only (drops `public` schema first)   |

### Database Operations

- **Never run raw SQL directly** against the database unless the existing helper already does (e.g. the `email-analytic` projection upsert) — use TypeORM repositories and `useTransaction()`
- **`src/db-sync.ts` is destructive** (drops + recreates the schema from entities) — run it only when explicitly asked; never in the request flow
- **`syncDBEntities()` in `entities.ts` stays commented out** — never call it or re-enable auto-sync

### GraphQL Operations

- All `.graphql` type definitions are **auto-merged** by `src/graphql/schema.ts` (via `loadFilesSync`) — never hand-register typeDefs
- New resolvers must be registered in `src/graphql/resolvers/index.ts`
- The **`@auth` directive** is applied at the schema level (`directives/auth.ts`); mutations and sensitive queries declare `@auth(roles: [...])` in the typeDefs
- **File ordering in `.graphql` files**: All type/input/enum definitions must come **first**, followed by the operation blocks (Query/Mutation/Subscription) at the **bottom**.
- **Field ordering within types**: `id` always **first**; `created_at`/`updated_at` always **last** (in that order); other fields in **ascending alphabetical order**

---

## Scope Limits

### NEVER Modify Without Explicit Permission

| File / Directory                | Reason                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| `Dockerfile` / `docker-compose.yml` | Container/build definitions — affects all environments     |
| `.env.sample`                   | Environment variable template — shared across the team           |
| `src/utils/database.ts`         | DataSource + pool config, `useTransaction()` lock_timeout — critical infrastructure |
| `src/graphql/directives/auth.ts` | Auth directive — security-critical, affects all endpoints       |
| `src/modules/entities.ts`       | Centralized entity registry — fragile, high-impact               |
| `package.json` (dependencies)   | Adding/removing packages requires discussion                     |
| `.eslintrc.json`                | Linting rules affect entire codebase                             |
| `tsconfig.json`                 | Compiler options affect the whole project                        |

### Safe to Modify Autonomously

| File / Directory                           | Conditions                                                   |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/modules/{module}/{module}.service.ts` | Follow service patterns; wrap mutations in `useTransaction()` |
| `src/modules/{module}/{module}.helper.ts`  | Follow helper patterns; use `getRepository(entity, tx)`       |
| `src/modules/{module}/{module}.entity.ts`  | Follow TypeORM entity patterns (`@PrimaryColumn` + `@BeforeInsert generateId()`) |
| `src/graphql/typeDefs/{module}.graphql`    | Follow naming conventions; include `@auth` on mutations       |
| `src/graphql/resolvers/{module}/`          | Keep resolvers thin; wrap mutations in `useTransaction()`     |
| `src/modules/services.ts`                  | Adding new barrel exports only                                |
| `src/modules/helpers.ts`                   | Adding new barrel exports only                                |

---

## New Module Checklist

When creating a new module (e.g., `analytics`), the agent MUST create the following files in order:

1. **Entity**: `src/modules/{module}/{module}.entity.ts`
   - TypeORM class with `@Entity({ name: '{table_name}' })` and the `@PrimaryColumn` uuid + `@BeforeInsert generateId()` convention
   - Include `organization_id` for multi-tenancy where applicable; snake_case column names via `@Column({ name })`

2. **Entity Registration**: add import + entry in `src/modules/entities.ts`

3. **Helper**: `src/modules/{module}/{module}.helper.ts`
   - Export constants, query builders, and `…ForQuery` functions (`getRepository(entity, transaction?)`)
   - **Helpers that run raw SQL must keep the existing patterns** (e.g. `email-analytic.helper.ts`)

4. **Helper Registration**: add barrel export in `src/modules/helpers.ts`

5. **Service**: `src/modules/{module}/{module}.service.ts`
   - Import from `src/modules/helpers` and `src/modules/services`
   - Every mutation must accept and pass `transaction` to `getRepository`

6. **Service Registration**: add barrel export in `src/modules/services.ts`

7. **GraphQL TypeDef**: `src/graphql/typeDefs/{module}.graphql`
   - Types/inputs first, operation blocks at the bottom
   - Add `@auth(roles: [...])` to mutations and sensitive queries

8. **GraphQL Resolvers**: `src/graphql/resolvers/{module}/{module}.mutation.ts` and `{module}.query.ts`
   - Mutations wrapped in `useTransaction()`
   - Register in `src/graphql/resolvers/index.ts` (both Query and Mutation spreads)

9. **REST (only if needed)**: route in `src/routes/index.ts`

---

## Code Generation Rules

### Writing Service Functions

```typescript
// CORRECT: always accept transaction, wire the durable queue when relevant
export const createAnXForMutation = async (
  inputData: CreateXInputData,
  user: userInterface,
  transaction: EntityManager
) => {
  const repo = getRepository(XEntity, transaction)
  const x = await repo.save(repo.create({ ...inputData, organization_id: user.organizationId }))
  return x
}
```

### Writing Helper Functions

```typescript
// CORRECT: use getRepository, transaction-aware, UPPER_SNAKE_CASE constants
export const X_ENTITY_NAME = 'x'
export const getAnX = async (id: string, transaction?: EntityManager) =>
  getRepository(XEntity, transaction).findOne({ where: { id } })
```

### Writing GraphQL TypeDefs

```graphql
# CORRECT: types first; id first, then alpha, created_at/updated_at last
type X {
  id: UUID
  name: String!
  organization_id: UUID
  created_at: Date
  updated_at: Date
}

input XCreateInputType {
  name: String!
}

extend type Mutation {
  createAnX(inputData: XCreateInputType!): X
    @auth(roles: ["admin", "org_owner"])
}
```

---

## Error Recovery

If a multi-file change causes lint or runtime errors:

1. **Do not revert all changes** — isolate the failure
2. Run `npm run lint` and `npm run typecheck` to identify the exact file and line
3. Fix the specific issue (usually missing imports, wrong barrel path, or formatting)
4. Re-run both to confirm the fix
5. If the dev server was running, check the terminal for runtime errors

If a change to `src/modules/entities.ts` breaks:

1. Check that the imported entity name matches the exported class exactly
2. Verify the `@Entity({ name })` table name matches the DB table
3. Ensure the entity is in the `entities` array **and** the named re-export block

---

## Self-Maintenance — Keeping Instruction Files Current

<!-- LAST AUDITED: 2026-08-10 -->

Both this file (`.agents/instructions.md`) and `.github/copilot-instructions.md` are **living documents**. Agents MUST update them as part of any change that makes their content inaccurate.

### Triggers and Responsibilities

| Trigger                                         | File to Update                    | Action                                                                                        |
| ----------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| **New module added**                            | `.github/copilot-instructions.md` | Update module/domain counts in "Project Persona" and "Architecture Overview".                 |
| **New module added**                            | `.agents/instructions.md`         | Verify the "New Module Checklist" still matches the actual steps taken.                        |
| **New file added to Scope Limits**              | `.agents/instructions.md`         | Add the file to "NEVER Modify" or "Safe to Modify" table with rationale.                       |
| **Terminal command or script changed**          | `.agents/instructions.md`         | Update the "Terminal Commands" table to match `package.json` scripts.                         |
| **New convention or pattern introduced**        | `.github/copilot-instructions.md` | Add to the relevant section (Naming, Architectural Patterns, Import/Export Rules, etc.).       |
| **New "DO NOT Refactor" or "ALWAYS Flag" rule** | `.github/copilot-instructions.md` | Add a numbered item to the appropriate "PR Review Guardrails" list.                           |
| **Queue/SQS envelope conventions changed**      | `.github/copilot-instructions.md` | Update the queue conventions section (currently `{ event, queue_id, params }`).               |
| **Code generation pattern changed**             | `.agents/instructions.md`         | Update the code examples to match the new pattern.                                            |
| **GraphQL schema conventions changed**          | Both files                        | Update "GraphQL Field/File Ordering" sections plus the typeDef example.                       |
| **Build/deploy infrastructure changed**         | `.github/copilot-instructions.md` | Update "Architecture Overview" and "Technology Stack Reference".                              |
| **Formatting/lint rules changed**               | `.github/copilot-instructions.md` | Update the "Formatting" section to reflect the current ESLint/Prettier config.                |
| **Planning protocol or scope limits adjusted**  | `.agents/instructions.md`         | Update the relevant section directly.                                                         |

### Update Protocol

1. **Edit in place** — modify the specific section, table row, count, or code example. Do not append a changelog.
2. **Update the `LAST AUDITED` date** in the HTML comment at the top of this section (and in `.github/copilot-instructions.md` if that file was also updated) to the current date.
3. **Commit instruction file changes alongside the code changes** that triggered them — never in a separate commit or PR.
4. **Run `npm run lint`** after editing.

---

## Model Selection & Cost Efficiency (Spawning Sub-Agents)

> Goal: **maximize token/cost efficiency without compromising output.** Default to the **cheapest model that can do the task correctly**, and escalate only when the task genuinely needs stronger reasoning. Never run a flagship model where a cheaper one returns the same result.

### Tier the work to the model

| Tier                | Model (current)     | Use for                                                                                                                                                            |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cheap / scout**   | `claude-haiku-4-5`  | Exploration & file reading, locating code, grep/symbol search, gathering context, enumerating call sites, summarizing files, simple mechanical edits              |
| **Default / build** | `claude-sonnet-4-6` | Day-to-day implementation: new modules following the Entity→Helper→Service→Resolver pipeline, writing/editing services/helpers/resolvers/typedefs, lint fixing    |
| **Strong / judge**  | `claude-opus-4-8`   | Only where it adds real value: cross-module architecture decisions, tricky multi-file debugging, tenant-safety / security review, ambiguous trade-offs              |

Always use the current model IDs above; do not hardcode older generations.

### The scout → build → judge pattern

1. **Scout (Haiku):** fan out cheap agents to read relevant files and return a **distilled** summary — paths, signatures, and the few facts that matter.
2. **Build (Sonnet):** hand that distilled context to a Sonnet agent to implement/edit.
3. **Judge (Opus, only if warranted):** escalate only for high-stakes verification — security/tenancy, architecture, or when Sonnet is uncertain.

### Rules

1. **Start cheap, escalate on signal** — pick the lowest tier that can plausibly succeed; never default to Opus.
2. **Parallelize cheap, serialize expensive** — run many Haiku scouts concurrently; use a single strong agent for final judgment.
3. **Pass distilled context, not raw files** — a scout's job is to shrink context for the next tier.
4. **Right-size — don't over-spawn** — a single-file lookup you can do inline needs no sub-agent.

### Periodic Audit Checks

During normal work, if an agent notices any inconsistencies, it MUST fix them immediately:

- Module counts in "Project Persona" or "Architecture Overview" that don't match `src/modules/`
- Barrel file counts that differ from the actual export count
- "Terminal Commands" table entries that don't match `package.json` scripts
- "New Module Checklist" steps that differ from how the most recent module was created
- "Code Generation Rules" examples that use outdated patterns or wrong barrel paths
- "Scope Limits" entries for files that have been deleted, renamed, or moved
- Tech stack versions that differ from `package.json` dependencies