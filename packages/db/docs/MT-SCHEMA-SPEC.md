# Multi-Tenant Coworking Platform — Database Schema Spec

Reference document for implementing the cowork-platform database. Designed for boutique coworking spaces (5–50 desks). Single Supabase project, multi-tenant via `space_id` on every operational table.

---

## Hierarchy

```
tenant (the business account)
  └── space (the physical location)
        └── all operational data (members, bookings, resources, etc.)
```

V1: every tenant has exactly one space (1:1). Schema supports 1:many for future multi-location tenants. No code changes needed to enable it — just allow creating a second space under the same tenant.

A single user (shared_profiles) can be a member at multiple spaces across different tenants. They sign up once, join N spaces.

---

## Platform-Level Tables (no space_id)

### tenants

The business account. Owns one or more spaces. Holds Stripe Connect and platform billing.

```sql
CREATE TABLE tenants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  slug                        text NOT NULL UNIQUE,
  status                      text NOT NULL DEFAULT 'trial'
                              CHECK (status IN ('trial', 'active', 'suspended', 'churned')),
  -- Stripe Connect
  stripe_account_id           text UNIQUE,
  stripe_onboarding_complete  boolean DEFAULT false,
  -- Platform billing (what the tenant pays us)
  platform_plan               text NOT NULL DEFAULT 'free'
                              CHECK (platform_plan IN ('free', 'pro', 'enterprise')),
  platform_fee_percent        smallint CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 50),
  platform_subscription_id    text,
  trial_ends_at               timestamptz,
  -- Billing contact
  billing_email               text,
  billing_name                text,
  -- Metadata
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);
```

### spaces

A physical coworking location. All operational tables reference this.

```sql
CREATE TABLE spaces (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  slug                      text NOT NULL,
  -- Branding
  logo_url                  text,
  favicon_url               text,
  primary_color             text DEFAULT '#000000',
  accent_color              text DEFAULT '#3b82f6',
  -- Location
  address                   text,
  city                      text,
  country_code              text NOT NULL DEFAULT 'ES',
  timezone                  text NOT NULL DEFAULT 'Europe/Madrid',
  -- Operations
  business_hours            jsonb NOT NULL DEFAULT '{
    "mon": {"open": "09:00", "close": "18:00"},
    "tue": {"open": "09:00", "close": "18:00"},
    "wed": {"open": "09:00", "close": "18:00"},
    "thu": {"open": "09:00", "close": "18:00"},
    "fri": {"open": "09:00", "close": "18:00"},
    "sat": null,
    "sun": null
  }',
  currency                  text NOT NULL DEFAULT 'eur',
  default_locale            text NOT NULL DEFAULT 'en'
                            CHECK (default_locale IN ('en', 'es', 'de', 'fr', 'pt', 'nl')),
  -- Feature flags
  features                  jsonb NOT NULL DEFAULT '{
    "passes": true,
    "credits": true,
    "leads": true,
    "recurring_bookings": true,
    "guest_passes": true
  }',
  -- Domain
  custom_domain             text UNIQUE,
  -- Fiscal config
  require_fiscal_id         boolean DEFAULT false,
  supported_fiscal_id_types jsonb DEFAULT '["nif", "nie", "passport", "cif"]',
  -- Status
  active                    boolean DEFAULT true,
  -- Metadata
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
```

### shared_profiles

Platform-level user identity. No space_id. Slim — only universal personal info.

```sql
CREATE TABLE shared_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  phone           text,
  avatar_url      text,
  preferred_lang  text DEFAULT 'en' CHECK (preferred_lang IN ('en', 'es', 'de', 'fr', 'pt', 'nl')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

Auto-created via auth trigger on signup.

### space_users

Maps users to spaces with roles. Replaces `shared_admins`.

```sql
CREATE TABLE space_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member'
             CHECK (role IN ('member', 'admin', 'owner')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, space_id)
);
```

Roles:
- `owner` — created the space, can manage billing and other admins
- `admin` — can manage members, resources, bookings, leads
- `member` — standard member (also has a row in `members` table)

### platform_admins

Platform-level superadmins (you, future platform staff). Separate from space roles.

```sql
CREATE TABLE platform_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
```

---

## Enums (universal, not configurable)

These represent platform-level status machines. Every coworking uses the same lifecycle states.

```sql
-- Status enums (keep — universal lifecycle states)
CREATE TYPE member_status AS ENUM (
  'active', 'paused', 'past_due', 'cancelling', 'churned'
);

