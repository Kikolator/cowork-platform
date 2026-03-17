# Development Guide

Everything you need to set up, develop, test, and deploy the cowork-platform.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 24 | Runtime (see `.nvmrc`) |
| npm | >= 11 | Package manager (set in `packageManager` field) |
| Docker | Latest | Required for local Supabase |
| Supabase CLI | Latest | Database management |

Install the Supabase CLI:

```bash
npm install -g supabase
```

---

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd cowork-platform
npm install
```

### 2. Start local Supabase

```bash
cd packages/db
supabase start        # Starts Postgres, Auth, Storage, etc. in Docker
supabase db reset     # Applies all migrations + seed data
```

After `supabase start`, the CLI prints the local URLs and keys:

```
API URL:   http://127.0.0.1:54321
anon key:  sb_publishable_...
service_role key: sb_secret_...
Studio URL: http://127.0.0.1:54323
```

### 3. Configure environment

Create `apps/web/.env.local` with:

```bash
# Supabase (from supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUB_KEY=<anon key from supabase start>
SUPABASE_SECRET_KEY=<service_role key from supabase start>

# Platform domain
NEXT_PUBLIC_PLATFORM_DOMAIN=localhost:3000

# Stripe (use test mode keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_FEE_PERCENT=3
```

### 4. Start the dev server

```bash
turbo dev
```

The app runs at `http://localhost:3000`. Since subdomains do not work on localhost, use the `?space=<slug>` query parameter to simulate space resolution (e.g., `http://localhost:3000/dashboard?space=demo`).

### 5. Access Supabase Studio

Open `http://127.0.0.1:54323` to inspect the database, manage auth users, and run SQL queries.

---

## Project Layout

```
apps/web/                         # Next.js application
├── app/
│   ├── (app)/                    # Authenticated space routes
│   │   ├── admin/                # Admin-only management pages
│   │   │   ├── bookings/         # Booking management
│   │   │   ├── leads/            # Sales pipeline
│   │   │   ├── members/          # Member directory
│   │   │   ├── passes/           # Pass management
│   │   │   ├── plans/            # Plan configuration
│   │   │   ├── products/         # Store catalogue
│   │   │   ├── resources/        # Resource management
│   │   │   └── settings/         # Space settings + Stripe Connect
│   │   ├── book/                 # Desk and room booking
│   │   ├── bookings/             # Member's booking list
│   │   ├── dashboard/            # Main dashboard
│   │   ├── plan/                 # Plan selection + subscription
│   │   ├── profile/              # User profile
│   │   └── store/                # Product store
│   ├── (auth)/                   # Authentication routes
│   │   ├── auth/callback/        # Magic link callback
│   │   ├── auth/set-space/       # Space claim route
│   │   └── login/                # Login page
│   ├── (platform)/               # Platform-level routes
│   │   ├── onboard/              # New tenant onboarding
│   │   └── spaces/               # Space selection
│   └── api/
│       ├── health/               # GET /api/health
│       └── webhooks/stripe/      # POST /api/webhooks/stripe
├── components/
│   ├── layout/                   # Sidebar, header, mobile nav, user menu
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── booking/                  # Availability calculations, booking rules
│   ├── credits/                  # Credit grant/expire logic
│   ├── products/                 # Product visibility filtering
│   ├── space/                    # Space resolution (resolve.ts, types.ts)
│   ├── stripe/                   # All Stripe integration
│   │   ├── client.ts             # Stripe SDK singleton
│   │   ├── connect.ts            # Connect account management
│   │   ├── checkout.ts           # Checkout session creation (one-time)
│   │   ├── subscriptions.ts      # Subscription management
│   │   ├── fees.ts               # Platform fee calculation
│   │   └── webhooks.ts           # Webhook event handlers
│   └── supabase/                 # Supabase client factories
│       ├── server.ts             # Server Component client (cookie-based)
│       ├── client.ts             # Browser client
│       ├── admin.ts              # Admin client (service role, bypasses RLS)
│       ├── middleware.ts          # Middleware session refresh
│       └── cookies.ts            # Cookie configuration
├── middleware.ts                  # Space resolution + auth guard
└── e2e/                          # Playwright tests

packages/db/                      # Database package
├── docs/
│   └── MT-SCHEMA-SPEC.md         # Schema specification (source of truth)
├── supabase/
│   ├── config.toml               # Supabase local config
│   ├── migrations/               # SQL migrations (00001--00015)
│   └── seed.sql                  # Local seed data
├── types/
│   ├── database.ts               # Auto-generated types (DO NOT EDIT)
│   └── index.ts                  # Package exports
└── package.json                  # @cowork/db package
```

