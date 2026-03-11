# CI/CD Setup Guide

Complete setup instructions for the GitHub Actions CI/CD pipeline.

## Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | PR to `main` or `dev` | Lint, type-check, build, test, DB validation |
| **Deploy Dev** | Push to `dev` | Push migrations + regenerate types for dev Supabase |
| **Deploy Prod** | Push to `main` | Migration preflight, manual approval gate, push, smoke test |

> **Vercel** handles all application deploys via its native GitHub integration — the workflows above only manage Supabase migrations and code quality.

---

## 1. Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Description | Where to find |
|--------|-------------|---------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token for Supabase CLI | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DEV_PROJECT_REF` | Dev project reference ID (e.g. `abcdefghijklmnop`) | Supabase dashboard → Project Settings → General |
| `SUPABASE_DEV_DB_PASSWORD` | Dev project database password | Supabase dashboard → Project Settings → Database |
| `SUPABASE_PROD_PROJECT_REF` | Prod project reference ID | Same as above, for prod project |
| `SUPABASE_PROD_DB_PASSWORD` | Prod project database password | Same as above, for prod project |

### Optional secrets

| Secret | Description |
|--------|-------------|
| `TURBO_TOKEN` | Turborepo remote cache token (speeds up CI) — get from [vercel.com](https://vercel.com/account/tokens) |

---

## 2. Required GitHub Variables

Go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Description | Example |
|----------|-------------|---------|
| `TURBO_TEAM` | Turborepo team slug (for remote cache) | `my-team` |
| `PRODUCTION_URL` | Production app URL (for smoke test) | `https://app.cowork.example.com` |

> The smoke test skips gracefully if `PRODUCTION_URL` is not set.

---

## 3. Create the `production` Environment

This is required for the manual approval gate on production migrations.

1. Go to **Settings → Environments → New environment**
2. Name it exactly: `production`
3. Under **Environment protection rules**:
   - Enable **Required reviewers**
   - Add one or more team members who must approve production migrations
4. Optionally add a **Wait timer** (e.g., 5 minutes) for extra safety
5. Add the prod secrets (`SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`) as environment-level secrets if you want stricter access control

---

## 4. Branch Protection Rules

### `main` (production)

Go to **Settings → Branches → Add rule** for `main`:

- [x] **Require a pull request before merging**
  - [x] Require at least 1 approval
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] **Require status checks to pass before merging**
  - Add these required checks: `Lint`, `Type-check`, `Build`, `DB Lint`, `Migration Dry Run`
- [x] **Require linear history** (enforces squash/rebase merges)
- [x] **Do not allow force pushes**
- [x] **Do not allow deletions**

### `dev` (integration)

Add a lighter rule for `dev`:

- [ ] Require a pull request before merging *(optional — team preference)*
- [x] **Require status checks to pass before merging**
  - Add these required checks: `Lint`, `Type-check`, `Build`
- [x] **Require linear history**
- [x] **Do not allow force pushes**

---

## 5. Vercel Integration

Vercel handles deploys automatically via its GitHub integration:

1. Connect your repo in the [Vercel dashboard](https://vercel.com)
2. Set the **Root Directory** to `apps/web`
3. Configure environment variables in Vercel for each environment (Preview, Production)
4. Map branches:
   - `main` → Production deployment
   - `dev` → Preview deployment
5. Vercel will auto-deploy on every push — no GitHub Actions step needed

---

## 6. Local Development Workflow

```bash
# Clone and install
git clone <repo-url> && cd cowork-platform
npm install

# Start local Supabase (requires Docker)
cd packages/db
supabase start
supabase db reset        # Apply all migrations + seed
cd ../..

# Start dev server
npx turbo dev            # Runs Next.js on http://localhost:3000

# Before pushing
npx turbo lint           # Lint all packages
npx turbo check-types    # Type-check all packages
npx turbo build          # Build all packages

# Database workflow
cd packages/db
supabase migration new my_change        # Create new migration
# Edit the migration file in supabase/migrations/
supabase db reset                       # Test locally
supabase gen types typescript --local > types/database.ts  # Regen types
cd ../..

# Feature branch workflow
git checkout dev
git pull origin dev
git checkout -b feat/my-feature
# ... make changes ...
git push -u origin feat/my-feature
# Open PR to dev → CI runs automatically
# After merge to dev → deploy-dev runs automatically
# After merge dev→main → deploy-prod runs automatically
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CI fails on "turbo filter" | Ensure PR base branch is fetched (`fetch-depth: 0`) |
| `supabase db push` fails | Check DB password secret, ensure project ref is correct |
| Schema drift detected | Someone changed the remote DB directly — create a migration to match |
| Smoke test skipped | Set the `PRODUCTION_URL` variable in GitHub |
| Type generation fails | Verify `SUPABASE_ACCESS_TOKEN` has access to the project |
| Migration dry run fails | Check Docker is available on the runner (ubuntu-latest includes it) |
