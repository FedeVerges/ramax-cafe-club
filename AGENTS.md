# Repository Guidelines

## Project structure

This pnpm monorepo separates deployable apps from shared code:

- `apps/web`: React 19 and Vite SPA. Screens and routing live in `src/app`; CSS is in `src/styles.css`.
- `apps/api`: NestJS API. Add domain work under `src/modules/<domain>` and database wiring under `src/database`.
- `packages/contracts`: types and helpers shared by the API and web app.
- `db/schema`: Drizzle table definitions. Generated, versioned migrations belong in `db/migrations` and should not be hand-edited after use.
- `docs`: product scope, delivery plan, import notes, and ADRs. Read `CONTEXT.md` for domain language.

## Build and development commands

Run commands from the repository root:

```bash
corepack pnpm install             # install workspace dependencies
docker compose up -d postgres     # start PostgreSQL on port 5433
corepack pnpm dev:api             # run NestJS in watch mode
corepack pnpm dev:web             # run Vite locally
corepack pnpm check               # type-check every workspace
corepack pnpm test                # run all Vitest suites
corepack pnpm build               # build all packages and apps
```

After schema changes, run `corepack pnpm --filter @ramax/api db:generate`, review the migration, then run `db:migrate`. Copy `.env.example` to `.env`; use `seed:admin` to create the first administrator.

## Coding style and naming

Use strict TypeScript, two-space indentation, double quotes, and semicolons. Keep files in kebab-case, React components and NestJS classes in PascalCase, and functions or variables in camelCase. Keep controllers thin, place business rules in services or pure policy modules, and define cross-app request or response types in `packages/contracts`. Preserve the Spanish domain terms defined in `CONTEXT.md`.

## Testing

Vitest is the test runner. Co-locate tests as `*.test.ts`, as in `sale-policy.test.ts`. Cover business rules, validation failures, and shared contracts. There is no enforced coverage threshold; each behavior change should include a focused regression test. Run `corepack pnpm test` and `corepack pnpm check` before opening a pull request.

## Commits and pull requests

History mostly follows Conventional Commits, often with scopes: `feat(web/sales): implement transaction receipt` or `docs: add architecture decision records`. Use an imperative subject and keep each commit focused. Pull requests should explain the user-visible change, list verification commands, link the relevant issue or plan item, and include screenshots for UI work. Call out schema migrations, environment changes, and deferred follow-ups explicitly.

## Security and configuration

Never commit `.env`, credentials, session secrets, or production data. Validate all API input with DTOs, enforce permissions in guards, and keep inventory, sales, and audit updates transactional when they form one operation.
