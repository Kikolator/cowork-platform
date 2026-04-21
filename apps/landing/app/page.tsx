import {
  ArrowRight,
  Building2,
  Calendar,
  CreditCard,
  Github,
  Globe,
  Mail,
  Smartphone,
  Users,
} from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-bold tracking-tight">
            RogueOps
          </span>
          <a
            href="#action"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get early access
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </nav>
      </header>

      {/* ── Hero / WHY ── */}
      <section className="relative px-6 pt-24 pb-32 md:pt-36 md:pb-44">
        <GeoLayer>
          <GeoCircle className="top-12 -left-20 h-64 w-64 opacity-[0.06] geo-float" />
          <GeoCircle className="top-40 right-8 h-16 w-16 opacity-[0.1] geo-float-reverse" />
          <GeoRing className="top-24 right-1/4 h-40 w-40 opacity-[0.08] geo-spin-slow" />
          <GeoSquare className="-bottom-8 left-1/3 h-24 w-24 opacity-[0.05] rotate-12 geo-float" />
          <GeoDots className="bottom-16 right-12 opacity-[0.07] geo-pulse" />
          <GeoLine className="top-1/2 left-8 w-32 -rotate-45 opacity-[0.06]" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-6">
              Built by an operator, for operators
            </p>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              I started a coworking space to bring people together.
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl max-w-2xl">
              Then I spent all my time doing admin.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── The story ── */}
      <section className="relative px-6 py-24 md:py-32">
        <GeoLayer>
          <GeoCircle className="top-0 right-0 h-80 w-80 opacity-[0.04] geo-float-reverse" />
          <GeoSquare className="top-1/4 -left-12 h-20 w-20 opacity-[0.06] rotate-45 geo-float" />
          <GeoLine className="top-1/3 right-16 w-48 rotate-12 opacity-[0.05]" />
          <GeoCross className="bottom-1/4 left-1/4 h-12 w-12 opacity-[0.07] geo-pulse" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl space-y-12 md:space-y-16">
          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/80 md:text-xl">
              When I looked for management software, I had two choices.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/80 md:text-xl">
              Stitch together a dozen free tools — a Google Form here, a Stripe
              link there, a spreadsheet to track who&apos;s paid.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/80 md:text-xl">
              Or hand over hundreds a month to a SaaS company for bloated software
              built for 500-desk enterprise campuses. Half the features I&apos;d
              never use. The other half wouldn&apos;t work the way my space
              actually runs.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-xl leading-relaxed font-medium text-foreground md:text-2xl">
              Neither option let me do what I started this for:
              <br />
              <span className="font-display font-bold">
                be in the space, with the people.
              </span>
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/80 md:text-xl">
              I was doing admin instead of making introductions.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              So I built something simpler.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-border/60" />
      </div>

      {/* ── HOW ── */}
      <section className="relative px-6 py-24 md:py-32">
        <GeoLayer>
          <GeoRing className="-top-8 left-1/3 h-56 w-56 opacity-[0.05] geo-spin-slow" />
          <GeoCircle className="top-1/3 -right-16 h-32 w-32 opacity-[0.07] geo-float" />
          <GeoDots className="bottom-24 left-8 opacity-[0.06] geo-pulse" />
          <GeoSquare className="bottom-12 right-1/4 h-16 w-16 opacity-[0.04] -rotate-12 geo-float-reverse" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
              How
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One tool. Less admin.
              <br />
              More community.
            </h2>
          </ScrollReveal>

          <div className="mt-16 space-y-10">
            <HowItem delay={0}>
              <HowLabel>The origin</HowLabel>
              <HowTitle>Built by an operator.</HowTitle>
              <HowText>
                Every feature exists because I needed it running my own space.
                Nothing bloated. Nothing hypothetical.
              </HowText>
            </HowItem>

            <HowItem delay={80}>
              <HowLabel>Your identity</HowLabel>
              <HowTitle>Your brand, not ours.</HowTitle>
              <HowText>
                Your members see your name, your domain, your colors. RogueOps
                stays invisible.
              </HowText>
            </HowItem>

            <HowItem delay={160}>
              <HowLabel>Simplicity</HowLabel>
              <HowTitle>One tool, not ten.</HowTitle>
              <HowText>
                Bookings, members, plans, billing — one place. No integrations to
                maintain, no data scattered across apps.
              </HowText>
            </HowItem>

            <HowItem delay={240}>
              <HowLabel>Pricing</HowLabel>
              <HowTitle>No monthly fees.</HowTitle>
              <HowText>
                You only pay when you use automated billing. Small enough to
                invoice by hand? It&apos;s free.
              </HowText>
            </HowItem>

            <HowItem delay={320}>
              <HowLabel>Community</HowLabel>
              <HowTitle>Open source.</HowTitle>
              <HowText>
                The codebase is public. Use it, fork it, contribute to it. Built
                in the open, for the community.
              </HowText>
            </HowItem>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-border/60" />
      </div>

      {/* ── WHAT ── */}
      <section className="relative px-6 py-24 md:py-32">
        <GeoLayer>
          <GeoCircle className="top-16 -left-24 h-48 w-48 opacity-[0.05] geo-float-reverse" />
          <GeoLine className="top-1/4 right-0 w-40 -rotate-30 opacity-[0.04]" />
          <GeoRing className="bottom-0 right-1/3 h-36 w-36 opacity-[0.06] geo-spin-slow" />
          <GeoCross className="top-2/3 left-12 h-10 w-10 opacity-[0.05] geo-float" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
              What
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-grade software
              <br />
              for boutique spaces.
            </h2>
          </ScrollReveal>

          <div className="mt-16 grid gap-4 sm:grid-cols-2">
            <WhatCard
              icon={<Users className="h-5 w-5" />}
              title="Member management"
              text="Self-service onboarding. Member profiles. Access control."
              delay={0}
            />
            <WhatCard
              icon={<Calendar className="h-5 w-5" />}
              title="Bookings"
              text="Desks, rooms, and events with real-time availability."
              delay={80}
            />
            <WhatCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Billing"
              text="Flexible plans with automated Stripe invoicing."
              delay={160}
            />
            <WhatCard
              icon={<Smartphone className="h-5 w-5" />}
              title="Mobile app"
              text="Branded app for members. Bookings in their pocket."
              delay={240}
            />
            <WhatCard
              icon={<Globe className="h-5 w-5" />}
              title="White-label"
              text="Custom domains, colors, logos, and transactional emails."
              delay={320}
            />
            <WhatCard
              icon={<Building2 className="h-5 w-5" />}
              title="Multi-space"
              text="Ready when you grow. Each location, its own setup."
              delay={400}
            />
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-border/60" />
      </div>

      {/* ── ACTION ── */}
      <section id="action" className="relative px-6 py-24 md:py-32">
        <GeoLayer>
          <GeoCircle className="top-8 right-0 h-52 w-52 opacity-[0.04] geo-float" />
          <GeoSquare className="bottom-16 -left-8 h-28 w-28 opacity-[0.05] rotate-6 geo-float-reverse" />
          <GeoDots className="top-1/2 right-1/4 opacity-[0.06] geo-pulse" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Two ways in.
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <ScrollReveal delay={100}>
              <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-8 h-full flex flex-col">
                <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3">
                  Operators
                </p>
                <h3 className="font-display text-xl font-bold mb-3">
                  Run a coworking space?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  Join early access. Help shape the product. Lock in founder
                  pricing.
                </p>
                <a
                  href="mailto:hello@rogueops.app"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 self-start"
                >
                  <Mail className="h-4 w-4" />
                  Get in touch
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-8 h-full flex flex-col">
                <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3">
                  Developers
                </p>
                <h3 className="font-display text-xl font-bold mb-3">
                  Want to build something real?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  RogueOps is open source. Contribute, fork, or learn from the
                  codebase. PRs are welcome.
                </p>
                <a
                  href="https://github.com/rogueops"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent self-start"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="font-display text-sm font-semibold">RogueOps</span>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RogueOps. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── Geometric decoration components ─── */

