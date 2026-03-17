# cowork-platform

White-label coworking management platform. Turborepo monorepo.

## Structure

```
apps/web          → Next.js 16 (App Router) — the product
packages/db       → Supabase: migrations, edge functions, generated types
```

## Stack

- **Framework**: Next.js 16.1, App Router, Server Components by default
- **Language**: TypeScript (strict, no `any`)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Edge Functions, RLS)
- **Payments**: Stripe (Connect for multi-tenant)
- **Validation**: Zod at API boundaries
- **Data fetching**: Supabase JS (server + client via `@supabase/ssr`)
- **Deployment**: Vercel

## Commands

```bash
turbo dev                  # Run all apps
turbo build                # Build all
turbo check-types          # Type-check all
turbo lint                 # Lint all

# Database (from packages/db/)
supabase start             # Local Supabase
supabase db reset          # Reset + replay migrations + seed
supabase migration new X   # New migration
supabase db push           # Push to remote

# Type generation (from packages/db/)
supabase gen types typescript --local > types/database.ts

# Testing (from apps/web/)
turbo test                 # Unit tests (Vitest)
turbo test:e2e             # E2E tests (Playwright)
```

## Conventions

- Server Components by default. `'use client'` only when you need interactivity or hooks.
- Server Actions for mutations. API routes only for external webhooks.
- RLS on every table. No exceptions.
- Database types auto-generated. Never hand-edit `database.ts`.
- Small files (~200 lines max). One component per file.
- Colocate related files: page, components, actions, hooks in the same directory.

## DB Schema Spec

The database schema spec is at `packages/db/docs/MT-SCHEMA-SPEC.md`. 
Use it as the source of truth when implementing migrations. 
Implement one migration at a time. Never skip RLS or rollback comments.

## Database
- Migration version: 5 digits increment +1 from previous version.
- Current latest: `00015`. Next: `00016`.
- Security first.
- Creating a multi-tenant platform.

## Auth

- Magic link only (Supabase Auth).
- Tenant resolved from subdomain or custom domain in middleware.
- Admin role checked via `tenant_users` table, not JWT claims.

## Terminology

- **Tenant**: billing entity (org/company). Has Stripe Connect account.
- **Space**: a workspace within a tenant. Resolved from subdomain or custom domain.
- One tenant can have multiple spaces.

## Environment

- Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in values.
- Node >= 24 required (see root `package.json` engines).
- See `.github/CICD_SETUP.md` for CI/CD secrets and GitHub environment configuration.

## Git Commits

`feat:` · `fix:` · `refactor:` · `docs:` · `test:` · `chore:` · `db:` (migrations)

## Don't

- Don't use `any`. Use `unknown` and narrow.
- Don't hand-write database types.
- Don't mutate from Client Components directly — use Server Actions.
- Don't use API routes for internal mutations.
- Don't use Pages Router.
- Don't hardcode business logic that should be tenant-configurable (plans, hours, pricing).
- Don't use TypeScript enums. Use `as const` objects.
- Don't weaken validation, types, or security to work around test/dev data issues — fix the root cause instead.
