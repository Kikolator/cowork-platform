# cowork-platform

White-label coworking management platform. Built for boutique coworking spaces (5--50 desks) that need bookings, memberships, passes, credits, and payments out of the box.

Each coworking business (tenant) gets its own branded subdomain, Stripe Connect account, and fully isolated data -- all running on a single shared infrastructure.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1, App Router, React 19 |
| Language | TypeScript 5.9 (strict, no `any`) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | Supabase (Postgres 15, Auth, Edge Functions, RLS) |
| Payments | Stripe Connect (Standard accounts) |
| Validation | Zod at all API boundaries |
| Forms | React Hook Form + Zod resolvers |
| Testing | Vitest (unit), Playwright (E2E) |
| Monorepo | Turborepo with npm workspaces |
| Deployment | Vercel (app), Supabase (database) |

## Project Structure

```
cowork-platform/
├── apps/
│   └── web/                      # Next.js application
│       ├── app/
│       │   ├── (app)/            # Authenticated space routes (dashboard, bookings, admin)
│       │   ├── (auth)/           # Login, auth callback, space claim routes
│       │   ├── (platform)/       # Platform-level routes (onboarding, space selection)
│       │   └── api/
│       │       ├── health/       # Health check endpoint
│       │       └── webhooks/
│       │           └── stripe/   # Stripe Connect webhook handler
│       ├── components/
│       │   ├── layout/           # Sidebar, header, navigation
│       │   └── ui/               # shadcn/ui primitives
│       ├── lib/
│       │   ├── booking/          # Availability, rules, formatting
│       │   ├── credits/          # Credit granting and expiry
│       │   ├── products/         # Product visibility rules
│       │   ├── space/            # Space resolution from hostname
│       │   ├── stripe/           # Stripe client, Connect, checkout, subscriptions, webhooks
│       │   └── supabase/         # Server, client, admin, middleware helpers
│       └── middleware.ts         # Space resolution + auth gate
├── packages/
│   └── db/                       # Database package
│       ├── docs/
│       │   └── MT-SCHEMA-SPEC.md # Full schema specification
│       ├── supabase/
│       │   ├── config.toml       # Local Supabase configuration
│       │   ├── migrations/       # 15 sequential migrations (00001--00015)
│       │   └── seed.sql          # Seed data for local development
│       └── types/
│           └── database.ts       # Auto-generated TypeScript types
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # PR validation pipeline
│   │   ├── deploy-dev.yml        # Dev migration + type generation
│   │   └── deploy-prod.yml       # Prod migration with approval gate
│   └── CICD_SETUP.md             # CI/CD setup instructions
├── docs/
│   ├── architecture.md           # System architecture documentation
│   └── development.md            # Local development guide
├── CLAUDE.md                     # AI assistant project context
├── turbo.json                    # Turborepo task configuration
└── package.json                  # Root workspace configuration
```

## Quick Start

### Prerequisites

- **Node.js >= 24** (see `.nvmrc`)
- **Docker** (for local Supabase)
- **Supabase CLI** (`npm install -g supabase`)

### Setup

```bash
# Clone and install
git clone <repo-url> && cd cowork-platform
npm install

# Start local Supabase (requires Docker)
cd packages/db
supabase start
supabase db reset          # Apply all migrations + seed data
cd ../..

# Configure environment
cp apps/web/.env.example apps/web/.env.local
# Fill in the values (see Environment Variables below)

# Start the dev server
turbo dev                  # Next.js on http://localhost:3000
```

## Commands

All commands are run from the repo root unless noted otherwise.

```bash
# Development
turbo dev                  # Start all apps in dev mode
turbo build                # Production build
turbo check-types          # TypeScript type checking
turbo lint                 # ESLint across all packages

# Testing
turbo test                 # Unit tests (Vitest)
turbo test:e2e             # E2E tests (Playwright)

# Database (run from packages/db/)
supabase start             # Start local Supabase
supabase db reset          # Reset + replay migrations + seed
supabase migration new X   # Create a new migration
supabase db push           # Push migrations to remote project

# Type generation (run from packages/db/)
supabase gen types typescript --local > types/database.ts

# Formatting
npm run format             # Prettier across the repo
```

## Environment Variables

The web app requires the following environment variables in `apps/web/.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUB_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Platform domain (e.g., `localhost:3000` or `app.cowork.com`) |
| `STRIPE_SECRET_KEY` | Stripe platform secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe platform webhook signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Connect webhook signing secret |
| `STRIPE_PLATFORM_FEE_PERCENT` | Platform fee percentage on connected payments (default: `3`) |

For local development with Supabase, the URL and keys are printed by `supabase start`.

## Key Concepts

- **Tenant** -- The billing entity (a coworking business/company). Owns a Stripe Connect account and one or more spaces.
- **Space** -- A physical coworking location within a tenant. Resolved from subdomain (`slug.platform.com`) or custom domain. All operational data is scoped to a space.
- **Member** -- A user with an active subscription at a specific space. One person can be a member at multiple spaces.
- **Plan** -- Configurable membership tier defined per space. Controls access level, pricing, and monthly credit allowances.
- **Credit** -- Time-based currency (in minutes) for booking resources. Granted monthly by subscription or purchased as hour bundles.
- **Pass** -- Day or week pass for non-members. Includes auto-assigned desk.

## Documentation

- [Architecture](docs/architecture.md) -- System design, multi-tenancy model, auth flow, data flow
- [Development Guide](docs/development.md) -- Local setup, database workflow, testing, CI/CD
- [Schema Specification](packages/db/docs/MT-SCHEMA-SPEC.md) -- Complete database schema reference
- [CI/CD Setup](/.github/CICD_SETUP.md) -- GitHub Actions configuration and secrets

## License

Private. All rights reserved.