function GeoLayer({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      {children}
    </div>
  );
}

function GeoCircle({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full bg-foreground/10 ${className ?? ""}`}
    />
  );
}

function GeoRing({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full border-2 border-foreground/10 ${className ?? ""}`}
    />
  );
}

function GeoSquare({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-lg bg-foreground/10 ${className ?? ""}`}
    />
  );
}

function GeoLine({ className }: { className?: string }) {
  return (
    <div
      className={`absolute h-px bg-foreground/10 ${className ?? ""}`}
    />
  );
}

function GeoDots({ className }: { className?: string }) {
  return (
    <div className={`absolute grid grid-cols-4 gap-3 ${className ?? ""}`}>
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="h-1 w-1 rounded-full bg-foreground/20"
        />
      ))}
    </div>
  );
}

function GeoCross({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      <div className="absolute top-1/2 left-0 h-px w-full bg-foreground/15" />
      <div className="absolute top-0 left-1/2 h-full w-px bg-foreground/15" />
    </div>
  );
}

/* ─── HOW section components ─── */

function HowItem({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <ScrollReveal delay={delay}>
      <div className="border-l-2 border-border/60 pl-6">{children}</div>
    </ScrollReveal>
  );
}

function HowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
      {children}
    </p>
  );
}

function HowTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-xl font-bold">{children}</h3>
  );
}

function HowText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-muted-foreground leading-relaxed">{children}</p>
  );
}

/* ─── WHAT section card ─── */

function WhatCard({
  icon,
  title,
  text,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  delay?: number;
}) {
  return (
    <ScrollReveal delay={delay}>
      <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 h-full">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {text}
        </p>
      </div>
    </ScrollReveal>
  );
}