CREATE TYPE booking_status AS ENUM (
  'pending_payment', 'confirmed', 'checked_in', 'completed',
  'cancelled', 'no_show'
);

CREATE TYPE pass_status AS ENUM (
  'pending_payment', 'active', 'used', 'cancelled', 'expired'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'invited', 'confirmed', 'completed', 'follow_up', 'converted', 'lost'
);

-- Type enums (keep — genuinely universal concepts)
CREATE TYPE pass_type AS ENUM ('day', 'week');

CREATE TYPE fiscal_id_type AS ENUM (
  'nif', 'nie', 'passport', 'cif',
  'eu_vat', 'foreign_tax_id', 'other'
);

CREATE TYPE credit_grant_source AS ENUM (
  'subscription', 'purchase', 'manual', 'refund'
);

CREATE TYPE product_category AS ENUM (
  'subscription', 'pass', 'hour_bundle', 'addon', 'deposit', 'event'
);

CREATE TYPE resource_status AS ENUM (
  'available', 'occupied', 'out_of_service'
);

CREATE TYPE recurrence_pattern AS ENUM (
  'daily', 'weekly', 'biweekly'
);
```

### What became data (no longer enums)

| Old Enum | Replacement | Reason |
|---|---|---|
| `savage_plan_type` | `plans` table (per space) | Business-configurable |
| `savage_resource_type` | `resource_types` table (per space) | Business-configurable |
| `savage_access_level` | Columns on `plans` table | Plan-level config |
| `savage_product_category` | Kept as enum `product_category` | Universal, expanded |
| `app_type` | Removed, replaced by `space_id` FK | Multi-tenant |

---

## Space-Scoped Tables

Every table below has `space_id uuid NOT NULL REFERENCES spaces(id)`.

### resource_types

Replaces `savage_resource_type` enum. Each space defines its own.

```sql
CREATE TABLE resource_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  slug       text NOT NULL,
  name       text NOT NULL,
  bookable   boolean DEFAULT true,
  billable   boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);
```

Seeded during space onboarding with sensible defaults (desk, meeting_room, podcast_room). Tenant can add phone_booth, event_space, kitchen, locker, etc.

### rate_config

Hourly rates per resource type. Replaces `savage_rate_config`.

```sql
CREATE TABLE rate_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
  rate_cents       integer NOT NULL,
  currency         text NOT NULL DEFAULT 'eur',
  iva_rate         numeric NOT NULL DEFAULT 21,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(space_id, resource_type_id)
);
```

### plans

Replaces `savage_plan_type` enum + plan-related fields on products. Each space defines its own plan tiers.

```sql
CREATE TABLE plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  -- Pricing
  price_cents         integer NOT NULL,
  currency            text NOT NULL DEFAULT 'eur',
  iva_rate            numeric NOT NULL DEFAULT 21,
  -- Stripe
  stripe_price_id     text,
  stripe_product_id   text,
  -- Access control (replaces access_level enum)
  access_type         text NOT NULL DEFAULT 'business_hours'
                      CHECK (access_type IN ('none', 'business_hours', 'extended', 'twenty_four_seven')),
  has_fixed_desk      boolean DEFAULT false,
  -- Credit allowances are in plan_credit_config (separate table, per resource_type)
  -- Display
  sort_order          integer DEFAULT 0,
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);
```

`access_type` added `extended` for spaces that offer something between business_hours and 24/7 (e.g., 7am–10pm). The actual hours are on the `spaces` table; this just controls which tier applies.

### plan_credit_config

How many credits each plan grants per resource type per month. Replaces `savage_plan_credits` with FK to resource_types instead of credit_type enum.

```sql
CREATE TABLE plan_credit_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  plan_id          uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
  monthly_minutes  integer NOT NULL DEFAULT 0 CHECK (monthly_minutes >= 0),
  is_unlimited     boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(plan_id, resource_type_id)
);
```

### resources

Physical desks, rooms, etc. Replaces `savage_resources`.

```sql
CREATE TABLE resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id),
  name             text NOT NULL,
  status           resource_status NOT NULL DEFAULT 'available',
  capacity         integer DEFAULT 1,
  floor            integer DEFAULT 0,
  sort_order       integer DEFAULT 0,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
