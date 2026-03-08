# TASK: Admin CRUD Pages — Plans, Resources, Settings

## Context

A space owner completes onboarding and lands on a dashboard with a setup checklist. These three admin pages are what they click into next. Without them the space is unconfigurable.

All three pages are admin-only (protected by the existing `(app)/admin/layout.tsx` guard). All mutations use Server Actions. All data is space-scoped — read `space_id` from JWT claims via `current_space_id()` in RLS, and from `app_metadata` in Server Actions.

Schema reference: `packages/db/docs/MT-SCHEMA-SPEC.md`
Target: `apps/web/src/app/(app)/admin/`

---

## Prerequisites

Install additional shadcn components if not already present:

```bash
npx shadcn@latest add table dialog form switch textarea tabs
npx shadcn@latest add alert-dialog popover command checkbox
```

Install React Hook Form + Zod resolver:

```bash
npm install react-hook-form @hookform/resolvers
```

---

## Part 1: Plans & Pricing (`/admin/plans`)

The most important admin page. Plans define what members can subscribe to and what credits they receive.

### File Structure

```
app/(app)/admin/plans/
├── page.tsx                    # Server component: fetch plans, render table
├── plans-table.tsx             # Client component: data table with actions
├── plan-form.tsx               # Client component: create/edit form (inside dialog)
├── plan-credit-config.tsx      # Client component: credit config per resource type
├── actions.ts                  # Server Actions: createPlan, updatePlan, deletePlan
├── schemas.ts                  # Zod schemas for plan validation
```

### Page: `page.tsx`

Server component. Fetches:

```typescript
// All plans for this space (RLS scopes by space_id automatically)
const { data: plans } = await supabase
  .from('plans')
  .select('*, plan_credit_config(*, resource_types(*))')
  .order('sort_order', { ascending: true });

// Resource types for the credit config form
const { data: resourceTypes } = await supabase
  .from('resource_types')
  .select('*')
  .order('sort_order', { ascending: true });
```

Renders heading + create button + `PlansTable`.

### Plans Table: `plans-table.tsx`

Client component. shadcn `Table` (not DataTable — overkill for <20 rows).

Columns:
- Name
- Price (formatted: `€49.00/mo`)
- Access type (badge)
- Fixed desk (checkmark or dash)
- Credits (summary: "20h desk, 4h meeting" or "Unlimited")
- Active (switch — toggles inline via Server Action)
- Actions (dropdown: Edit, Delete)

**Active toggle:** Calls `togglePlanActive` Server Action inline. No dialog needed — it's a simple boolean flip.

**Edit:** Opens `PlanForm` in a `Dialog` pre-filled with plan data.

**Delete:** Opens `AlertDialog` confirmation. Only allowed if no members are on this plan. The Server Action checks and returns an error if members exist.

### Plan Form: `plan-form.tsx`

Client component inside a `Dialog`. Used for both create and edit (prop: `plan?: Plan`).

Fields:

| Field | Type | Notes |
|---|---|---|
| Name | text input | Required, 2-100 chars |
| Slug | text input | Auto-generated from name on create, editable. Validated unique within space. |
| Description | textarea | Optional |
| Price | number input | In major currency units (€49.00), converted to cents on submit |
| Currency | select | Default from space config. Options: eur, gbp, usd, chf |
| IVA/Tax rate | number input | Default 21 for ES. 0 for countries with no VAT. |
| Access type | select | Options: none, business_hours, extended, twenty_four_seven |
| Fixed desk | checkbox | "Members on this plan get a dedicated desk" |
| Sort order | number input | Default: highest existing + 10 |

Below the main fields, render `PlanCreditConfig`.

### Plan Credit Config: `plan-credit-config.tsx`

Client component embedded in the plan form. Shows one row per resource type in the space.

For each resource type:
```
┌─────────────────┬──────────────┬───────────┐
│ Resource Type    │ Monthly Hours│ Unlimited │
├─────────────────┼──────────────┼───────────┤
│ Desk            │ [20]         │ [ ]       │
│ Meeting Room    │ [4]          │ [ ]       │
└─────────────────┴──────────────┴───────────┘
```

- "Monthly Hours" is a number input (stored as minutes internally: input × 60)
- "Unlimited" is a checkbox — when checked, disable the hours input and set `is_unlimited = true`
- If hours = 0 and not unlimited, this plan gets no credits for that resource type (like Checkpoint)

### Schemas: `schemas.ts`

```typescript
export const planSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional().or(z.literal('')),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3),
  ivaRate: z.number().min(0).max(100),
  accessType: z.enum(['none', 'business_hours', 'extended', 'twenty_four_seven']),
  hasFixedDesk: z.boolean(),
  sortOrder: z.number().int().default(0),
  creditConfig: z.array(z.object({
    resourceTypeId: z.string().uuid(),
    monthlyMinutes: z.number().int().min(0),
    isUnlimited: z.boolean(),
  })),
});
```

