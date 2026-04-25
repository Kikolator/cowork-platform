# Checkout Links

Checkout links let anyone purchase a pass or membership directly from your space — no login required. You can embed these links on your website, share them on social media, or include them in emails.

## URL Format

Your space is accessed via its subdomain:

```
https://<your-space-slug>.rogueops.app
```

Checkout links are paths on that subdomain:

| Product    | URL                                                              |
| ---------- | ---------------------------------------------------------------- |
| Pass       | `https://<space>.rogueops.app/checkout/product?slug=<slug>`      |
| Membership | `https://<space>.rogueops.app/checkout/membership?plan=<slug>`   |

**Examples** (for a space with slug `urbanwork`):

```
https://urbanwork.rogueops.app/checkout/product?slug=day-pass
https://urbanwork.rogueops.app/checkout/product?slug=week-pass
https://urbanwork.rogueops.app/checkout/membership?plan=hot-desk
https://urbanwork.rogueops.app/checkout/membership?plan=dedicated-desk
```

## How It Works

1. Visitor opens the checkout link — no account or login needed.
2. They pick a start date (for passes) and enter their email.
3. If community rules are configured, they must accept before proceeding.
4. They're redirected to a Stripe-hosted payment page on your connected Stripe account.
5. After payment, they land on a confirmation page and receive a magic-link email to access their account.

The entire flow is guest-friendly. The visitor doesn't need to create an account first — their account is provisioned automatically after payment.

## Pass Links

```
https://<space>.rogueops.app/checkout/product?slug=<product-slug>
```

The `slug` query parameter must match an active pass product in your space.

- **Day passes** — visitor picks a single date. Availability is checked against the max pass desks limit and existing bookings.
- **Week passes** — visitor picks a start date. The end date is auto-calculated based on the duration (skipping weekends and closures).
- When spots are limited, remaining availability is shown. Sold-out dates are blocked.

### Creating Pass Products

Pass products are created in the admin dashboard under **Products**. When creating a pass, you configure:
- **Pass type** — day or week
- **Duration** — number of business days (e.g., 1 for day pass, 5 for week pass)
- **Consecutive days** — whether days must be consecutive
- **Price** — the pass price

The product slug (e.g., `day-pass`, `week-pass`) is what you use in the checkout link.

### Max Pass Desks

In admin **Settings > Operations**, you can set a maximum number of desks available for pass holders. This prevents passes from filling your entire space. Leave empty for no limit.

## Membership Links

```
https://<space>.rogueops.app/checkout/membership?plan=<slug>
```

The `plan` query parameter is **required** — it identifies which plan the visitor is signing up for.

- The slug must match an active plan in your space. If the plan doesn't exist or is inactive, the visitor sees "Plan not found."
- If the plan has a capacity limit, remaining spots are checked. Full plans show "This plan is currently full."
- The plan name, description, and monthly price are displayed automatically.

### Finding Your Plan Slugs

Plan slugs are set when you create a plan in the admin dashboard. They're URL-friendly identifiers like `hot-desk`, `dedicated-desk`, or `private-office`. You'll need the exact slug for the checkout link.

## Where to Use These Links

**On your website:**
```html
<a href="https://urbanwork.rogueops.app/checkout/product?slug=day-pass">
  Buy a Day Pass
</a>

<a href="https://urbanwork.rogueops.app/checkout/membership?plan=hot-desk">
  Join — Hot Desk
</a>
```

**In a button or CTA:**
```html
<a href="https://urbanwork.rogueops.app/checkout/membership?plan=hot-desk"
   style="display:inline-block; padding:12px 24px; background:#000; color:#fff; border-radius:8px; text-decoration:none;">
  Get Started
</a>
```

**In emails or social media:** paste the full URL directly — it works as a standalone link.

## Custom Domains

If your space uses a custom domain instead of a `rogueops.app` subdomain, the checkout links use that domain:

```
https://your-custom-domain.com/checkout/product?slug=day-pass
https://your-custom-domain.com/checkout/membership?plan=hot-desk
```

## Community Rules

If you've configured community rules in **Settings > Operations**, visitors must accept them during checkout. Rules are written in markdown and displayed with an "I accept" checkbox.

## After Purchase

Once payment completes:

1. The visitor lands on `/checkout/confirmation` with a success message.
2. A magic-link email is sent to the email they provided during checkout.
3. For pass purchases, an access instruction email is sent with door codes, WiFi info, and community rules (if configured).
4. Clicking the magic link logs them into their new account where their pass or membership is already active.
5. If the email doesn't arrive, there's a "Resend magic link" button on the confirmation page.