```

### members

Space-scoped membership. Replaces `savage_members`. Now holds Stripe + billing fields that were on shared_profiles.

```sql
CREATE TABLE members (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                     uuid NOT NULL REFERENCES plans(id),
  status                      member_status NOT NULL DEFAULT 'active',
  -- Stripe (per connected account)
  stripe_customer_id          text,
  stripe_subscription_id      text UNIQUE,
  -- Desk assignment
  fixed_desk_id               uuid REFERENCES resources(id),
  -- Access
  has_twenty_four_seven       boolean DEFAULT false,
  access_code                 text,
  alarm_approved              boolean DEFAULT false,
  nuki_auth_id                bigint,          -- Nuki keypad authorization ID (set by sync)
  -- Professional context (space-specific)
  company                     text,
  role_title                  text,
  -- Fiscal / billing (space-specific — different per country/entity)
  billing_entity_type         text DEFAULT 'individual'
                              CHECK (billing_entity_type IN ('individual', 'company')),
  fiscal_id_type              fiscal_id_type,
  fiscal_id                   text,
  billing_company_name        text,
  billing_company_tax_id_type fiscal_id_type,
  billing_company_tax_id      text,
  billing_address_line1       text,
  billing_address_line2       text,
  billing_city                text,
  billing_postal_code         text,
  billing_state_province      text,
  billing_country             text DEFAULT 'ES',
  -- Dates
  joined_at                   timestamptz DEFAULT now(),
  paused_at                   timestamptz,
  cancel_requested_at         timestamptz,
  cancelled_at                timestamptz,
  -- Metadata
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id),
  UNIQUE(space_id, stripe_customer_id)
);
```

### products

Store catalogue. Replaces `savage_products`.

```sql
CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  category            product_category NOT NULL,
  -- Checkout behavior
  purchase_flow       text NOT NULL DEFAULT 'checkout'
                      CHECK (purchase_flow IN (
                        'checkout', 'subscription', 'date_picker', 'subscription_addon'
                      )),
  -- Pricing
  price_cents         integer NOT NULL,
  iva_rate            numeric NOT NULL DEFAULT 21,
  currency            text NOT NULL DEFAULT 'eur',
  -- Stripe
  stripe_price_id     text,
  stripe_product_id   text,
  -- Links to plan (for subscription products)
  plan_id             uuid REFERENCES plans(id),
  -- Hour bundle fulfillment
  -- { "resource_type_id": "uuid", "minutes": 600 }
  credit_grant_config jsonb,
  -- Visibility
  -- {
  --   "require_membership": true,
  --   "require_no_membership": true,
  --   "require_plan_ids": ["uuid", "uuid"],
  --   "exclude_unlimited": true
  -- }
  visibility_rules    jsonb NOT NULL DEFAULT '{}',
  -- Status
  active              boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);