### Actions: `actions.ts`

**`createPlan(input)`**

1. Validate with `planSchema`
2. Get user + verify admin role
3. Read `space_id` from user's `app_metadata`
4. Check slug uniqueness within space
5. Insert into `plans`
6. Insert into `plan_credit_config` for each credit config entry
7. `revalidatePath('/admin/plans')`
8. Return `{ success: true, planId }`

**`updatePlan(planId, input)`**

1. Same validation
2. Update `plans` row
3. Upsert `plan_credit_config` rows (delete existing for this plan, insert new)
4. `revalidatePath('/admin/plans')`

**`deletePlan(planId)`**

1. Check no members reference this plan:
   ```sql
   SELECT COUNT(*) FROM members WHERE plan_id = $1
   ```
2. If members exist → return `{ success: false, error: 'Cannot delete plan with active members. Move or remove members first.' }`
3. Delete `plan_credit_config` rows (CASCADE should handle this, but be explicit)
4. Delete `plans` row
5. `revalidatePath('/admin/plans')`

**`togglePlanActive(planId, active)`**

1. Update `plans.active` to the new value
2. `revalidatePath('/admin/plans')`

---

## Part 2: Resources (`/admin/resources`)

Manage desks, rooms, and other bookable spaces. Onboarding created defaults — this page lets the admin rename, reorder, add, remove, and change status.

### File Structure

```
app/(app)/admin/resources/
├── page.tsx                    # Server component: fetch resources grouped by type
├── resource-group.tsx          # Client component: one section per resource type
├── resource-row.tsx            # Client component: single resource with inline edit
├── resource-form.tsx           # Client component: create/edit dialog
├── resource-type-form.tsx      # Client component: add/edit resource type dialog
├── actions.ts                  # Server Actions
├── schemas.ts                  # Zod schemas
```

### Page: `page.tsx`

Server component. Fetches:

```typescript
const { data: resourceTypes } = await supabase
  .from('resource_types')
  .select('*')
  .order('sort_order', { ascending: true });

const { data: resources } = await supabase
  .from('resources')
  .select('*, resource_type:resource_types(*)')
  .order('sort_order', { ascending: true });
```

Renders:
- "Add Resource Type" button (for adding phone booths, event spaces, etc.)
- One `ResourceGroup` per resource type
- Each group has "Add Resource" button and list of resources

Layout:

```
Resources
[+ Add Resource Type]

Desks (30)                                    [Edit Type]
┌──────────┬──────────┬────────────┬─────────┐
│ Name     │ Status   │ Floor     │ Actions  │
├──────────┼──────────┼────────────┼─────────┤
│ Desk 1   │ ● Avail  │ 0         │ ⋯       │
│ Desk 2   │ ● Avail  │ 0         │ ⋯       │
│ ...      │          │           │         │
└──────────┴──────────┴────────────┴─────────┘
[+ Add Desk]

Meeting Rooms (1)                             [Edit Type]
┌──────────────┬──────────┬──────────┬────────┐
│ Name         │ Capacity │ Status   │ Actions│
├──────────────┼──────────┼──────────┼────────┤
│ Meeting Room │ 7        │ ● Avail  │ ⋯      │
└──────────────┴──────────┴──────────┴────────┘
[+ Add Meeting Room]
```

### Resource Row: `resource-row.tsx`

Client component. Table row with:
- Name (text)
- Capacity (number — relevant for rooms)
- Floor (number)
- Status (badge: available = green, out_of_service = red, occupied = yellow)
- Actions dropdown: Edit, Change Status, Delete

**Status change:** Quick action — opens a small popover or dropdown with the three status options. Calls Server Action inline.

**Delete:** `AlertDialog` confirmation. Only allowed if no future bookings exist for this resource. Server Action checks.

### Resource Form: `resource-form.tsx`

