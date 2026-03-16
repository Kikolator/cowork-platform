# RLS Test Report

**Date:** 2026-03-16
**Total Tests:** 395
**Passed:** 395
**Failed:** 0
**Tables Covered:** 26/26

## Summary

All 26 tables with Row Level Security enabled have been tested across 4 role types (anon, member, space admin, platform admin) and 2 spaces/tenants for cross-tenant isolation. Every policy pattern is verified.

---

## Foundation Tables

### Table: tenants
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read tenants | anon | SELECT | 0 rows | 0 rows | PASS |
| Can read all tenants | platform_admin | SELECT | >= 2 | >= 2 | PASS |
| Can update any tenant | platform_admin | UPDATE | success | success | PASS |
| Can insert a tenant | platform_admin | INSERT | success | success | PASS |
| Can delete a tenant | platform_admin | DELETE | success | success | PASS |
| Can read own tenant | space_admin (A) | SELECT | 1 row | 1 row | PASS |
| Cannot read other tenants | space_admin (A) | SELECT | 0 rows | 0 rows | PASS |
| Cannot insert tenants | space_admin | INSERT | error | error | PASS |
| Cannot delete tenants | space_admin | DELETE | 0 rows | 0 rows | PASS |
| Can update own tenant | space_owner | UPDATE | success | success | PASS |
| Cannot read any tenants | member | SELECT | 0 rows | 0 rows | PASS |

### Table: spaces
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Can read active spaces | anon | SELECT | >= 2 | >= 2 | PASS |
| Cannot read inactive spaces | anon | SELECT | 0 rows | 0 rows | PASS |
| Cannot insert spaces | anon | INSERT | error | error | PASS |
| Can read all spaces (incl. inactive) | platform_admin | SELECT | >= 1 | >= 1 | PASS |
| Can create and delete spaces | platform_admin | INSERT/DELETE | success | success | PASS |
| Can manage own space (matching JWT) | space_admin | UPDATE | success | success | PASS |
| Cannot manage another space | space_admin | UPDATE | 0 rows | 0 rows | PASS |
| Cannot manage own space with wrong JWT | space_admin | UPDATE | 0 rows | 0 rows | PASS |
| Can read active spaces | member | SELECT | >= 1 | >= 1 | PASS |
| Cannot update spaces | member | UPDATE | 0 rows | 0 rows | PASS |

### Table: shared_profiles
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read any profiles | anon | SELECT | 0 rows | 0 rows | PASS |
| Can read own profile | authenticated | SELECT | 1 row | 1 row | PASS |
| Cannot read another user profile | authenticated | SELECT | 0 rows | 0 rows | PASS |
| Can update own profile | authenticated | UPDATE | success | success | PASS |
| Cannot update another user profile | authenticated | UPDATE | 0 rows | 0 rows | PASS |
| Can read profiles in own space | space_admin | SELECT | >= 1 | >= 1 | PASS |
| Cannot read profiles in other space | space_admin | SELECT | 0 rows | 0 rows | PASS |
| Can read all profiles | platform_admin | SELECT | >= 6 | >= 6 | PASS |

### Table: space_users
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read space_users | anon | SELECT | 0 rows | 0 rows | PASS |
| Can read own entry | member | SELECT | 1 row | 1 row | PASS |
| Cannot read others entries | member | SELECT | 0 rows | 0 rows | PASS |
| Cannot insert | member | INSERT | error | error | PASS |
| Cannot update | member | UPDATE | 0 rows | 0 rows | PASS |
| Cannot delete | member | DELETE | 0 rows | 0 rows | PASS |
| Can manage own space users | space_admin | SELECT | >= 2 | >= 2 | PASS |
| Cannot manage other space users | space_admin | SELECT | 0 rows | 0 rows | PASS |
| Can read all | platform_admin | SELECT | >= 4 | >= 4 | PASS |

### Table: platform_admins
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read | anon | SELECT | 0 rows | 0 rows | PASS |
| Cannot read | member | SELECT | 0 rows | 0 rows | PASS |
| Cannot read | space_admin | SELECT | 0 rows | 0 rows | PASS |
| Can read | platform_admin | SELECT | >= 1 | >= 1 | PASS |
| Can insert | platform_admin | INSERT | success | success | PASS |

---

## Public-Read Tables (7 tables, same pattern)

Tables: `resource_types`, `rate_config`, `plans`, `plan_credit_config`, `resources`, `products`, `space_closures`

| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read (no space_id JWT) | anon | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Can read own space rows | authenticated (correct JWT) | SELECT | >= 1 | >= 1 | PASS (all 7) |
| Cannot read other space rows | authenticated (correct JWT) | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Sees nothing with mismatched JWT | authenticated (wrong JWT) | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cannot insert | member | INSERT | error | error | PASS (all 7) |
| Can read own space data | space_admin | SELECT | >= 1 | >= 1 | PASS (all 7) |
| Cannot read other space data | space_admin | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cross-space admin blocked | space_admin (B) | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Can read all data | platform_admin | SELECT | >= 2 | >= 2 | PASS (all 7) |
| Can insert in own space | space_admin | INSERT | success | success | PASS |
| Cannot insert in other space | space_admin | INSERT | error | error | PASS |
| Can update in own space | space_admin | UPDATE | success | success | PASS |
| Can delete in own space | space_admin | DELETE | success | success | PASS |
| Unrelated user can read (public) | no membership | SELECT | defined | defined | PASS (all 7) |

---

## User-Owned Tables (7 tables + booking_credit_deductions)

Tables: `bookings`, `members`, `passes`, `credit_grants`, `recurring_rules`, `waitlist`, `notification_preferences`

| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read | anon | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cannot insert | anon | INSERT | error | error | PASS (all 7) |
| Can read own rows (correct JWT) | member | SELECT | >= 1 | >= 1 | PASS (all 7) |
| Cannot read own rows (wrong JWT) | member | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cannot read other user data | member (A) | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cannot read other space data | member (B) | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Cannot insert | member | INSERT | error | error | PASS (all 7) |
| Cannot delete | member | DELETE | 0 rows | 0 rows | PASS (all 7) |
| Can read all in own space | space_admin | SELECT | >= 1 | >= 1 | PASS (all 7) |
| Cannot access other space | space_admin | SELECT | 0 rows | 0 rows | PASS (all 7) |
| Can read all across spaces | platform_admin | SELECT | >= 2 | >= 2 | PASS (all 7) |
| Unrelated user sees nothing | no membership | SELECT | 0 rows | 0 rows | PASS (all 7) |

### notification_preferences (extra users_update_own policy)
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Can update own prefs | member | UPDATE | success | success | PASS |
| Cannot update other prefs | member | UPDATE | 0 rows | 0 rows | PASS |
| Cannot update with wrong JWT | member | UPDATE | 0 rows | 0 rows | PASS |

### booking_credit_deductions (join-based policy via bookings)
| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read | anon | SELECT | 0 rows | 0 rows | PASS |
| Can read own deductions | member (owner of booking) | SELECT | >= 1 | >= 1 | PASS |
| Cannot read other deductions | member (non-owner) | SELECT | 0 rows | 0 rows | PASS |
| Cross-user blocked | member (A) | SELECT | 0 rows | 0 rows | PASS |
| Can read space deductions | space_admin | SELECT | >= 1 | >= 1 | PASS |
| Cannot read other space | space_admin | SELECT | 0 rows | 0 rows | PASS |
| Can read all | platform_admin | SELECT | >= 1 | >= 1 | PASS |

---

## Admin-Only Tables (6 tables)

Tables: `leads`, `member_notes`, `monthly_stats`, `daily_stats`, `payment_events`, `notifications_log`

| Test Case | Role | Operation | Expected | Actual | Status |
|-----------|------|-----------|----------|--------|--------|
| Cannot read | anon | SELECT | 0 rows | 0 rows | PASS (all 6) |
| Cannot insert | anon | INSERT | error | error | PASS (all 6) |
| Cannot read | member | SELECT | 0 rows | 0 rows | PASS (all 6) |
| Cannot insert | member | INSERT | error | error | PASS (all 6) |
| Cannot update | member | UPDATE | 0 rows | 0 rows | PASS (all 6) |
| Cannot delete | member | DELETE | 0 rows | 0 rows | PASS (all 6) |
| Can read own space | space_admin | SELECT | >= 1 | >= 1 | PASS (all 6) |
| Cannot read other space | space_admin | SELECT | 0 rows | 0 rows | PASS (all 6) |
| Cross-space blocked | space_admin (B) | SELECT | 0 rows | 0 rows | PASS (all 6) |
| Can read all | platform_admin | SELECT | >= 2 | >= 2 | PASS (all 6) |
| Can insert in own space | space_admin | INSERT | success | success | PASS (leads, member_notes, stats, payment_events) |
| Cannot insert in other space | space_admin | INSERT | error | error | PASS (leads, member_notes) |
| Can update in own space | space_admin | UPDATE | success | success | PASS |
| Can delete in own space | space_admin | DELETE | success | success | PASS |
| Unrelated user sees nothing | no membership | SELECT | 0 rows | 0 rows | PASS (all 6) |

