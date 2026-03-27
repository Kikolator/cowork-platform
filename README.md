# cowork-platform

White-label coworking management platform. Built for boutique coworking spaces (5--50 desks) that need bookings, memberships, passes, credits, and payments out of the box.

Each coworking business (tenant) gets its own branded subdomain, Stripe Connect account, and fully isolated data -- all running on a single shared infrastructure.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1, App Router, React 19 |
| Mobile | Expo 55, React Native 0.83, Expo Router |
| Language | TypeScript 5.9 (strict, no `any`) |
| Styling | Tailwind CSS v4, shadcn/ui (web), NativeWind (mobile) |
| Backend | Supabase (Postgres 15, Auth, Edge Functions, RLS) |
| Payments | Stripe Connect (Standard accounts) |
| Email | Resend + React Email |
| Access Control | Nuki smart lock integration |
| Validation | Zod at all API boundaries |
| Forms | React Hook Form + Zod resolvers |
| Data Fetching | Supabase JS + `@supabase/ssr` (web), TanStack Query v5 (mobile) |
| Testing | Vitest (unit), Playwright (E2E) |
| Monorepo | Turborepo with npm workspaces |
| Deployment | Vercel (apps), Supabase (database), EAS (mobile) |

## Project Structure

```
cowork-platform/
├── apps/
│   ├── web/                        # Next.js tenant-facing app (:3000)
│   │   ├── app/
│   │   │   ├── (app)/              # Authenticated space routes
│   │   │   │   ├── dashboard/      # Member overview
│   │   │   │   ├── book/           # Desk & room booking
│   │   │   │   ├── bookings/       # Booking history
│   │   │   │   ├── profile/        # Member profile + avatar
│   │   │   │   ├── plan/           # Membership plans
│   │   │   │   ├── invoices/       # Member invoices
│   │   │   │   ├── access/         # Door access codes (Nuki)
│   │   │   │   └── admin/          # Role-gated admin section
│   │   │   │       ├── bookings/   # Daily view, walk-ins
│   │   │   │       ├── members/    # Directory, import, bulk actions
│   │   │   │       ├── leads/      # Sales pipeline
│   │   │   │       ├── passes/     # Day/week passes
│   │   │   │       ├── plans/      # Tier configuration
│   │   │   │       ├── products/   # Store catalogue
│   │   │   │       ├── resources/  # Desks, rooms, pricing
│   │   │   │       ├── invoices/   # Admin billing view
│   │   │   │       ├── import/     # Bulk imports
│   │   │   │       └── settings/   # Branding, hours, Stripe Connect
│   │   │   ├── (auth)/             # Login, auth callback, space claim
│   │   │   ├── (platform)/         # Onboarding, space selection
│   │   │   └── api/
│   │   │       ├── health/         # Health check endpoint
│   │   │       └── webhooks/
│   │   │           └── stripe/     # Stripe Connect webhook handler
│   │   ├── components/
│   │   │   ├── layout/             # Sidebar, header, navigation
│   │   │   └── ui/                 # shadcn/ui primitives
│   │   ├── emails/                 # React Email templates
│   │   │   ├── tenant/             # Space-branded transactional emails
│   │   │   └── platform/           # Platform-level notifications
│   │   ├── lib/
│   │   │   ├── booking/            # Availability, rules, formatting
│   │   │   ├── credits/            # Credit granting and expiry
│   │   │   ├── nuki/               # Smart lock API integration
│   │   │   ├── products/           # Product visibility rules
│   │   │   ├── space/              # Space resolution from hostname
│   │   │   ├── stripe/             # Stripe client, Connect, checkout, webhooks
│   │   │   └── supabase/           # Server, client, admin, middleware helpers
│   │   └── middleware.ts           # Space resolution + auth gate
│   ├── admin/                       # Platform admin dashboard (:3001)
│   │   └── app/
│   │       ├── (dashboard)/         # Tenant & space management
│   │       ├── auth/                # Platform admin auth
│   │       └── denied/              # Access denied page
│   └── mobile/                      # Expo mobile app
│       └── app/
│           ├── (app)/               # Authenticated routes
│           ├── (auth)/              # Login flows
│           └── index.tsx            # Entry point
├── packages/
│   ├── db/                          # Database package
│   │   ├── docs/
│   │   │   └── MT-SCHEMA-SPEC.md    # Full schema specification
│   │   ├── supabase/
│   │   │   ├── config.toml          # Local Supabase configuration
│   │   │   ├── migrations/          # 29 migrations
│   │   │   ├── functions/           # Edge functions (cron jobs)
│   │   │   └── seed.sql             # Seed data for local development
│   │   └── types/
│   │       └── database.ts          # Auto-generated TypeScript types
│   └── shared/                      # Shared logic (Zod schemas, constants, types)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                   # PR validation pipeline
│   │   ├── deploy-dev.yml           # Dev migration + type generation
│   │   └── deploy-prod.yml          # Prod migration with approval gate
│   └── CICD_SETUP.md               # CI/CD setup instructions
├── docs/
│   ├── architecture.md              # System architecture documentation
│   └── development.md               # Local development guide
├── CLAUDE.md                        # AI assistant project context
├── turbo.json                       # Turborepo task configuration
└── package.json                     # Root workspace configuration
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
cp apps/admin/.env.example apps/admin/.env.local
# Fill in the values (see Environment Variables below)

# Start the dev server
turbo dev                  # web on :3000, admin on :3001
```