### Conventions

- **Server Components by default.** Only add `'use client'` when you need interactivity or hooks.
- **Server Actions for mutations.** API routes are reserved for external webhooks only.
- **Colocate related files.** Pages, components, actions, hooks, and schemas live in the same directory.
- **Small files.** Target ~200 lines max. One component per file.
- **No `any`.** Use `unknown` and narrow. No TypeScript enums -- use `as const` objects.
- **RLS on every table.** No exceptions.
- **Never hand-edit `database.ts`.** It is auto-generated from the schema.

---

## Database Workflow

### Creating a new migration

```bash
cd packages/db

# Create the migration file
supabase migration new my_change_description
# This creates: supabase/migrations/00016_my_change_description.sql

# Edit the migration file
# Include: table changes, RLS policies, indexes, rollback comments

# Test locally
supabase db reset

# Regenerate TypeScript types
supabase gen types typescript --local > types/database.ts

# Return to root and verify everything compiles
cd ../..
turbo check-types
```

### Migration conventions

- **Version format**: 5-digit zero-padded, incrementing by 1. Current latest is `00015`, next is `00016`.
- **Always include RLS policies** for new tables.
- **Always include rollback comments** at the bottom of the migration.
- **One migration per change.** Do not batch unrelated changes.
- **Use the schema spec** at `packages/db/docs/MT-SCHEMA-SPEC.md` as the source of truth.
- **Security first.** Every space-scoped table gets `space_id` and RLS policies.

### Migration sequence (existing)

| Migration | Content |
|-----------|---------|
| `00001` | Platform foundation: extensions, enums, trigger functions, security functions, tenants, spaces, shared_profiles, space_users, platform_admins |
| `00002` | Resource types + rate config |
| `00003` | Plans + plan credit config |
| `00004` | Resources |
| `00005` | Members + member notes |
| `00006` | Products |
| `00007` | Bookings + recurring rules + availability functions |
| `00008` | Passes + auto-assign desk function |
| `00009` | Credits: grants, deductions, booking-with-credits, refunds, expiry |
| `00010` | Leads |
| `00011` | Stats, payment events, closures, notifications, waitlist, preferences |
| `00012` | Cron jobs (pg_cron + pg_net) |
| `00013` | RLS JWT helpers |
| `00014` | Room 30-minute slot support |
| `00015` | Space assets storage bucket |

### Useful database commands

```bash
cd packages/db

supabase start                      # Start local Supabase
supabase stop                       # Stop local Supabase
supabase db reset                   # Reset + replay all migrations + seed
supabase db diff --local            # Show diff between migrations and local DB
supabase db lint --linked           # Lint migrations against remote project
supabase db push                    # Push migrations to remote
supabase gen types typescript --local > types/database.ts  # Regenerate types
```

---

## Testing

### Unit Tests (Vitest)

Unit tests live alongside the code they test (e.g., `lib/color.test.ts`, `lib/booking/rules.test.ts`).

```bash
# Run all unit tests
turbo test

# Run in watch mode (from apps/web/)
cd apps/web
npm run test:watch

# Run a specific test file
cd apps/web
npx vitest run lib/color.test.ts
```

Configuration is in `apps/web/vitest.config.ts` with JSDOM environment and `@testing-library/jest-dom` matchers (set up in `vitest.setup.ts`).

### E2E Tests (Playwright)

E2E tests are in `apps/web/e2e/` and run against a local Supabase instance.

```bash
# Prerequisites: local Supabase must be running
cd packages/db
supabase start && supabase db reset
cd ../..

# Run E2E tests
turbo test:e2e

# Or directly from apps/web/
cd apps/web
npx playwright test

# Run with UI mode for debugging
npx playwright test --ui
```

The E2E setup (`e2e/global-setup.ts`) configures the test environment to point at the local Supabase instance. Only Chromium is used in CI.

### Test files

| File | Tests |
|------|-------|
| `lib/color.test.ts` | Color utility functions |
| `lib/utils.test.ts` | General utility functions |
| `lib/booking/format.test.ts` | Booking display formatting |
| `lib/booking/rules.test.ts` | Booking validation rules |
| `lib/products/visibility.test.ts` | Product visibility filtering |
| `lib/supabase/cookies.test.ts` | Cookie configuration logic |
| `e2e/smoke.spec.ts` | Basic smoke test |

---

## CI/CD Pipeline

The project uses three GitHub Actions workflows. Vercel handles application deployment separately via its native GitHub integration.

### CI (Pull Requests)

Triggered on every PR to `main` or `dev`. Runs the following jobs:

