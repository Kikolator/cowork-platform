# Error Handling TODO

Systematic audit of missing error handling across the codebase.
Items checked off as they are fixed.

---

## CRITICAL — data loss or broken payment flows

- [x] **C1** `apps/web/proxy.ts` — `updateSession()` wrapped in try-catch; treats failure as unauthenticated
- [x] **C2** `apps/admin/proxy.ts` — Same fix applied to admin proxy
- [x] **C3** `apps/web/app/api/checkout/session/route.ts` — Stripe product/price/session creation wrapped in try-catch with logging
- [x] **C4** `apps/web/app/(platform)/onboard/actions.ts` — Rollback cleanup wrapped in nested try-catch with logging
- [x] **C5** `apps/web/app/(app)/store/actions.ts` — `passes.update({ stripe_session_id })` now checks error and returns failure
- [x] **C6** `apps/web/lib/stripe/webhooks.ts` — Member `.insert()`/`.update()` now check error and throw

## HIGH — silent failures in important flows

- [x] **H1** `apps/web/app/(app)/dashboard/page.tsx` — All 3 `Promise.all()` blocks wrapped in try-catch with fallback data
- [x] **H2** `apps/web/app/(app)/book/desk/page.tsx` — `Promise.all()` wrapped in try-catch with fallback data
- [x] **H3** `apps/web/app/(app)/book/room/[resourceId]/page.tsx` — Both `Promise.all()` blocks wrapped in try-catch
- [x] **H4** `apps/admin/app/(dashboard)/page.tsx` — `getPlatformStats()` wrapped in try-catch with zero fallback
- [x] **H5** `apps/web/app/(app)/admin/members/actions.ts` — Bulk invite now logs OTP failures and checks invited_at update
- [x] **H6** `apps/web/app/(app)/admin/passes/actions.ts` — `auto_assign_desk` RPC error now checked and logged
- [x] **H7** `apps/web/lib/stripe/webhooks.ts` — `grant_credits` RPC now checks error, logs, and throws
- [x] **H8** `apps/web/lib/stripe/webhooks.ts` — `auto_assign_desk` RPC in pass checkout now checks error and logs
- [x] **H9** `apps/web/lib/nuki/sync.ts` — Initial `listAuths()` wrapped in try-catch with descriptive error
- [x] **H10** `apps/web/app/api/webhooks/stripe/route.ts` — `payment_events.upsert()` now checks error and logs

## MEDIUM — degraded debugging or UX

- [x] **M1** `apps/web/app/(app)/admin/members/page.tsx` — `Promise.all()` wrapped in try-catch
- [x] **M2** `apps/web/app/(app)/store/page.tsx` — `Promise.all()` wrapped in try-catch
- [x] **M3** `apps/web/app/checkout/membership/page.tsx` — Acceptable: queries use `.single()` with null checks, error boundary catches thrown errors
- [x] **M4** `apps/web/app/checkout/confirmation/page.tsx` — Acceptable: sequential queries with null guards and existing try-catch on Stripe call
- [x] **M5** `apps/admin/app/(dashboard)/tenants/[id]/page.tsx` — Guard empty spaceIds before `.in()` query
- [x] **M6** `apps/admin/app/(dashboard)/spaces/[id]/page.tsx` — Acceptable: queries use `?? []` fallback, error boundary catches thrown errors
- [x] **M7** `apps/web/app/(app)/admin/settings/page.tsx` — Acceptable: tenant query uses `?.` access, renders safely with null
- [x] **M8** `apps/web/app/(app)/admin/import/actions/import-members.ts` — Profile update and space_users upsert now error-checked with row-level error reporting
- [x] **M9** `apps/web/app/(app)/plan/actions.ts` — Member fiscal update now checks error
- [x] **M10** `apps/web/app/(app)/store/actions.ts` — Stripe retrieve/update wrapped in try-catch; member update checked
- [x] **M11** `apps/web/lib/nuki/client.ts` — 15s timeout added via `AbortSignal.timeout()`
- [x] **M12** `apps/web/lib/stripe/webhooks.ts` — Guest checkout user lookup now queries shared_profiles by email instead of paginated listUsers
- [x] **M13** `apps/web/app/checkout/_components/checkout-form.tsx` — Error parsing now handles non-JSON responses explicitly
- [x] **M14** `apps/web/app/(app)/profile/actions.ts` — Already handles errors correctly (false positive in audit)
- [x] **M15** `apps/web/app/(app)/admin/settings/actions.ts` — Storage cleanup batched into single call with error logging