```

### bookings

Replaces `savage_bookings`. Added `checked_out_at`.

```sql
CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  resource_id       uuid NOT NULL REFERENCES resources(id),
  -- Time
  start_time        timestamptz NOT NULL,
  end_time          timestamptz NOT NULL,
  -- Status
  status            booking_status NOT NULL DEFAULT 'confirmed',
  -- Check-in/out tracking
  checked_in_at     timestamptz,
  checked_out_at    timestamptz,
  -- Payment (pay-per-use bookings)
  stripe_session_id text,
  amount_cents      integer,
  -- Credits
  duration_minutes  integer,
  credit_type_id    uuid REFERENCES resource_types(id),
  credits_deducted  integer DEFAULT 0,
  -- Recurrence
  recurring_rule_id uuid REFERENCES recurring_rules(id),
  -- Cancellation
  cancelled_at      timestamptz,
  cancel_reason     text,
  -- Reminders
  reminded_at       timestamptz,
  -- Metadata
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  -- Prevent double-booking (btree_gist)
  CONSTRAINT no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);
```

### recurring_rules

Replaces `savage_recurring_rules`.

```sql
CREATE TABLE recurring_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  resource_id   uuid NOT NULL REFERENCES resources(id),
  pattern       recurrence_pattern NOT NULL,
  day_of_week   integer,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### passes

Replaces `savage_passes`.

```sql
CREATE TABLE passes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  pass_type         pass_type NOT NULL,
  status            pass_status NOT NULL DEFAULT 'pending_payment',
  -- Dates
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  -- Desk
  assigned_desk_id  uuid REFERENCES resources(id),
  -- Payment
  stripe_session_id text,
  amount_cents      integer NOT NULL,
  -- Guest
  is_guest          boolean NOT NULL DEFAULT false,
  purchased_by      uuid REFERENCES auth.users(id),
  -- Metadata
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
```

### credit_grants

Replaces `savage_credit_grants`. `credit_type` is now FK to `resource_types` instead of enum.

```sql
CREATE TABLE credit_grants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type_id    uuid NOT NULL REFERENCES resource_types(id),
  source              credit_grant_source NOT NULL,
  amount_minutes      integer NOT NULL CHECK (amount_minutes > 0),
  used_minutes        integer NOT NULL DEFAULT 0 CHECK (used_minutes >= 0),
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz,
  stripe_invoice_id   text,
  stripe_line_item_id text,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT used_not_exceeding_amount CHECK (used_minutes <= amount_minutes),
  CONSTRAINT valid_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Idempotency indexes (prevent duplicate webhook grants)
CREATE UNIQUE INDEX idx_credit_grants_invoice_unique
  ON credit_grants(stripe_invoice_id, resource_type_id, user_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX idx_credit_grants_line_item_unique
  ON credit_grants(stripe_line_item_id, resource_type_id, user_id)
  WHERE stripe_line_item_id IS NOT NULL;
```

### booking_credit_deductions

Junction table. Tracks which grants funded which booking (for precise refunds).

```sql
CREATE TABLE booking_credit_deductions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  grant_id    uuid NOT NULL REFERENCES credit_grants(id),
  minutes     integer NOT NULL CHECK (minutes > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### leads

Replaces `savage_leads`.

```sql
CREATE TABLE leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  email             text NOT NULL,
  full_name         text,
  phone             text,
  company           text,
  status            lead_status NOT NULL DEFAULT 'new',
  source            text DEFAULT 'website',
  trial_date        date,
  trial_confirmed   boolean DEFAULT false,
  converted_user_id uuid REFERENCES auth.users(id),
  last_contacted_at timestamptz,
  follow_up_count   integer DEFAULT 0,
  admin_notes       text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  archived_at       timestamptz
);
```

### payment_events

Stripe webhook audit trail. Replaces `savage_payment_events`.

```sql
CREATE TABLE payment_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id           uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  stripe_event_id    text NOT NULL UNIQUE,
  event_type         text NOT NULL,
  stripe_customer_id text,
  stripe_account_id  text,
  user_id            uuid REFERENCES auth.users(id),
  payload            jsonb NOT NULL,
  processed          boolean DEFAULT false,
  error              text,
  created_at         timestamptz DEFAULT now()
);
```

Added `stripe_account_id` — used to verify webhook belongs to this space's connected account.

### monthly_stats / daily_stats

Replaces `savage_monthly_stats` and `savage_daily_stats`.

```sql
CREATE TABLE monthly_stats (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id               uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  month                  date NOT NULL,
  total_members          integer,
  members_by_plan        jsonb,
  new_members            integer,
  churned_members        integer,
  mrr_cents              integer,
  variable_revenue_cents integer,
  total_revenue_cents    integer,
  avg_desk_occupancy     numeric,
  avg_room_utilisation   numeric,
  peak_hour              integer,
  day_passes_sold        integer,
  week_passes_sold       integer,
  leads_created          integer,
  leads_converted        integer,
  generated_at           timestamptz DEFAULT now(),
  UNIQUE(space_id, month)
);

