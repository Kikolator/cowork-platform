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
- **Data fetching**: TanStack Query v5 (client), Supabase JS (server)
- **Deployment**: Vercel

## Commands

```bash
turbo dev                  # Run all apps
turbo build                # Build all
turbo type-check           # Type-check all

# Database (from packages/db/)
supabase start             # Local Supabase
supabase db reset          # Reset + replay migrations + seed
supabase migration new X   # New migration
supabase db push           # Push to remote

# Type generation (from packages/db/)
supabase gen types typescript --local > types/database.ts
```

## Conventions

- Server Components by default. `'use client'` only when you need interactivity or hooks.
- Server Actions for mutations. API routes only for external webhooks.
- RLS on every table. No exceptions.
- Database types auto-generated. Never hand-edit `database.ts`.
- Small files (~200 lines max). One component per file.
- Colocate related files: page, components, actions, hooks in the same directory.

## Database

- Single Supabase project, multi-tenant via `tenant_id` on every table.
- RLS enforces tenant isolation.
- Plans, resource types, and business config are data (table rows), not enums.
- Enums only for universal status values (booking_status, member_status).
- Migrations are sequential, 5-digit zero-padded: `00001_name.sql`.
- Every table gets `id` (uuid), `created_at`, `updated_at`, `tenant_id`.

## Auth

- Magic link only (Supabase Auth).
- Tenant resolved from subdomain or custom domain in middleware.
- Admin role checked via `tenant_users` table, not JWT claims.

## Don't

- Don't use `any`. Use `unknown` and narrow.
- Don't hand-write database types.
- Don't mutate from Client Components directly — use Server Actions.
- Don't use API routes for internal mutations.
- Don't use Pages Router.
- Don't hardcode business logic that should be tenant-configurable (plans, hours, pricing).
- Don't use TypeScript enums. Use `as const` objects.