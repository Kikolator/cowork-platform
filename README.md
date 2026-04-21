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
| Observability | Vercel Analytics, structured logging, error boundaries |
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
│   │   │   │   ├── store/          # Product store (passes, hour bundles)
│   │   │   │   ├── referrals/      # Member referral program
│   │   │   │   └── admin/          # Role-gated admin section
│   │   │   │       ├── bookings/   # Daily view, walk-ins
│   │   │   │       ├── members/    # Directory, import, bulk actions
│   │   │   │       ├── leads/      # Sales pipeline
│   │   │   │       ├── passes/     # Day/week passes
│   │   │   │       ├── plans/      # Tier configuration
│   │   │   │       ├── products/   # Store catalogue
│   │   │   │       ├── resources/  # Desks, rooms, pricing
│   │   │   │       ├── referrals/  # Referral program config
│   │   │   │       ├── invoices/   # Admin billing view
│   │   │   │       ├── import/     # Bulk imports
│   │   │   │       └── settings/   # Branding, hours, features, Stripe Connect
│   │   │   ├── (auth)/             # Login, auth callback, space claim
│   │   │   ├── (platform)/         # Onboarding, space selection
│   │   │   ├── checkout/           # Guest checkout flow
│   │   │   └── api/
│   │   │       ├── health/         # Health check endpoint
│   │   │       ├── cron/
│   │   │       │   └── renew-credits/ # Daily manual credit renewal
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
│   │   └── proxy.ts                # Space resolution + auth gate (Next.js 16)
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
│   │   │   ├── migrations/          # SQL migrations (sequential + timestamped)
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

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUB_KEY` | Yes | Supabase publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key (`sb_secret_...`) — server-only, bypasses RLS |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | No | Platform domain (default: `localhost:3000`) |
| `NEXT_PUBLIC_APP_ENV` | No | Set to `development` to enable dev-only features (e.g. password auth) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (use test mode key for dev) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe platform webhook signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Yes | Stripe Connect webhook signing secret |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `CRON_SECRET` | Yes | Bearer token for Vercel Cron Job authentication |

### Admin App (`apps/admin/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUB_KEY` | Yes | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key — server-only |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | No | Platform domain |
| `NEXT_PUBLIC_APP_ENV` | No | Set to `development` for dev login features |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |

### Mobile App (`apps/mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUB_KEY` | Yes | Supabase publishable key |

For local development, Supabase URL and keys are printed by `supabase start`.

## Stripe Setup

The platform uses Stripe Connect (Standard accounts) for multi-tenant payments. Each tenant connects their own Stripe account.

### 1. Create webhook endpoints

You need **two** webhook endpoints in the Stripe Dashboard, both pointing to the same URL:

**URL:** `https://<your-domain>/api/webhooks/stripe`

#### Platform webhook (regular)

Create under **Developers > Webhooks > Add endpoint**. Enable these events:

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Process completed store purchases |
| `invoice.paid` | Grant monthly credits on subscription renewal |
| `invoice.payment_failed` | Flag failed subscription payments |
| `customer.subscription.updated` | Sync plan changes |
| `customer.subscription.deleted` | Handle subscription cancellations |

Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

#### Connect webhook

Create under **Developers > Webhooks > Add endpoint**, then toggle **"Listen to events on Connected accounts"**. Enable these events:

| Event | Purpose |
|-------|---------|
| `account.updated` | Track Connect onboarding completion |
| `checkout.session.completed` | Process completed store purchases |
| `invoice.paid` | Grant monthly credits on subscription renewal |
| `invoice.payment_failed` | Flag failed subscription payments |
| `customer.subscription.updated` | Sync plan changes |
| `customer.subscription.deleted` | Handle subscription cancellations |

Copy the signing secret → `STRIPE_CONNECT_WEBHOOK_SECRET`

### 2. Webhook verification

The webhook handler tries to verify the signature with `STRIPE_CONNECT_WEBHOOK_SECRET` first, then falls back to `STRIPE_WEBHOOK_SECRET`. Events from connected accounts (containing `event.account`) are routed as Connect events.

### 3. Local development

For local testing, use the Stripe CLI to forward events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret it prints
```

## Key Concepts

- **Tenant** -- The billing entity (a coworking business/company). Owns a Stripe Connect account and one or more spaces.
- **Space** -- A physical coworking location within a tenant. Resolved from subdomain (`slug.platform.com`) or custom domain. All operational data is scoped to a space.
- **Member** -- A user with an active subscription at a specific space. One person can be a member at multiple spaces.
- **Plan** -- Configurable membership tier defined per space. Controls access level, pricing, and monthly credit allowances.
- **Credit** -- Time-based currency (in minutes) for booking resources. Granted monthly by subscription or purchased as hour bundles.
- **Pass** -- Day or week pass for non-members. Includes auto-assigned desk.
- **Product** -- Store item (pass, hour bundle, addon, subscription). Has configurable visibility rules (plan-gated, exclude unlimited).
- **Referral** -- Member-to-member referral with configurable rewards (credits or subscription discounts).
- **Billing Mode** -- Per-member: `stripe` (Stripe invoices) or `manual` (admin handles billing externally).

## Architecture Highlights

- **Multi-tenancy**: Single database, shared schema. RLS policies enforce full data isolation per space via JWT claims.
- **Auth**: Magic link only (Supabase Auth). Tenant resolved from subdomain or custom domain in middleware.
- **Payments**: Stripe Connect Standard accounts per tenant. Platform collects configurable app fees (5/3/1% based on plan tier).
- **Booking**: Multi-slot desk selection with hourly time ranges. Overlap prevention via Postgres `EXCLUDE` constraints. Credits deducted FIFO by expiry date.
- **Access**: Nuki smart lock integration for door access codes per member.
- **Email**: Branded transactional emails via Resend + React Email (welcome, booking confirmations, invoices).
- **Store**: Product catalogue with per-resource-type visibility rules. Passes, hour bundles, and subscription addons.
- **Referrals**: Configurable reward programs (credit grants or subscription discounts) with atomic completion tracking.
- **Observability**: Vercel Analytics, structured logging (`@cowork/shared` logger), React error boundaries.
- **Cron**: Daily credit renewal for manual-billing members (Vercel Cron Jobs).
- **Feature Flags**: Per-space feature toggles (passes, credits, guest passes, referrals) stored in `spaces.features` JSONB.
- **Mobile**: Expo with Expo Router. All data fetched client-side via Supabase SDK + TanStack Query. RLS is the security boundary.

## Documentation

- [Architecture](docs/architecture.md) -- System design, multi-tenancy model, auth flow, data flow
- [Development Guide](docs/development.md) -- Local setup, database workflow, testing, CI/CD
- [Schema Specification](packages/db/docs/MT-SCHEMA-SPEC.md) -- Complete database schema reference
- [CI/CD Setup](.github/CICD_SETUP.md) -- GitHub Actions configuration and secrets

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Copyright (C) 2026 SAVAGE HUB SL.