CREATE TABLE daily_stats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date           date NOT NULL,
  desk_occupancy numeric,
  room_bookings  integer,
  active_passes  integer,
  check_ins      integer,
  check_outs     integer,
  generated_at   timestamptz DEFAULT now(),
  UNIQUE(space_id, date)
);
```

---

## Operational Completeness

### space_closures

Blocks bookings on holidays, local fiestas, maintenance days.

```sql
CREATE TABLE space_closures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date       date NOT NULL,
  reason     text,
  all_day    boolean DEFAULT true,
  start_time time,
  end_time   time,
  created_at timestamptz DEFAULT now(),
  UNIQUE(space_id, date)
);
```

`all_day = true` blocks the full day. `all_day = false` + `start_time/end_time` blocks a partial day (e.g., closed afternoon for maintenance). Availability functions must check this table before returning slots.

### space_access_config

Per-space door access code configuration. Supports manual shared codes and Nuki smart lock integration.

```sql
CREATE TABLE space_access_config (
  space_id                uuid PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT false,
  mode                    text NOT NULL DEFAULT 'manual'
                          CHECK (mode IN ('manual', 'nuki')),
  -- General codes: one per access tier
  code_business_hours     text,
  code_extended           text,
  code_twenty_four_seven  text,
  -- Nuki integration
  nuki_api_token          text,
  nuki_smartlock_id       text,
  nuki_last_sync_at       timestamptz,
  nuki_sync_error         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
```

`mode = 'manual'`: admin sets shared codes per access tier. Members see the code matching their plan's `access_type`. Individual overrides via `members.access_code`.

`mode = 'nuki'`: system auto-generates unique 6-digit keypad PINs per member via the Nuki Web API. PINs get time restrictions matching the member's plan access level. Codes are automatically deleted when subscriptions end (via webhook).

### member_notes

Replaces the single `admin_notes` text field on members. Timestamped note timeline for operational tracking.

```sql
CREATE TABLE member_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id),
  content    text NOT NULL,
  category   text DEFAULT 'general'
             CHECK (category IN (
               'general', 'billing', 'access', 'incident', 'support'
             )),
  created_at timestamptz DEFAULT now()
);
```

No `updated_at` — notes are append-only. Admins can't edit past notes. This gives a reliable audit trail ("Called about late payment — 2025-03-12", "Issued new access code — 2025-03-15").

### notifications_log

Tracks what emails/notifications were sent, prevents duplicates, gives admin visibility.

```sql
CREATE TABLE notifications_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  channel      text NOT NULL CHECK (channel IN ('email', 'push', 'sms')),
  template     text NOT NULL,
  recipient    text NOT NULL,
  subject      text,
  metadata     jsonb DEFAULT '{}',
  sent_at      timestamptz DEFAULT now(),
  error        text
);
```

Edge Functions check this before sending to prevent double-sends (e.g., booking reminder already sent).

### waitlist

When a time slot or resource is full, members can join a waitlist. If a booking is cancelled, next in line gets notified.

```sql
CREATE TABLE waitlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  resource_id   uuid NOT NULL REFERENCES resources(id),
  desired_date  date NOT NULL,
  desired_start time,
  desired_end   time,
  status        text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  notified_at   timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);
