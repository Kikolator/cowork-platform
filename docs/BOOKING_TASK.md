# TASK: Guest Checkout Flow (Day Pass + Membership)

## Context

Implement a checkout-first purchase flow for day passes and memberships. Users arrive from the
marketing landing page (savage-coworking.com) via deep-link and complete purchase before any
account creation. Post-payment, they are prompted to create an account via magic link — using
the same email they paid with — and land in the app with their pass/membership already active.

The checkout lives entirely in `apps/web` under the tenant-aware subdomain (e.g.
`savage-coworking.rogueops.app`). The landing page only passes intent via query params.

---

## Entry Points (from landing page)

```
/checkout/daypass
/checkout/membership?plan=<plan_slug>
```

Tenant resolved from subdomain via existing middleware. No auth required.

---

## Scope

### 1. Availability Check API

**Route**: `GET /api/checkout/availability`

Query params: `type=daypass|membership`, `plan_slug=<slug>` (membership only)

Logic:
- **Day pass**: query `spaces` for `daypass_enabled` flag and optionally a `daypass_daily_limit`
  (if the space caps same-day passes). Return `{ available: boolean, spotsLeft?: number }`.
- **Membership**: query `plans` where `slug = plan_slug AND space_id = current_space_id()`.
  If `capacity` is non-null, count active members on that plan and compare.
  Return `{ available: boolean, spotsLeft?: number, plan: { name, price_monthly, description } }`.

Return 404 if plan slug not found for this space. Return 200 with `available: false` if at
capacity — do not 4xx, the UI needs to render a waitlist state gracefully.

No auth. Uses `supabaseAdmin` to bypass RLS (read-only, no mutations here).

---

### 2. Checkout Pages

#### `/checkout/daypass`

**Flow**:
1. On mount: call `/api/checkout/availability?type=daypass`
   - If unavailable: render "No passes available today" + contact CTA. Stop.
2. Render form: `email` field + optional `name` field.
3. Submit → POST `/api/checkout/session` with `{ type: 'daypass', email, name }`
4. Redirect to Stripe Checkout (hosted, not Payment Element — simpler for now)
5. On return: redirect to `/checkout/confirmation?session_id=...`

#### `/checkout/membership?plan=<slug>`

**Flow**:
1. On mount: call `/api/checkout/availability?type=membership&plan_slug=<slug>`
   - If unavailable: render "This plan is full" + waitlist CTA. Stop.
   - On success: display plan name, price, and description from API response.
2. Render form: `email` + `name` fields.
3. Submit → POST `/api/checkout/session` with `{ type: 'membership', plan_slug, email, name }`
4. Redirect to Stripe Checkout
5. On return: redirect to `/checkout/confirmation?session_id=...`

Both pages are Server Components for the outer shell (space branding, availability fetch).
The form itself is a Client Component (`'use client'`).

---

### 3. Stripe Checkout Session API

**Route**: `POST /api/checkout/session`

Body (Zod-validated):
```ts
{
  type: 'daypass' | 'membership',
  email: string,        // validated email
  name?: string,
  plan_slug?: string,   // required when type === 'membership'
}
```

Logic:
1. Re-validate availability server-side (guard against race conditions / direct API calls).
   If unavailable, return 409.
2. Look up the Stripe price ID:
   - Day pass: from `spaces.daypass_stripe_price_id`
   - Membership: from `plans.stripe_price_id` where `slug = plan_slug`
3. Retrieve the tenant's Stripe Connect account ID from `tenants.stripe_account_id`.
4. Create a Stripe Checkout Session:
   - `mode: 'payment'` for day pass
   - `mode: 'subscription'` for membership
   - `customer_email: email`
   - `success_url: https://{host}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: https://{host}/checkout/{type}`
   - `application_fee_amount` (day pass) or `application_fee_percent` (membership) per
     existing platform fee config
   - `metadata: { type, plan_slug?, space_id, email, name }`
5. Return `{ url: session.url }`

Use the connected account pattern already established in `lib/stripe/`.

---

### 4. Stripe Webhook Handler

Extend existing `/api/webhooks/stripe` to handle `checkout.session.completed`.

On `checkout.session.completed`:
1. Extract `metadata.type`, `metadata.space_id`, `metadata.email`, `metadata.name`,
   `metadata.plan_slug`.
2. Upsert user in `auth.users` via `supabaseAdmin.auth.admin.createUser`:
   - `email`, `email_confirm: true`
   - `user_metadata: { name }`
   - If user already exists (email collision), fetch existing user — do not error.
