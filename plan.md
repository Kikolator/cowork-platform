# Door Access Codes & Nuki Integration — Implementation Plan

## Overview

Transform the simple per-member `access_code` text field into a full access code management system with:
1. Space-level general access codes per access tier (business_hours, extended, 24/7)
2. Individual member code overrides
3. Nuki smart lock integration for automatic keypad PIN management
4. Member-facing `/access` page

---

## Phase 1: Database Schema

### Migration: `space_access_config`

New table `space_access_config` (one row per space):
```sql
create table public.space_access_config (
  space_id       uuid primary key references public.spaces(id) on delete cascade,
  enabled        boolean not null default false,
  mode           text not null default 'manual'
                 check (mode in ('manual', 'nuki')),
  -- General codes: one per access tier
  code_business_hours    text,          -- shared code for business_hours members
  code_extended          text,          -- shared code for extended members
  code_twenty_four_seven text,          -- shared code for 24/7 members
  -- Nuki integration
  nuki_api_token         text,          -- encrypted Nuki API bearer token
  nuki_smartlock_id      text,          -- Nuki smartlock ID to manage
  nuki_last_sync_at      timestamptz,
  nuki_sync_error        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

- RLS: space admins/owners can read/write their own row.
- `mode = 'manual'`: admin sets general codes + optional per-member overrides.
- `mode = 'nuki'`: system creates individual Nuki keypad PINs per member based on their access tier.

### Migration: Add `nuki_auth_id` to `members`

```sql
alter table public.members
  add column nuki_auth_id bigint;  -- Nuki authorization ID for this member's keypad code
