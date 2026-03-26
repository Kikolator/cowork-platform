# Code Review Fixes

Tracking document for issues found during code review of `dev` branch (2026-03-26).

## Critical

- [x] **#1 RLS JWT path bug on `space_access_config`**
  - Fix: `20260326081642_fix_access_config_rls_jwt_path.sql`

- [x] **#2 Members column escalation via `users_update_own`**
  - Fix: `20260326082946_restrict_member_self_update_columns.sql`

- [x] **#3 `nuki_api_token` exposed to members**
  - Fix: `20260326083158_restrict_access_config_member_view.sql` + updated `/access` page to use RPC

## High

- [x] **#4 Missing Zod validation on admin actions**
  - Fix: Added Zod schemas for email, UUID, and status in admin server actions

- [x] **#5 TOCTOU race in `removePlatformAdmin`**
  - Fix: `20260326090126_atomic_remove_platform_admin.sql` + updated server action to use RPC

- [x] **#6 `Math.random()` for door PINs**
  - Fix: Replaced with `crypto.randomInt()` in `apps/web/lib/nuki/pin.ts`

- [x] **#7 `updateFeatureFlag` accepts arbitrary key**
  - Fix: Added `ALLOWED_FEATURE_KEYS` allowlist in `apps/web/app/(app)/admin/settings/actions.ts`

- [x] **#8 Non-null assertion on `spaceId` in Stripe webhooks**
  - Fix: Added null guard with error logging in `apps/web/lib/stripe/webhooks.ts`

- [x] **#9 `fetchNukiSmartlocks` missing auth check**
  - Fix: Added `getSpaceId()` auth check in `apps/web/app/(app)/admin/settings/access-actions.ts`

## Medium

- [x] **#10 Stripe pagination capped at 100**
  - Fix: Used Stripe async iterator (for-await) in `apps/admin/lib/stripe/platform.ts`

- [x] **#11 Desk booking overlap checks non-atomic**
  - Fix: `20260326091259_add_booking_conflict_check_to_rpc.sql` — moved all conflict checks into the RPC

- [x] **#12 Admin middleware lacks platform admin check**
  - Fix: Documented the two-layer auth model (middleware=authn, layout=authz) in `apps/admin/middleware.ts`

- [x] **#13 Notification logging uses user client**
  - Fix: Switched to `createAdminClient()` in `apps/web/lib/email.ts`