### Mobile Setup

```bash
cd apps/mobile
cp .env.example .env
npx expo start             # Scan QR with Expo Go, or press i/a for simulators
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

# Mobile (run from apps/mobile/)
npx expo start             # Dev server (QR code for Expo Go)
eas build --platform ios   # Cloud build for iOS
eas build --platform android # Cloud build for Android

# Formatting
npm run format             # Prettier across the repo
```

## Environment Variables

### Web App (`apps/web/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUB_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Platform domain (e.g., `localhost:3000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe platform secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe platform webhook signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Connect webhook signing secret |
| `RESEND_API_KEY` | Resend email API key |

### Admin App (`apps/admin/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUB_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Platform domain |
| `STRIPE_SECRET_KEY` | Stripe platform secret key |

### Mobile App (`apps/mobile/.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUB_KEY` | Supabase publishable (anon) key |

For local development, Supabase URL and keys are printed by `supabase start`.

## Key Concepts

- **Tenant** -- The billing entity (a coworking business/company). Owns a Stripe Connect account and one or more spaces.
- **Space** -- A physical coworking location within a tenant. Resolved from subdomain (`slug.platform.com`) or custom domain. All operational data is scoped to a space.
- **Member** -- A user with an active subscription at a specific space. One person can be a member at multiple spaces.
- **Plan** -- Configurable membership tier defined per space. Controls access level, pricing, and monthly credit allowances.
- **Credit** -- Time-based currency (in minutes) for booking resources. Granted monthly by subscription or purchased as hour bundles.
- **Pass** -- Day or week pass for non-members. Includes auto-assigned desk.

## Architecture Highlights

- **Multi-tenancy**: Single database, shared schema. RLS policies enforce full data isolation per space via JWT claims.
- **Auth**: Magic link only (Supabase Auth). Tenant resolved from subdomain or custom domain in middleware.
- **Payments**: Stripe Connect Standard accounts per tenant. Platform collects configurable app fees (5/3/1% based on plan tier).
- **Booking**: Multi-slot desk selection with hourly time ranges. Overlap prevention via Postgres `EXCLUDE` constraints. Credits deducted FIFO by expiry date.
- **Access**: Nuki smart lock integration for door access codes per member.
- **Email**: Branded transactional emails via Resend + React Email (welcome, booking confirmations, invoices).
- **Mobile**: Expo with Expo Router. All data fetched client-side via Supabase SDK + TanStack Query. RLS is the security boundary.

## Documentation

- [Architecture](docs/architecture.md) -- System design, multi-tenancy model, auth flow, data flow
- [Development Guide](docs/development.md) -- Local setup, database workflow, testing, CI/CD
- [Schema Specification](packages/db/docs/MT-SCHEMA-SPEC.md) -- Complete database schema reference
- [CI/CD Setup](.github/CICD_SETUP.md) -- GitHub Actions configuration and secrets

## License

Private. All rights reserved.
