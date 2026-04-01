# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Hybrid billing mode: admin can choose Stripe or manual billing per member (#141)
- Custom per-member pricing overrides plan price (#141)
- Daily cron job for manual-billing credit renewal (#141)
- Per-resource-type product visibility filtering (#140)
- README updated for public repo, AGPL-3.0 license, new features (#144)
- Version tracking and changelog (#143)

### Fixed
- Product visibility `exclude_unlimited` now checks per resource type instead of blanket boolean (#140)
- Comma-operator bug in Stripe product ID resolution (#142)
- Credit validity uses next anniversary date instead of fixed 30 days (#142)
- Hardcoded EUR currency in member detail view (#142)
- Swallowed warnings in add/edit member forms (#142)

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