---

## Cross-Tenant Isolation (all 20 space-scoped tables + tenants + space_users + shared_profiles)

| Test Case | Tables | Status |
|-----------|--------|--------|
| Space A admin cannot read Space B data | 20 tables | PASS (all 20) |
| Space B admin cannot read Space A data | 20 tables | PASS (all 20) |
| Space A member cannot read Space B data | 20 tables | PASS (all 20) |
| JWT space_id mismatch blocks access | 20 tables | PASS (all 20) |
| Cross-space write blocked (insert) | resources, bookings | PASS |
| Cross-space write blocked (update) | leads | PASS |
| Cross-space write blocked (delete) | members | PASS |
| Space A admin cannot read Tenant B | tenants | PASS |
| Space B admin cannot read Tenant A | tenants | PASS |
| Platform admin reads all spaces | 20 tables | PASS (all 20) |
| Space A admin sees only Space A users | space_users | PASS |
| Space A admin sees only Space A profiles | shared_profiles | PASS |

---

## Service Role Bypass

| Test Case | Status |
|-----------|--------|
| service_role can read tenants, spaces, shared_profiles, space_users, platform_admins (all data) | PASS |

---

## Security Gaps Found

**None.** All 26 tables have RLS enabled with appropriate policies:

1. Every table has `platform_admins_full` for superadmin access.
2. Space-scoped tables enforce `space_id = current_space_id()` in the JWT.
3. User-owned data requires `user_id = auth.uid()`.
4. Admin-only tables (leads, member_notes, stats, etc.) correctly block member access.
5. Cross-tenant isolation is enforced at every level.
6. The `booking_credit_deductions` table correctly uses a join-based policy through the `bookings` table.
7. Special tables (`tenants`, `spaces`, `shared_profiles`, `platform_admins`) have correctly tailored policies.

## Policy Coverage Matrix

| Table | RLS | platform_admins_full | space_admins_manage | users_read_own | public_read | Special |
|-------|-----|---------------------|--------------------:|:--------------:|:-----------:|---------|
| tenants | Yes | Yes | - | - | - | space_admins_read_own_tenant, space_owners_update_own_tenant |
| spaces | Yes | Yes | Yes (id=current_space_id) | - | active=true | - |
| shared_profiles | Yes | Yes | - | id=auth.uid() | - | space_admins_read_space_profiles, users_update_own |
| space_users | Yes | Yes | Yes | user_id=auth.uid() | - | - |
| platform_admins | Yes | - | - | - | - | platform_admins_only |
| resource_types | Yes | Yes | Yes | - | Yes | - |
| rate_config | Yes | Yes | Yes | - | Yes | - |
| plans | Yes | Yes | Yes | - | Yes | - |
| plan_credit_config | Yes | Yes | Yes | - | Yes | - |
| resources | Yes | Yes | Yes | - | Yes | - |
| products | Yes | Yes | Yes | - | Yes | - |
| members | Yes | Yes | Yes | Yes | - | - |
| member_notes | Yes | Yes | Yes | - | - | - |
| bookings | Yes | Yes | Yes | Yes | - | - |
| recurring_rules | Yes | Yes | Yes | Yes | - | - |
| passes | Yes | Yes | Yes | Yes | - | - |
| credit_grants | Yes | Yes | Yes | Yes | - | - |
| booking_credit_deductions | Yes | Yes | Yes (via bookings join) | Yes (via bookings join) | - | - |
| leads | Yes | Yes | Yes | - | - | - |
| monthly_stats | Yes | Yes | Yes | - | - | - |
| daily_stats | Yes | Yes | Yes | - | - | - |
| payment_events | Yes | Yes | Yes | - | - | - |
| space_closures | Yes | Yes | Yes | - | Yes | - |
| notifications_log | Yes | Yes | Yes | - | - | - |
| waitlist | Yes | Yes | Yes | Yes | - | - |
| notification_preferences | Yes | Yes | Yes | Yes | - | users_update_own |