```mermaid
graph LR
    A[Lint] --> C[Build]
    B[Type-check] --> C
    A --> D[Test]
    B --> D
    A --> E[E2E]
    B --> E
    F[DB Lint] --> F
    G[Schema Drift] --> G
    H[Migration Dry Run] --> H
```

| Job | Purpose | Blocking? |
|-----|---------|-----------|
| Lint | ESLint across affected packages | Yes |
| Type-check | TypeScript compilation | Yes |
| Build | Production build | Yes |
| Test | Vitest unit tests | Yes |
| E2E | Playwright with local Supabase | Yes |
| DB Lint | Lint migrations against dev project | Yes |
| Schema Drift | Detect untracked schema changes | Warning only |
| Migration Dry Run | Replay all migrations from scratch | Yes |

CI uses Turborepo's `--filter` to only check packages affected by the PR.

### Deploy Dev

Triggered on push to `dev`:

1. **Push Migrations** -- Runs `supabase db push` against the dev Supabase project
2. **Generate Types** -- Regenerates `database.ts` from the dev schema and commits if changed

### Deploy Prod

Triggered on push to `main`:

1. **Preflight** -- Checks if new migrations exist (compares against prod)
2. **Migrate** -- Pushes migrations to prod (requires manual approval via GitHub `production` environment)
3. **Generate Types** -- Regenerates types from prod schema
4. **Smoke Test** -- Hits `GET /api/health` on production URL (retries 3 times)

The migration step includes a hard-fail schema drift check. If someone modified the production database directly, the deploy will fail until the drift is resolved.

### Required Secrets and Variables

See [`.github/CICD_SETUP.md`](/.github/CICD_SETUP.md) for the complete list of GitHub secrets, variables, environment configuration, and branch protection rules.

---

## Branch Strategy

```
main (production)
  ↑ PR with required approvals + CI checks
dev (integration)
  ↑ PR or direct push with CI checks
feat/*, fix/*, refactor/* (feature branches)
```

### Workflow

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev && git pull
   git checkout -b feat/my-feature
   ```

2. Develop and commit using conventional prefixes:
   ```
   feat:      New feature
   fix:       Bug fix
   refactor:  Code restructuring
   docs:      Documentation
   test:      Test additions/changes
   chore:     Build, CI, tooling
   db:        Database migrations
   ```

3. Push and open a PR to `dev`:
   ```bash
   git push -u origin feat/my-feature
   ```

4. CI runs automatically. After review and approval, merge to `dev`.

5. Merge triggers `deploy-dev` workflow (migrations + type generation). Vercel auto-deploys the preview.

6. When `dev` is stable, open a PR from `dev` to `main`.

7. After merge to `main`, `deploy-prod` runs. If migrations are detected, a reviewer must approve in the `production` GitHub environment before they are applied.

### Branch Protection

- **`main`**: Requires PR, 1 approval, passing CI checks (Lint, Type-check, Build, DB Lint, Migration Dry Run), linear history, no force pushes.
- **`dev`**: Requires passing CI checks, linear history, no force pushes. PR approval is optional (team preference).

---

## Local Development Tips

### Subdomain testing

Subdomains do not work on `localhost`. Two approaches:

1. **Query parameter** (simplest): Use `?space=slug` on any URL. The middleware falls back to this when it cannot resolve a subdomain.

2. **Local DNS**: Edit `/etc/hosts` to add entries like `127.0.0.1 demo.cowork.local` and set `NEXT_PUBLIC_PLATFORM_DOMAIN=cowork.local:3000`.

### Stripe testing locally

1. Install the Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. Use the webhook signing secret printed by the CLI as `STRIPE_CONNECT_WEBHOOK_SECRET` in `.env.local`.
4. Use Stripe test mode keys and test card numbers (`4242 4242 4242 4242`).

### Database debugging

- **Supabase Studio**: `http://127.0.0.1:54323` -- visual table editor, SQL runner
- **Direct psql**: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **View RLS policies**: Check the SQL Editor in Studio or query `pg_policies`
- **Reset everything**: `supabase db reset` replays all migrations and seed data

### Common issues

| Problem | Solution |
|---------|----------|
| `supabase start` fails | Make sure Docker is running |
| Types out of date | Run `supabase gen types typescript --local > types/database.ts` from `packages/db/` |
| RLS blocking queries | Check that JWT claims match the space you are querying. Verify via Supabase Studio > Authentication |
| Middleware redirect loop | Verify `NEXT_PUBLIC_PLATFORM_DOMAIN` matches the hostname you are accessing |
| Stripe webhooks not received | Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Space not resolving | Check the `spaces` table has `active = true` and the slug matches |
