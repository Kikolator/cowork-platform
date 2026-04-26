# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.2] - 2026-04-26

### Fixed
- CI: prod deploy back-merge to `dev` now uses `git merge --ff-only main` instead of creating a merge commit, satisfying dev's `required_linear_history` rule. Switches the checkout token from the default `GITHUB_TOKEN` (which acts as the GitHub Actions integration and cannot bypass a personal repo's ruleset) to a Repository Admin PAT (`GH_BACKMERGE_TOKEN`), which IS in the bypass list. (#229)

## [0.12.1] - 2026-04-26

### Fixed
- CI: schema-drift detection in `deploy-prod` (preflight + post-push verify) and `deploy-dev` no longer false-positives on stderr noise (NOTICE messages, connection strings) from the Supabase CLI. Captures stdout only and checks for real DDL after stripping comments/blanks. Caused the v0.12.0 prod deploy to fail despite the migration applying cleanly. (#226)

## [0.12.0] - 2026-04-26

### Added
- Self-service custom domain management — admin UI to connect, verify, and remove custom domains with automated DNS verification and SSL provisioning via the Vercel Domains API; tracks `domain_status` (pending/active/error) on `spaces` (#223)
- Diagnostic logging in custom-domain resolution (`apps/web/lib/space/resolve.ts`) — logs hostname, Supabase host, and lookup result for debugging space resolution issues (#224)

### Fixed
- Custom-domain query now uses port-stripped hostname (`hostnameBase` instead of raw `hostname`) — no behavior change in production, unblocks local custom-domain testing (#224)
- Move pass constraint after backfill to prevent prod deploy failure (2bee056)

### Changed
- CI auto-back-merges `main` to `dev` after every prod deploy to keep version and changelog in sync (9acf67a)

## [0.11.0] - 2026-04-25

### Added
- Complete pass checkout system with lifecycle, refunds, and admin tools (#192)
- Platform events infrastructure and activity feeds — admin activity log with filters, member activity page (#210)
- Admin closures UI and calendar date picker for member store pass purchases (#208)
- VAT/IVA tax rates on invoices — space-level tax config, Stripe TaxRate integration, invoice tax breakdown (#214)
- Revenue summary cards (Total Revenue / Tax Collected / Net Revenue) on admin invoices page (#214)
- Edge function CI/CD deployment in deploy-dev and deploy-prod workflows (#202)
- Unit tests for pass system — closures, schemas, refunds (61 tests) (#194)

### Fixed
- Credits now granted immediately on subscription creation instead of waiting for invoice.paid (#218, closes #217)
- Race condition: invoice.paid arriving before checkout.session.completed no longer causes permanent credit loss (#218)
- Admin-provisioned members (send_invoice) now receive credits immediately instead of waiting for manual payment (#218)
- Nav items for disabled features (passes, referrals) now hidden from member sidebar (#220, closes #215)
- Fiscal ID form now includes "Full name" field for individual entity type (#220, closes #216)
- Checkout confirmation emails now reliably sent — awaited in webhook handler (#205)
- Magic link in pass confirmation email uses token_hash URL instead of Supabase action_link (#206)
- Product-type pass purchases now send confirmation email (#204)
- Consolidated pass confirmation email with embedded magic link (#203)
- Pass checkout queries include pass_type and duration_days columns (#198, #199)
- Invoice generation enabled for all one-off purchases (#209)
- Edge function `send-auth-email` uses `npm:` specifier instead of `esm.sh` CDN to prevent cold-start failures (#214)

### Changed
- Supabase types generation moved to local developer workflow — CI verifies types are up-to-date instead of auto-generating (#211)
- Deploy workflows no longer auto-commit types back to branches (#211)
## [0.10.1] - 2026-04-22

### Fixed
- Add missing migration `20260421195719` (nullable_member_plan_id) that was applied to prod but not committed, causing Deploy Prod to fail (#190)

## [0.10.0] - 2026-04-22

### Added
- Email design system with tenant branding and Supabase `send_email` hook (#180)
- RogueOps landing page (#181)
- Switch-to-Stripe billing action: admin can provision Stripe subscription for manual-billed members (#183)
- Extracted `provisionSubscription()` into shared `lib/stripe/subscriptions.ts` (#183)

### Fixed
- Member import now preserves existing `space_users` role instead of overwriting admin/owner to member (#179)
- `members.plan_id` is now nullable: unmatched imports get `plan_id = null` and `status = churned` instead of wrong default plan (#179)
- Imported members default to `billing_mode = manual` to prevent silent billing gap (#183)
- Capacity RPCs (`get_space_capacity`, `check_space_capacity`) exclude null plan_id members (#179)
- Credits cron and Stripe webhook guard against null plan_id (#179)

## [0.9.0] - 2026-04-21

### Added
- Favicon + header display mode: per-tenant favicon rendering and `header_logo_mode` setting to choose between logo or icon+name in header (#169, closes #153)
- Plan sort order exposed in admin form so tenants can reorder subscriptions just like products (#168, closes #152)
- SSR email templates with space-direct redirects for invites and auth flows (#173)
- Release workflow docs, Git Strategy, PR Test Plans, and Release Process sections in CLAUDE.md (#162, #163)
- README env var documentation and Stripe setup guide (#164)

### Fixed
- Favicon override and `last_login_at` not updating after invite accept (#176, closes #174, #175)
- Invite auth callback flow and Stripe price invalidation on plan/product price change (#167, closes #165, #166)
- Stripe price invalidation when plan or product price changes (#160)
- Invite email link no longer invalid (#158, closes #154)
- Walk-in booking RLS policy violation (#158, closes #155)
- Setup checklist correctly reflects connected Stripe status (#158, closes #156)
- OfficeRnd CSV member import no longer skips valid rows (#158, closes #157)

### Changed
- CI: removed deploy-dev workflow and fixed CI issues (#150)
- Cleaned up `.env.example`: added missing `CRON_SECRET`, removed unused `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (#163)

## [0.8.1] - 2026-04-15

### Added
- Hybrid billing mode: admin can choose Stripe or manual billing per member (#141)
- Custom per-member pricing overrides plan price (#141)
- Daily cron job for manual-billing credit renewal (#141)
- Per-resource-type product visibility filtering (#140)
- README updated for public repo, AGPL-3.0 license, new features (#144)
- Version tracking and changelog (#145)

### Fixed
- Product visibility `exclude_unlimited` now checks per resource type instead of blanket boolean (#140)
- Comma-operator bug in Stripe product ID resolution (#142)
- Credit validity uses next anniversary date instead of fixed 30 days (#142)
- Hardcoded EUR currency in member detail view (#142)
- Swallowed warnings in add/edit member forms (#142)
- Storage bucket migrations now idempotent — fixes `supabase db reset --linked` failures (#147)

## [0.7.0] - 2026-03-31

### Added
- Vercel Analytics integration
- Structured logger (`@cowork/shared` createLogger)
- React error boundaries (global + per-route)
- Error handling across critical code paths

### Fixed
- Missing profile handling to prevent crashes
- Admin role downgrade vulnerability
- Feature flag switches default to off when not explicitly set

## [0.6.0] - 2026-03-28

### Added
- Member referral system with configurable rewards (credits or subscription discounts)
- Referral codes, tracking, and atomic completion
- Admin referral program configuration

### Fixed
- Booking page date selection issues

## [0.5.0] - 2026-03-24

### Added
- Guest checkout flow (day pass + membership from landing page)
- Space capacity limits and desk availability checks
- Admin dashboard improvements (bookings daily view, walk-in dialog)
- Platform fee tiers (5%/3%/1% based on plan)

## [0.4.0] - 2026-03-17

### Added
- Profile self-service (avatar upload, personal info, billing details)
- Admin settings (branding, operations, fiscal config, feature flags)
- Platform fee configuration per tenant

## [0.3.0] - 2026-03-10

### Added
- Member creation and invite sending from admin
- Admin leads management page
- OfficeRnd CSV data import wizard
- Login tracking via shared profiles

## [0.2.0] - 2026-03-03

### Added
- Multi-tenant architecture with RLS isolation
- Desk and room booking with credit deduction
- Membership plans with Stripe Connect subscriptions
- Day/week passes with auto-assigned desks
- Admin resource management (desks, rooms, pricing)
- Nuki smart lock integration
- Branded transactional emails via Resend
- Mobile app foundation (Expo + Expo Router)

## [0.1.0] - 2026-02-24

### Added
- Initial project setup
- Next.js 16 App Router with Turborepo monorepo
- Supabase backend with magic link auth
- Space resolution from subdomain/custom domain
- Basic admin and member layouts