Client component in a `Dialog`. Props: `resourceType` (which type we're adding to), optional `resource` (for editing).

Fields:

| Field | Type | Notes |
|---|---|---|
| Name | text input | Required |
| Capacity | number input | Default 1 for desks, higher for rooms |
| Floor | number input | Default 0 |
| Status | select | available, out_of_service |
| Sort order | number input | Auto-calculated: max existing + 1 |
| Metadata | (skip for v1) | Future: monitor available, window seat, etc. |

### Resource Type Form: `resource-type-form.tsx`

Client component in a `Dialog`. For adding new resource types (phone booth, event space, etc.).

Fields:

| Field | Type | Notes |
|---|---|---|
| Name | text input | "Phone Booth" |
| Slug | text input | Auto from name: "phone_booth" |
| Bookable | checkbox | Default true |
| Billable | checkbox | Default true |

On create, also prompt for a default hourly rate (creates `rate_config` row).

### Actions: `actions.ts`

**`createResource(input)`** — Insert into `resources` with `space_id` from JWT.

**`updateResource(resourceId, input)`** — Update `resources` row.

**`deleteResource(resourceId)`** — Check no future bookings exist, then delete.

**`updateResourceStatus(resourceId, status)`** — Quick status toggle.

**`createResourceType(input)`** — Insert into `resource_types` + `rate_config`.

**`updateResourceType(resourceTypeId, input)`** — Update `resource_types` row.

**`deleteResourceType(resourceTypeId)`** — Only if no resources of this type exist. Check and return error if they do.

**`updateRate(resourceTypeId, rateCents)`** — Update `rate_config.rate_cents`.

All actions: validate input with Zod, read `space_id` from `app_metadata`, `revalidatePath('/admin/resources')`.

### Schemas: `schemas.ts`

```typescript
export const resourceSchema = z.object({
  name: z.string().min(1).max(100),
  resourceTypeId: z.string().uuid(),
  capacity: z.number().int().min(1).max(1000),
  floor: z.number().int().min(-5).max(100),
  sortOrder: z.number().int().default(0),
});

export const resourceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  bookable: z.boolean(),
  billable: z.boolean(),
  defaultRateCents: z.number().int().min(0).optional(),
});
```

---

## Part 3: Space Settings (`/admin/settings`)

Space configuration: branding, operations, fiscal, feature flags. Owner-only for destructive settings, admin for the rest.

### File Structure

```
app/(app)/admin/settings/
├── page.tsx                    # Server component: fetch space, render tabs
├── branding-form.tsx           # Client component: name, logo, colors
├── operations-form.tsx         # Client component: hours, timezone, currency
├── fiscal-form.tsx             # Client component: fiscal ID requirements
├── features-form.tsx           # Client component: feature toggles
├── actions.ts                  # Server Actions
├── schemas.ts                  # Zod schemas
```

### Page: `page.tsx`

Server component. Fetches current space config:

```typescript
const { data: space } = await supabase
  .from('spaces')
  .select('*')
  .eq('id', spaceId)
  .single();
```

Renders shadcn `Tabs` with four sections: Branding, Operations, Fiscal, Features.

### Branding Tab: `branding-form.tsx`

Client component. Auto-saves on blur or has an explicit save button (save button is simpler and less surprising).

Fields:

| Field | Type | Notes |
|---|---|---|
| Space name | text input | `spaces.name` |
| Slug | text input | `spaces.slug`. Warn: changing slug changes the URL. Confirm dialog. |
| Logo URL | text input | `spaces.logo_url`. Future: file upload to Supabase Storage. For now, paste a URL. |
| Favicon URL | text input | `spaces.favicon_url`. Same — paste URL for now. |
| Primary color | color input | `spaces.primary_color`. Use native `<input type="color">` or a simple hex text input. |
| Accent color | color input | `spaces.accent_color`. Same. |

### Operations Tab: `operations-form.tsx`

Client component.

Fields:

| Field | Type | Notes |
|---|---|---|
| Timezone | select | Common timezones list, grouped by region. `spaces.timezone`. |
| Currency | select | eur, gbp, usd, chf, etc. `spaces.currency`. |
| Default locale | select | en, es, de, fr, pt, nl. `spaces.default_locale`. |
| Business hours | custom component | Per-day open/close time pickers, with "Closed" toggle per day. Saves to `spaces.business_hours` jsonb. |

Business hours component:

```
┌───────────┬────────────┬────────────┬─────────┐
│ Day       │ Open       │ Close      │ Closed  │
├───────────┼────────────┼────────────┼─────────┤
│ Monday    │ [09:00]    │ [18:00]    │ [ ]     │
│ Tuesday   │ [09:00]    │ [18:00]    │ [ ]     │
│ ...       │            │            │         │
│ Saturday  │  —         │  —         │ [✓]     │
│ Sunday    │  —         │  —         │ [✓]     │
└───────────┴────────────┴────────────┴─────────┘
```

Time inputs: use `<input type="time">` or a simple select with 30-min increments (08:00, 08:30, 09:00, ..., 22:00). When "Closed" is checked, disable time inputs and store `null` for that day.

### Fiscal Tab: `fiscal-form.tsx`

Client component.

Fields:

| Field | Type | Notes |
|---|---|---|
| Require fiscal ID for checkout | switch | `spaces.require_fiscal_id` |
| Supported ID types | multi-select or checkboxes | `spaces.supported_fiscal_id_types` jsonb array. Options from `fiscal_id_type` enum values. |

Show a note: "When enabled, members must provide a fiscal ID before completing any purchase. Required by law in Spain and some EU countries."

### Features Tab: `features-form.tsx`

Client component. Toggle switches for each feature flag.

| Feature | Default | Description |
|---|---|---|
| Passes | true | "Allow day and week passes" |
| Credits | true | "Enable credit-based booking system" |
| Leads | true | "Enable lead pipeline and trial days" |
| Recurring bookings | true | "Allow members to set up recurring bookings" |
| Guest passes | true | "Allow members to purchase passes for guests" |
| Open registration | false | "Allow anyone to create an account (vs invite-only)" |

Each toggle calls a Server Action that updates the corresponding key in `spaces.features` jsonb. Use a single generic action:

```typescript
export async function updateFeatureFlag(key: string, value: boolean)
```

### Actions: `actions.ts`

**`updateSpaceBranding(input)`** — Update name, slug, logo_url, favicon_url, colors. If slug changes, validate uniqueness and warn about URL change.

**`updateSpaceOperations(input)`** — Update timezone, currency, default_locale, business_hours.

**`updateSpaceFiscal(input)`** — Update require_fiscal_id, supported_fiscal_id_types.

**`updateFeatureFlag(key, value)`** — Read current `features` jsonb, merge the update, write back. Use Supabase's jsonb update or read-modify-write.

All actions: validate with Zod, read `space_id` from `app_metadata`, `revalidatePath('/admin/settings')`.

### Schemas: `schemas.ts`

```typescript
export const brandingSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional().or(z.literal('')),
  faviconUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const operationsSchema = z.object({
  timezone: z.string(),
  currency: z.string().length(3),
  defaultLocale: z.enum(['en', 'es', 'de', 'fr', 'pt', 'nl']),
  businessHours: z.record(
    z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    z.union([
      z.object({ open: z.string(), close: z.string() }),
      z.null(),
    ])
  ),
});

export const fiscalSchema = z.object({
  requireFiscalId: z.boolean(),
  supportedFiscalIdTypes: z.array(z.string()).min(1),
});
```

---

## Implementation Order

Build in this order. Each part is independently testable.

1. **Plans & Pricing** — Most important. Test: create a plan, edit it, set credit config, toggle active, delete.
2. **Resources** — Onboarding seeded defaults. Test: rename a desk, add a phone booth resource type, change status to out_of_service.
3. **Space Settings** — Least urgent but needed for Stripe Connect (next task). Test: change business hours, toggle features, change branding.

---

## Verification

### Plans
1. Navigate to `/admin/plans` → empty state or list of plans
2. Click "Create Plan" → form dialog opens
3. Fill out plan details + credit config → submit → plan appears in table
4. Click edit → modify price → save → table updates
5. Toggle active switch → plan greys out or badge changes
6. Delete a plan with no members → succeeds
7. Try to delete a plan that has members → error message

### Resources
8. Navigate to `/admin/resources` → resources grouped by type
9. Resources created during onboarding are visible
10. Click "Add Resource Type" → create "Phone Booth" → new section appears
11. Add a resource under "Phone Booth" → appears in list
12. Change a desk status to "Out of Service" → badge updates
13. Delete a resource with no bookings → succeeds
14. Try to delete a resource with future bookings → error message

### Settings
15. Navigate to `/admin/settings` → tabs render with current values
16. Change space name → save → header updates on next load
17. Change business hours → save → verify in database
18. Toggle "Open registration" feature → verify `spaces.features` updates
19. Enable "Require fiscal ID" → verify `spaces.require_fiscal_id` updates

### Dashboard Checklist
20. After creating plans → "Configure plans" checklist item shows as complete
21. Resources already exist from onboarding → already checked
22. "Connect Stripe" still unchecked (next task)

---

## Important Notes

- All Server Actions must read `space_id` from the authenticated user's `app_metadata`. Never accept `space_id` as a parameter from the client — that would allow cross-space writes.
- Deletion actions must check for dependencies (members on a plan, bookings on a resource) and return clear error messages. Never cascade-delete operational data from admin UI.
- Plans with `active = false` should still show in the admin table but not appear in the member-facing store.
- The `plan_credit_config` rows are tightly coupled to plans. When editing a plan's credit config, delete all existing rows for that plan and insert the new set. This is simpler than diffing and upserting.
- Slug changes on spaces are risky — the space URL changes. Show a confirmation dialog: "Changing the slug will change your workspace URL from {old}.cowork.app to {new}.cowork.app. Members will need to use the new URL. Continue?"
- `features` jsonb updates should use read-modify-write, not full replacement. This prevents losing keys that aren't rendered in the current UI version.
- After this task is complete, delete this file.
