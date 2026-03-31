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
- [ ] **H5** `apps/web/app/(app)/admin/members/actions.ts:303-320` — Bulk invite loop; OTP sends fail silently
- [x] **H6** `apps/web/app/(app)/admin/passes/actions.ts` — `auto_assign_desk` RPC error now checked and logged
- [x] **H7** `apps/web/lib/stripe/webhooks.ts` — `grant_credits` RPC now checks error, logs, and throws
- [x] **H8** `apps/web/lib/stripe/webhooks.ts` — `auto_assign_desk` RPC in pass checkout now checks error and logs
- [x] **H9** `apps/web/lib/nuki/sync.ts` — Initial `listAuths()` wrapped in try-catch with descriptive error
- [x] **H10** `apps/web/app/api/webhooks/stripe/route.ts` — `payment_events.upsert()` now checks error and logs

## MEDIUM — degraded debugging or UX

- [ ] **M1** `apps/web/app/(app)/admin/members/page.tsx:12-31` — `Promise.all()` without error handling
- [ ] **M2** `apps/web/app/(app)/store/page.tsx:18-35` — `Promise.all()` without error handling
- [ ] **M3** `apps/web/app/checkout/membership/page.tsx:34-64` — Plan + capacity queries no error handling
- [ ] **M4** `apps/web/app/checkout/confirmation/page.tsx:29-47` — Space/tenant lookups no error handling
- [ ] **M5** `apps/admin/app/(dashboard)/tenants/[id]/page.tsx:40-52` — Spaces query null, `.map()` crashes
- [ ] **M6** `apps/admin/app/(dashboard)/spaces/[id]/page.tsx:23-60` — Multiple queries without error handling
- [ ] **M7** `apps/web/app/(app)/admin/settings/page.tsx:49-54` — Tenant query no error handling
- [ ] **M8** `apps/web/app/(app)/admin/import/actions/import-members.ts:111-121` — Profile/space_users not error-checked in import loop
- [ ] **M9** `apps/web/app/(app)/plan/actions.ts:127` — Member update after Stripe checkout not checked
- [ ] **M10** `apps/web/app/(app)/store/actions.ts:382-405` — Stripe retrieve/update not in try-catch; member update not checked
- [ ] **M11** `apps/web/lib/nuki/client.ts:54-75` — `nukiFetch()` no network timeout handling
- [ ] **M12** `apps/web/lib/stripe/webhooks.ts:511-536` — Guest checkout user lookup uses `perPage: 1`
- [ ] **M13** `apps/web/app/checkout/_components/checkout-form.tsx:55` — `.json().catch(() => ({}))` hides parse errors
- [ ] **M14** `apps/web/app/(app)/profile/actions.ts:144` — Profile update not error-checked
- [ ] **M15** `apps/web/app/(app)/admin/settings/actions.ts:99-114` — Storage deletion fire-and-forget
