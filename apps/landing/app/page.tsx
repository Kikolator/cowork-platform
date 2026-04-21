import { ArrowRight, Building2, CreditCard, Globe, Shield, Smartphone, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="glass-gradient-bg min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-bold tracking-tight">
            RogueOps
          </span>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center md:pt-32 md:pb-24">
        <div className="inline-block rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8">
          Now in early access
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Run your coworking space,
          <br />
          <span className="text-muted-foreground">not the software.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          White-label platform for bookings, memberships, and billing.
          Your brand, your space — powered by RogueOps.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#cta"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Request early access
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to manage your space
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One platform. Every tool. Fully white-labeled.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Building2 className="h-5 w-5" />}
            title="Multi-space management"
            description="Manage multiple locations from a single dashboard. Each space gets its own subdomain and branding."
          />
          <FeatureCard
            icon={<CreditCard className="h-5 w-5" />}
            title="Integrated billing"
            description="Stripe Connect handles payments, invoices, and payouts per tenant. Members self-serve their subscriptions."
          />
          <FeatureCard
            icon={<Globe className="h-5 w-5" />}
            title="White-label ready"
            description="Custom domains, logos, colors, and emails. Your members never see the RogueOps brand."
          />
          <FeatureCard
            icon={<Smartphone className="h-5 w-5" />}
            title="Mobile app"
            description="Branded mobile experience for members — door access, bookings, and community, all in their pocket."
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="Real-time bookings"
            description="Desks, meeting rooms, and event spaces. Instant availability with conflict-free scheduling."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5" />}
            title="Secure by default"
            description="Row-level security, magic-link auth, and isolated tenant data. Built on Supabase with zero shared state."
          />
        </div>
      </section>

      {/* Pricing placeholder */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            We&apos;re finalizing our plans. Join early access to lock in founder pricing.
          </p>
          <div className="mt-8 inline-block rounded-full border border-border/60 bg-muted/50 px-6 py-2 text-sm font-medium text-muted-foreground">
            Pricing coming soon
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="rounded-2xl bg-primary p-12 text-center text-primary-foreground">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to modernize your space?
          </h2>
          <p className="mt-4 text-lg opacity-80 max-w-xl mx-auto">
            Join the early access program and help shape the future of coworking management.
          </p>
          <div className="mt-8">
            <a
              href="mailto:hello@rogueops.app"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary-foreground/90"
            >
              Contact us
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="font-display text-sm font-semibold">RogueOps</span>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RogueOps. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 transition-shadow hover:shadow-lg">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