```

### notification_preferences

Per-member notification settings. Defaults to all enabled — member can opt out.

```sql
CREATE TABLE notification_preferences (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id),
  booking_reminders       boolean DEFAULT true,
  credit_warnings         boolean DEFAULT true,
  marketing               boolean DEFAULT false,
  weekly_summary          boolean DEFAULT true,
  preferred_channel       text DEFAULT 'email'
                          CHECK (preferred_channel IN ('email', 'push', 'sms')),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id)
);
```

---

## Security

### Helper Functions

```sql
-- Verify caller has access to the space (used at top of every SECURITY DEFINER function)
CREATE FUNCTION verify_space_access(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF (auth.jwt() ->> 'space_id')::uuid IS DISTINCT FROM p_space_id
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

-- Check if user is admin/owner of a space
CREATE FUNCTION is_space_admin(p_user_id uuid, p_space_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM space_users
    WHERE user_id = p_user_id
      AND space_id = p_space_id
      AND role IN ('admin', 'owner')
  );
END;
$$;

-- Check if user is a platform superadmin
CREATE FUNCTION is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = p_user_id
  );
END;
$$;
```

### JWT Custom Claims

Set during auth callback after space resolution:

```json
{
  "space_id": "uuid",
  "space_role": "member|admin|owner",
  "tenant_id": "uuid"
}
```

### RLS Patterns

Every space-scoped table uses one of these patterns:

```sql
-- Pattern 1: User reads own data (scoped to space via JWT)
CREATE POLICY "users_read_own" ON [table]
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Pattern 2: Space admins read all within their space
CREATE POLICY "space_admins_read_all" ON [table]
  FOR SELECT USING (
    is_space_admin(auth.uid(), (auth.jwt() ->> 'space_id')::uuid)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Pattern 3: Space admins full CRUD within their space
CREATE POLICY "space_admins_full" ON [table]
  FOR ALL USING (
    is_space_admin(auth.uid(), (auth.jwt() ->> 'space_id')::uuid)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Pattern 4: Public read (e.g., products, resources — still space-scoped)
CREATE POLICY "public_read" ON [table]
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Pattern 5: Platform admins (superadmin dashboard)
CREATE POLICY "platform_admins_full" ON [table]
  FOR ALL USING (is_platform_admin(auth.uid()));
```

### Critical Security Rules

**1. SECURITY DEFINER functions must always include space_id in WHERE clauses.**
Every query inside a SECURITY DEFINER function MUST filter by `space_id = p_space_id`. A missing filter = cross-tenant data exposure. Call `verify_space_access(p_space_id)` at the top of every function as a safety net.

**2. shared_profiles cross-space visibility.**
Space admins must only see profiles of users who are members of their space:

```sql
CREATE POLICY "space_admins_read_member_profiles" ON shared_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = shared_profiles.id
        AND m.space_id = (auth.jwt() ->> 'space_id')::uuid
    )
    AND is_space_admin(auth.uid(), (auth.jwt() ->> 'space_id')::uuid)
  );