```

The existing `access_code` field on `members` already serves as the individual override. When `mode = 'manual'`, it overrides the general code. When `mode = 'nuki'`, it stores the Nuki-generated PIN for display.

### Rollback comments included in both migrations.

---

## Phase 2: Admin Settings — "Access" Tab

### Location: `apps/web/app/(app)/admin/settings/`

Add a new **"Access"** tab to the Space Settings page (alongside Branding, Operations, etc.):

**`access-form.tsx`** — Access settings form with two sections:

#### Section A: General Access Codes
- Toggle: Enable/disable access codes for this space
- Mode selector: "Manual" or "Nuki Smart Lock"
- When **Manual**:
  - 3 text inputs for general codes (business_hours, extended, 24/7)
  - Hint: "These codes are shared with all members at each access level"
- When **Nuki**:
  - API Token input (password field)
  - "Connect" button that fetches smartlocks from Nuki API
  - Smartlock selector dropdown (populated from `GET /smartlock`)
  - "Sync Now" button to trigger code generation for all members
  - Last sync status display

#### Section B: Info
- Explanation of how codes are resolved: individual override > Nuki-generated > general code
- Link to member management for individual overrides

**`access-actions.ts`** — Server actions:
- `updateAccessConfig()` — save settings
- `fetchNukiSmartlocks()` — call Nuki API to list available smartlocks
- `syncNukiCodes()` — generate/update keypad codes for all active members

---

## Phase 3: Nuki Integration Logic

### Location: `apps/web/lib/nuki/`

**`client.ts`** — Nuki API client wrapper:
```typescript
// Core API calls:
// GET  /smartlock                          — list smartlocks
// GET  /smartlock/{id}/auth                — list existing auths
// PUT  /smartlock/{id}/auth                — create keypad code (type 13)
// POST /smartlock/{id}/auth/{authId}       — update keypad code
// DELETE /smartlock/{id}/auth/{authId}     — delete keypad code
```

**`sync.ts`** — Sync logic:
- For each active member with a plan that has `access_type != 'none'`:
  - Generate a unique 6-digit PIN (digits 1-9, no 0, not starting with "12")
  - Determine time restrictions from their plan's `access_type` + space's `business_hours`
  - Create/update Nuki keypad authorization (type 13) with:
    - `name`: member's display name
    - `code`: generated PIN
    - `allowedWeekDays`: bitmask based on space business hours config
    - `allowedFromTime` / `allowedUntilTime`: based on access tier
  - Store `nuki_auth_id` and `access_code` (the generated PIN) on the member row

**PIN generation rules** (Nuki constraints):
- 6 digits, only 1-9 (no zeros)
- Cannot start with "12"
- Must be unique across the smartlock

**Time mapping from access_type:**
- `business_hours` → space's configured open/close hours, only on open days
- `extended` → 07:00-22:00 (or space-configurable), all weekdays
- `twenty_four_seven` → no time restrictions (allowedWeekDays: 127, no time limits)

---

## Phase 4: Member Form Update

### Location: `apps/web/app/(app)/admin/members/`

Update `member-form.tsx`:
- Keep the existing `access_code` text input but relabel as "Access Code Override"
- Add hint: "Leave empty to use the general code (or Nuki-generated code)"
- When Nuki mode is active, show the Nuki-generated code as read-only info
- Show a "Regenerate Nuki Code" button per member (if Nuki mode)

Update `member-detail.tsx`:
- Show effective code (override > nuki > general) with indicator of source
- Show Nuki sync status if applicable

---

## Phase 5: Member-Facing `/access` Page

### Location: `apps/web/app/(app)/access/`

**`page.tsx`** — Server component:
- Fetch current member's data (plan, access_code, access_type)
- Fetch space_access_config (is access enabled?)
- Resolve effective code: member override > nuki-generated > general tier code
- If access codes not enabled by tenant → show "Access codes are not configured for this space"

**UI:**
- Card: "Your Door Code"
  - Large, prominent display of the access code
  - Label showing access tier: "Business Hours Access" / "Extended Access" / "24/7 Access"
  - If no code available: "No access code assigned. Contact your space administrator."
- Future placeholder section (commented/noted for later):
  - Alarm information
  - Last-to-leave rules
  - Emergency contacts

### Navigation:
Add to `nav-items.ts`:
```typescript
{ label: "Access", href: "/access", icon: KeyRound }
```
Position: after "Profile" in the member nav section. Only show if space has access codes enabled (we can handle this with a feature flag or always show and handle the empty state).

---

## Phase 6: Update Schema Spec

Update `packages/db/docs/MT-SCHEMA-SPEC.md` to document the new `space_access_config` table and the `nuki_auth_id` column on members.

---

## File Changes Summary

### New files:
1. `packages/db/supabase/migrations/<timestamp>_space_access_config.sql`
2. `apps/web/app/(app)/admin/settings/access-form.tsx`
3. `apps/web/app/(app)/admin/settings/access-actions.ts`
4. `apps/web/app/(app)/admin/settings/access-schemas.ts`
5. `apps/web/lib/nuki/client.ts`
6. `apps/web/lib/nuki/sync.ts`
7. `apps/web/lib/nuki/pin.ts` (PIN generation utility)
8. `apps/web/app/(app)/access/page.tsx`

### Modified files:
1. `apps/web/app/(app)/admin/settings/page.tsx` — add Access tab
2. `apps/web/app/(app)/admin/members/member-form.tsx` — relabel access code field
3. `apps/web/app/(app)/admin/members/member-detail.tsx` — show effective code
4. `apps/web/components/layout/nav-items.ts` — add Access nav item
5. `packages/db/docs/MT-SCHEMA-SPEC.md` — document new schema
6. `packages/db/types/database.ts` — regenerated (not hand-edited)

---

## Nuki API Reference

- Base URL: `https://api.nuki.io`
- Auth: Bearer token in `Authorization` header
- Key endpoints:
  - `GET /smartlock` — list smartlocks
  - `GET /smartlock/{id}/auth` — list authorizations
  - `PUT /smartlock/{id}/auth` — create authorization (type 13 = keypad code)
  - `POST /smartlock/{id}/auth/{authId}` — update authorization
  - `DELETE /smartlock/{id}/auth/{authId}` — delete authorization
- PIN constraints: 6 digits, 1-9 only, no leading "12", unique per smartlock
- Max codes: 100 (Keypad v1) / 200 (Keypad v2)
- `allowedWeekDays`: bitmask (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64; 127=all)

Sources:
- [Nuki PIN Code Management Example](https://developer.nuki.io/t/web-api-example-manage-pin-codes-for-your-nuki-keypad/54)
- [Nuki Swagger UI](https://api.nuki.io/)
- [Nuki Developer Portal](https://developer.nuki.io/c/apis/15)