3. Based on `metadata.type`:
   - **daypass**: insert row into `passes` with `status: 'active'`, `user_id`, `space_id`,
     `valid_from: today`, `valid_to: today` (or `+7 days` for weekly). Set
     `stripe_payment_intent_id` from session.
   - **membership**: insert row into `members` with `status: 'active'`, `plan_id` (looked up
     from `plan_slug`), `user_id`, `space_id`. Insert initial `subscriptions` row with
     `stripe_subscription_id` from session.
4. Send magic link to `email` via `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink',
   email })`. Email subject/body should reference the purchase (pass or membership).

Use `supabaseAdmin` throughout — webhook runs as service role.

---

### 5. Confirmation Page

**Route**: `/checkout/confirmation?session_id=<id>`

Server Component. Fetch Stripe session by `session_id` to get purchase details (type, plan name,
email). Do not expose raw session to client.

Render:
- Purchase summary (what they bought, space name)
- "Check your email" — magic link sent to `<email>`
- Resend link button → POST `/api/checkout/resend-magic-link` with `{ session_id }`
- Link to space homepage as fallback

No sensitive data in URL or client. Session ID is fine (it's Stripe's public-facing ID).

---

### 6. Resend Magic Link API

**Route**: `POST /api/checkout/resend-magic-link`

Body: `{ session_id: string }`

- Fetch Stripe session → get `customer_email`
- Rate limit: check a simple `magic_link_sent_at` timestamp in a lightweight cache or
  `kv`-style approach. Reject if last send < 60s ago.
- Re-invoke `supabaseAdmin.auth.admin.generateLink` and send.
- Return 200 or 429.

---

## File Structure

```
apps/web/app/
├── checkout/
│   ├── layout.tsx                   # Minimal layout: space logo + brand, no sidebar
│   ├── daypass/
│   │   └── page.tsx                 # Availability check + email form
│   ├── membership/
│   │   └── page.tsx                 # Plan display + availability + email form
│   ├── confirmation/
│   │   └── page.tsx                 # Post-payment confirmation + magic link CTA
│   └── _components/
│       ├── checkout-form.tsx        # 'use client' — shared email/name form
│       ├── availability-gate.tsx    # Wraps pages, shows unavailable state
│       └── resend-button.tsx        # 'use client' — resend magic link
└── api/
    └── checkout/
        ├── availability/
        │   └── route.ts
        ├── session/
        │   └── route.ts
        └── resend-magic-link/
            └── route.ts
```

---

## Constraints & Conventions

- **No auth required** on any `/checkout/*` route or `/api/checkout/*` route. Remove auth
  middleware guard for these paths in `middleware.ts`.
- Space context still resolved from subdomain — middleware must still run for space resolution,
  just skip the auth redirect for `/checkout` paths.
- Zod validation at every API boundary. No `any`.
- Server Actions not used here — these are externally-triggered flows (Stripe redirects),
  so API routes are appropriate.
- Do not create a Stripe customer object before payment — use `customer_email` on the session.
  Stripe creates the customer on completion; store `stripe_customer_id` from the webhook event.
- All Stripe calls go through the Connect pattern: platform account creates session on behalf
  of connected account (`stripeAccountId`).
- Migration required if `plans` or `spaces` is missing `stripe_price_id` /
  `daypass_stripe_price_id` / `daypass_enabled` columns. Check schema spec first.
- RLS: webhook handler uses `supabaseAdmin` (service role). No RLS bypass needed elsewhere
  since checkout routes are unauthenticated reads only.
- Do not send the magic link from the Stripe webhook if the checkout session `payment_status`
  is not `'paid'`. Check before proceeding.

---

## Out of Scope

- Waitlist signup (future task)
- Promo/discount codes
- Multiple passes in one transaction
- Plan upgrade/downgrade (members only, in-app)
- Custom domain landing page routing

---

## Definition of Done

- [ ] `GET /api/checkout/availability` returns correct availability for both types
- [ ] `/checkout/daypass` renders, validates, and redirects to Stripe
- [ ] `/checkout/membership?plan=<slug>` renders plan details, validates, redirects to Stripe
- [ ] Stripe webhook creates user + pass/member record on `checkout.session.completed`
- [ ] Magic link email sent post-payment to purchase email
- [ ] `/checkout/confirmation` renders purchase summary and resend CTA
- [ ] Resend endpoint rate-limits correctly
- [ ] Auth middleware bypasses `/checkout` paths but still resolves space
- [ ] `turbo check-types` passes with zero errors
- [ ] `turbo lint` passes
- [ ] Unit tests for availability logic and webhook handler (Vitest)