```

**3. Stripe webhook account verification.**
When processing a Stripe webhook event, verify `event.account` matches the space's `tenant.stripe_account_id`. Never process a webhook for a mismatched account. Log the mismatch in `payment_events` with `processed = false` and `error`.

**4. Platform admin isolation.**
`platform_admins` is a separate table. Space admins cannot query it. Space admin privileges never escalate to platform admin. Platform admin RLS policies are separate from space admin policies.

**5. JWT claim integrity.**
Custom claims (`space_id`, `space_role`, `tenant_id`) are set server-side during the auth callback only. No client-callable RPC should set or modify these claims. The auth callback verifies the user's `space_users` record before setting claims.

**6. Tenant/space cascade protection.**
Suspending a tenant must cascade to all spaces (block all member operations). Implement as a check in middleware, not as data deletion. Suspended tenants keep their data — they just can't access it.

---

## Database Functions (space-aware)

All functions from the old schema are rewritten with `p_space_id` parameter and `verify_space_access()` call. Key changes:

### get_desk_availability(p_space_id, p_date)

- Reads timezone from `spaces.timezone` instead of hardcoding `Europe/Madrid`
- Checks `space_closures` — returns 0 if date is a closure day
- Filters all queries by `space_id`

### get_room_availability(p_space_id, p_resource_id, p_date)

- Reads business hours from `spaces.business_hours` for the relevant day
- Checks `space_closures` — returns empty if closed
- Reads timezone from `spaces.timezone`
- Generates slots based on actual business hours, not hardcoded 9–18

### create_booking_with_credits(p_space_id, p_user_id, p_resource_id, p_start_time, p_end_time)

- Calls `verify_space_access(p_space_id)` first
- Uses `resource_type_id` FK instead of credit_type enum mapping
- Checks `plan_credit_config` for unlimited status via `plan_id` FK
- Same grant deduction logic (expiring first, then purchased)

### cancel_booking_refund_credits(p_space_id, p_booking_id, p_user_id)

- Calls `verify_space_access(p_space_id)` first
- Same refund logic, now space-scoped

### grant_credits(p_space_id, ...)

- `resource_type_id` parameter instead of credit_type enum
- Same idempotency logic with Stripe invoice/line_item unique indexes
- Space-scoped

### activate_pass(p_space_id, p_user_id, p_stripe_session_id)

- Space-scoped pass lookup
- Same auto-assign desk logic, filtered by space

### expire_renewable_credits(p_space_id, p_user_id)

- Space-scoped

---

## Migration Sequence

```
00001_platform_foundation
  Extensions: btree_gist
  All enums (universal status types)
  Trigger function: set_updated_at
  Security functions: verify_space_access, is_space_admin, is_platform_admin
  Tables: tenants, spaces, shared_profiles, space_users, platform_admins
  Auth trigger: auto-create shared_profiles on signup
  RLS for all above

00002_resource_types
  Tables: resource_types, rate_config
  RLS, indexes, triggers

00003_plans
  Tables: plans, plan_credit_config
  RLS, indexes, triggers

00004_resources
  Table: resources
  RLS, indexes, triggers

00005_members
  Tables: members, member_notes
  RLS, indexes, triggers

00006_products
  Table: products
  RLS, indexes, triggers

00007_bookings
  Tables: recurring_rules, bookings
  EXCLUDE constraint for overlap prevention
  DB functions: get_desk_availability, get_room_availability
  RLS, indexes, triggers

00008_passes
  Table: passes
  DB functions: auto_assign_desk, activate_pass
  RLS, indexes, triggers

00009_credits
  Tables: credit_grants, booking_credit_deductions
  DB functions: get_credit_balance, grant_credits,
    create_booking_with_credits, cancel_booking_refund_credits,
    expire_renewable_credits
  RLS, indexes, triggers, permissions

00010_leads
  Table: leads
  RLS, indexes, triggers

00011_stats_payments_ops
  Tables: monthly_stats, daily_stats, payment_events,
    space_closures, notifications_log, waitlist,
    notification_preferences
  RLS, indexes, triggers

00012_cron
  Extensions: pg_cron, pg_net
  Helper: invoke_edge_function
  Schedules: recurring bookings, reminders, trial follow-ups,
    monthly stats, daily stats, credit expiry
```

---

## Onboarding Flow (what happens when a new tenant signs up)

1. Create `tenants` record (status: trial)
2. Create `spaces` record with defaults (business hours, timezone, currency from signup form)
3. Create `space_users` record (role: owner) for the signup user
4. Seed default `resource_types`: desk, meeting_room
5. Seed default `rate_config` for each resource type (with sensible defaults, editable by admin)
6. Tenant configures plans via admin UI (no seed — every space has different pricing)
7. Tenant adds resources via admin UI (how many desks, rooms, etc.)
8. Tenant connects Stripe account (Connect onboarding)
9. Tenant goes live (status: active)

No seed data in migrations. All operational data is created during onboarding or by the tenant admin.
