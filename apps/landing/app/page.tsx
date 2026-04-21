import Image from "next/image";
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
          <a href="/" className="flex items-center gap-2">
            <Image
              src="/ai-logo-light.svg"
              alt="RogueOps"
              width={24}
              height={24}
              className="dark:hidden"
            />
            <Image
              src="/ai-logo-dark.svg"
              alt="RogueOps"
              width={24}
              height={24}
              className="hidden dark:block"
            />
            <span className="font-display text-lg font-bold tracking-tight">
              <span className="text-[var(--rogue-accent)]">/</span>RogueOps
            </span>
          </a>
          <a
            href="#action"
            className="btn-rogue inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get early access
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </nav>
      </header>

      {/* ══════════════════════════════════════════
          HERO / WHY — bold, expansive, rogue identity
          ══════════════════════════════════════════ */}
      <section className="geo-tier-hero relative px-6 pt-24 pb-32 md:pt-36 md:pb-44">
        {/* Background: dot grid for blueprint feel */}
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" aria-hidden="true" />

        {/* Scanline overlay — subtle CRT texture */}
        <div className="pointer-events-none absolute inset-0 scanline-overlay opacity-40" aria-hidden="true" />

        <GeoLayer>
          {/* Far layer — large, blurred, low opacity */}
          <GeoCircle className="top-8 -left-28 h-72 w-72 opacity-[0.04] blur-sm geo-drift" />
          <GeoCircle className="bottom-0 -right-20 h-96 w-96 opacity-[0.03] blur-md geo-float-reverse" />

          {/* Broken ring — hero motif, incomplete */}
          <GeoBrokenRing className="top-16 -left-12 md:left-[8%] opacity-[0.08] geo-spin-slow" size={220} gap={75} />

          {/* Triangle cluster — 3 overlapping, prominent */}
          <TriangleCluster className="top-20 right-[8%] md:right-[15%]" />

          {/* Mid layer */}
          <GeoSquare className="-bottom-6 left-[30%] h-28 w-28 opacity-[0.05] rotate-12 geo-float" />
          <GeoTriangle className="bottom-20 right-[18%] opacity-[0.08] rotate-180 geo-float" size={32} />

          {/* Near layer — sharp, small, higher opacity */}
          <GeoDots className="bottom-24 right-12 opacity-[0.08] geo-pulse" />
          <GeoTriangle className="top-16 right-10 opacity-[0.10] rotate-90 geo-glitch" size={20} />
          <GeoLine className="top-[60%] left-6 w-36 -rotate-45 opacity-[0.07]" />

          {/* Diagonal accent lines */}
          <GeoAngleLine className="top-[20%] -left-4 w-64 rotate-[25deg] opacity-[0.04]" />
          <GeoAngleLine className="bottom-[15%] right-0 w-80 -rotate-[15deg] opacity-[0.03]" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <p className="hero-entrance hero-entrance-1 section-label text-muted-foreground mb-6">
            Built by an operator, for operators
          </p>

          <h1 className="hero-entrance hero-entrance-2 hero-glitch font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            I started a coworking space to bring <span className="mono-accent">people</span> together.
          </h1>

          <p className="hero-entrance hero-entrance-3 mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl max-w-2xl">
            Then I spent all my time doing admin.
            <span className="cursor-blink inline-block w-[2px] h-[1.1em] bg-[var(--rogue-accent)] align-text-bottom ml-1" />
          </p>
        </div>
      </section>

      {/* ── Angled divider ── */}
      <ScrollReveal className="divider-angled-wrap">
        <div className="divider-angled" aria-hidden="true" />
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          THE STORY — tension builds through geometry
          ══════════════════════════════════════════ */}
      <section className="geo-tier-story relative px-6 py-24 md:py-32">
        {/* Subtle line grid — structural, constrained */}
        <div className="pointer-events-none absolute inset-0 bg-line-grid opacity-30" aria-hidden="true" />

        <GeoLayer>
          {/* Far layer */}
          <GeoCircle className="top-0 -right-12 h-80 w-80 opacity-[0.03] blur-sm geo-float-reverse" />

          {/* Mid layer — tension shapes, angular */}
          <GeoTriangle className="top-[15%] -left-4 opacity-[0.06] rotate-[30deg] geo-drift" size={56} />
          <GeoTriangle className="top-[40%] right-12 opacity-[0.05] -rotate-[60deg] geo-float" size={36} />
          <GeoSquare className="top-[25%] -left-12 h-20 w-20 opacity-[0.05] rotate-45 geo-float" />
          <GeoLine className="top-[35%] right-8 w-48 rotate-12 opacity-[0.04]" />

          {/* Near layer — growing intensity */}
          <GeoCross className="bottom-[30%] left-[22%] h-14 w-14 opacity-[0.06] geo-pulse" />
          <GeoTriangle className="bottom-[20%] right-[25%] opacity-[0.08] rotate-[120deg] geo-glitch" size={24} />
          <GeoDots className="bottom-12 left-8 opacity-[0.05] geo-pulse" />
        </GeoLayer>

        {/* Vertical dashed line — terminal prompt aesthetic */}
        <div className="pointer-events-none absolute left-6 md:left-[calc(50%-24rem)] top-24 bottom-24 w-px border-l border-dashed border-foreground/8" aria-hidden="true" />

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
                be in the space, with the <span className="mono-accent">people</span>.
              </span>
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/80 md:text-xl">
              I was doing admin instead of making introductions.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="flex items-center gap-4">
              <GeoTriangleInline className="text-[var(--rogue-accent)] opacity-60" size={16} />
              <p className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                So I built something <span className="mono-accent">simpler</span>.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Angled divider (reversed) ── */}
      <ScrollReveal className="divider-angled-wrap">
        <div className="divider-angled-reverse" aria-hidden="true" />
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          HOW — structured, rhythmic, system diagram
          ══════════════════════════════════════════ */}
      <section className="geo-tier-how relative px-6 py-24 md:py-32">
        {/* Fine grid — precision, engineering */}
        <div className="pointer-events-none absolute inset-0 bg-fine-grid opacity-40" aria-hidden="true" />

        <GeoLayer>
          {/* Far layer */}
          <GeoRing className="-top-8 left-[30%] h-60 w-60 opacity-[0.04] blur-[1px] geo-spin-slow" />

          {/* Mid layer */}
          <GeoCircle className="top-[30%] -right-16 h-36 w-36 opacity-[0.05] geo-float" />
          <GeoTriangle className="top-[20%] left-8 opacity-[0.05] geo-drift" size={40} />
          <GeoTriangle className="bottom-[25%] right-16 opacity-[0.06] rotate-[240deg] geo-drift-diagonal" size={44} />

          {/* Near layer */}
          <GeoDots className="bottom-28 left-12 opacity-[0.06] geo-pulse" />
          <GeoCross className="top-[55%] right-[10%] h-8 w-8 opacity-[0.07] geo-glitch" />
          <GeoTriangle className="top-[70%] left-[5%] opacity-[0.08] rotate-[180deg] geo-scale-breathe" size={18} />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <p className="section-label text-muted-foreground mb-4">
              How
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One tool. Less <span className="mono-accent">admin</span>.
              <br />
              More community.
            </h2>
          </ScrollReveal>

          <div className="mt-16 space-y-8">
            <HowItem delay={0} index={0}>
              <HowLabel>The origin</HowLabel>
              <HowTitle>Built by an operator.</HowTitle>
              <HowText>
                Every feature exists because I needed it running my own space.
                Nothing bloated. Nothing hypothetical.
              </HowText>
            </HowItem>

            <HowItem delay={55} index={1} align="right">
              <HowLabel>Your identity</HowLabel>
              <HowTitle>Your brand, not ours.</HowTitle>
              <HowText>
                Your members see your name, your domain, your colors. RogueOps
                stays invisible.
              </HowText>
            </HowItem>

            <HowItem delay={110} index={2}>
              <HowLabel>Simplicity</HowLabel>
              <HowTitle>One tool, not ten.</HowTitle>
              <HowText>
                Bookings, members, plans, billing — one place. No integrations to
                maintain, no data scattered across apps.
              </HowText>
            </HowItem>

            <HowItem delay={165} index={3} align="right">
              <HowLabel>Pricing</HowLabel>
              <HowTitle>No monthly fees.</HowTitle>
              <HowText>
                You only pay when you use automated billing. Small enough to
                invoice by hand? It&apos;s free.
              </HowText>
            </HowItem>

            <HowItem delay={220} index={4}>
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

      {/* ── Angled divider ── */}
      <ScrollReveal className="divider-angled-wrap">
        <div className="divider-angled" aria-hidden="true" />
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          WHAT — terminal windows / blueprint specs
          ══════════════════════════════════════════ */}
      <section className="geo-tier-what relative px-6 py-24 md:py-32">
        {/* Diagonal hatch — technical drawing feel */}
        <div className="pointer-events-none absolute inset-0 bg-diagonal-hatch opacity-20" aria-hidden="true" />

        <GeoLayer>
          <GeoCircle className="top-20 -left-28 h-52 w-52 opacity-[0.04] blur-sm geo-float-reverse" />
          <GeoTriangle className="top-[15%] right-8 opacity-[0.05] rotate-[45deg] geo-drift" size={52} />
          <GeoBrokenRing className="bottom-8 right-[20%] opacity-[0.05] geo-spin-slow" size={120} gap={60} />
          <GeoTriangle className="bottom-[20%] left-4 opacity-[0.06] rotate-[210deg] geo-drift-diagonal" size={36} />
          <GeoCross className="top-[65%] left-16 h-10 w-10 opacity-[0.06] geo-float" />
          <GeoLine className="top-[28%] -right-4 w-44 -rotate-[20deg] opacity-[0.04]" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal>
            <p className="section-label text-muted-foreground mb-4">
              What
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-grade <span className="mono-accent">software</span>
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
              index={0}
            />
            <WhatCard
              icon={<Calendar className="h-5 w-5" />}
              title="Bookings"
              text="Desks, rooms, and events with real-time availability."
              delay={45}
              index={1}
            />
            <WhatCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Billing"
              text="Flexible plans with automated Stripe invoicing."
              delay={90}
              index={2}
            />
            <WhatCard
              icon={<Smartphone className="h-5 w-5" />}
              title="Mobile app"
              text="Branded app for members. Bookings in their pocket."
              delay={135}
              index={3}
            />
            <WhatCard
              icon={<Globe className="h-5 w-5" />}
              title="White-label"
              text="Custom domains, colors, logos, and transactional emails."
              delay={180}
              index={4}
            />
            <WhatCard
              icon={<Building2 className="h-5 w-5" />}
              title="Multi-space"
              text="Ready when you grow. Each location, its own setup."
              delay={225}
              index={5}
            />
          </div>
        </div>
      </section>

      {/* ── Angled divider (reversed) ── */}
      <ScrollReveal className="divider-angled-wrap">
        <div className="divider-angled-reverse" aria-hidden="true" />
      </ScrollReveal>

      {/* ══════════════════════════════════════════
          ACTION — geometry converges, ring closes
          ══════════════════════════════════════════ */}
      <section id="action" className="geo-tier-action relative px-6 py-24 md:py-32">
        {/* Dot grid — converging, resolved */}
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" aria-hidden="true" />

        <GeoLayer>
          {/* Converging triangles — resolution */}
          <GeoTriangle className="top-[10%] left-[10%] opacity-[0.06] rotate-[135deg] geo-drift" size={48} />
          <GeoTriangle className="top-[10%] right-[10%] opacity-[0.06] rotate-[225deg] geo-drift-diagonal" size={48} />
          <GeoTriangle className="bottom-[15%] left-[20%] opacity-[0.05] rotate-[45deg] geo-float" size={32} />
          <GeoTriangle className="bottom-[15%] right-[20%] opacity-[0.05] -rotate-[45deg] geo-float-reverse" size={32} />

          {/* Completed ring — the hero broken ring is now whole (animates closed on scroll) */}
          <GeoClosingRing className="top-[20%] right-[5%] md:right-[12%] opacity-[0.07]" size={180} />

          {/* Supporting elements */}
          <GeoCircle className="top-12 right-4 h-56 w-56 opacity-[0.03] blur-sm geo-float" />
          <GeoDots className="top-[48%] right-[22%] opacity-[0.06] geo-pulse" />
          <GeoCross className="bottom-[35%] left-[15%] h-12 w-12 opacity-[0.05] geo-scale-breathe" />
        </GeoLayer>

        <div className="relative mx-auto max-w-3xl">
          <ScrollReveal variant="slide-up-stiff">
            <div className="flex items-center gap-3 mb-2">
              <GeoTriangleInline className="text-[var(--rogue-accent)] opacity-50" size={14} />
              <GeoTriangleInline className="text-[var(--rogue-accent)] opacity-30" size={14} />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Two ways <span className="mono-accent">in</span>.
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <ScrollReveal delay={100} variant="slide-up-stiff">
              <div className="terminal-card bg-card p-8 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-[var(--rogue-accent)] opacity-60" />
                  <div className="h-2 w-2 rounded-full bg-foreground/10" />
                  <div className="h-2 w-2 rounded-full bg-foreground/10" />
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">operators.sh</span>
                </div>
                <p className="section-label text-muted-foreground mb-3 before:content-none">
                  Operators
                </p>
                <h3 className="font-display text-xl font-bold mb-3">
                  Run a coworking space?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  Join early access. Help shape the product. Lock in founder
                  pricing.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="mailto:hello@rogueops.app"
                    className="btn-rogue inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Mail className="h-4 w-4" />
                    Get in touch
                  </a>
                  <a
                    href="https://start.rogueops.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-rogue-outline inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Try the app
                  </a>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200} variant="slide-up-stiff">
              <div className="terminal-card bg-card p-8 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-foreground/10" />
                  <div className="h-2 w-2 rounded-full opacity-60" style={{ backgroundColor: "oklch(0.70 0.15 140 / 60%)" }} />
                  <div className="h-2 w-2 rounded-full bg-foreground/10" />
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">devs.sh</span>
                </div>
                <p className="section-label text-muted-foreground mb-3 before:content-none">
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
                  href="https://github.com/Kikolator/cowork-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-rogue-outline inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent self-start"
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
      <footer className="relative border-t border-border/40 bg-background/60 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 bg-fine-grid opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <a href="/" className="flex items-center gap-1.5">
            <Image
              src="/ai-logo-light.svg"
              alt="RogueOps"
              width={16}
              height={16}
              className="dark:hidden"
            />
            <Image
              src="/ai-logo-dark.svg"
              alt="RogueOps"
              width={16}
              height={16}
              className="hidden dark:block"
            />
            <span className="font-display text-sm font-semibold">
              <span className="text-[var(--rogue-accent)] opacity-60">/</span>RogueOps
            </span>
          </a>
          <p className="text-xs text-muted-foreground font-mono">
            &copy; {new Date().getFullYear()} RogueOps. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Geometric decoration components
   ═══════════════════════════════════════════ */

function GeoLayer({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      {children}
    </div>
  );
}

function GeoCircle({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full bg-foreground/10 ${className ?? ""}`} />
  );
}

function GeoRing({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full border-2 border-foreground/10 ${className ?? ""}`} />
  );
}

/** Broken ring — circle with a gap. gap=0 means closed/complete. */
function GeoBrokenRing({
  className,
  size = 120,
  gap = 70,
}: {
  className?: string;
  size?: number;
  gap?: number;
}) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const dashArray = gap === 0
    ? `${circumference}`
    : `${circumference - (circumference * gap) / 360} ${(circumference * gap) / 360}`;

  return (
    <div className={`absolute ${className ?? ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray={dashArray}
          className="text-foreground/15"
        />
      </svg>
    </div>
  );
}

/**
 * Closing ring — starts broken (like the hero ring) and animates to complete
 * when it enters the viewport. Uses ScrollReveal to trigger CSS animation.
 */
function GeoClosingRing({
  className,
  size = 180,
}: {
  className?: string;
  size?: number;
}) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  // Start with a 75-degree gap (matching hero), animate to closed
  const openDash = `${circumference - (circumference * 75) / 360} ${(circumference * 75) / 360}`;
  const closedDash = `${circumference}`;

  return (
    <div className={`absolute ${className ?? ""}`}>
      <ScrollReveal
        className="ring-close"
        variant="fade-up"
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          style={{
            // CSS custom properties for the keyframe animation
            "--ring-dash-open": openDash,
            "--ring-dash-closed": closedDash,
          } as React.CSSProperties}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={openDash}
            className="text-foreground/15"
          />
        </svg>
      </ScrollReveal>
    </div>
  );
}

function GeoSquare({ className }: { className?: string }) {
  return (
    <div className={`absolute bg-foreground/10 ${className ?? ""}`} />
  );
}

function GeoLine({ className }: { className?: string }) {
  return (
    <div className={`absolute h-px bg-foreground/10 ${className ?? ""}`} />
  );
}

/** Dashed angled line for diagonal accents */
function GeoAngleLine({ className }: { className?: string }) {
  return (
    <div
      className={`absolute h-px ${className ?? ""}`}
      style={{
        backgroundImage: "repeating-linear-gradient(90deg, var(--foreground) 0, var(--foreground) 6px, transparent 6px, transparent 12px)",
        opacity: "inherit",
      }}
    />
  );
}

function GeoDots({ className }: { className?: string }) {
  return (
    <div className={`absolute grid grid-cols-5 gap-2.5 ${className ?? ""}`}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="h-1 w-1 rounded-full bg-foreground/20" />
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

/** CSS triangle via clip-path */
function GeoTriangle({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={`absolute ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        backgroundColor: "currentColor",
        color: "var(--foreground)",
      }}
    />
  );
}

/** 3 overlapping triangles — hero brand cluster */
function TriangleCluster({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      <GeoTriangle className="top-0 left-0 opacity-[0.14] geo-drift" size={56} />
      <GeoTriangle className="top-3 left-5 opacity-[0.10] rotate-[15deg] geo-drift-diagonal" size={40} />
      <GeoTriangle className="-top-1 left-10 opacity-[0.07] -rotate-[10deg] geo-float" size={28} />
    </div>
  );
}

/** Inline triangle for use within text flow */
function GeoTriangleInline({
  className,
  size = 12,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={`inline-block shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        backgroundColor: "currentColor",
      }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════
   HOW section components — staggered layout
   ═══════════════════════════════════════════ */

function HowItem({
  children,
  delay = 0,
  index = 0,
  align = "left",
}: {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  align?: "left" | "right";
}) {
  return (
    <ScrollReveal delay={delay} variant={align === "right" ? "fade-right" : "fade-left"}>
      <div className={`relative border-l-2 border-border/60 pl-6 md:max-w-[85%] ${align === "right" ? "md:ml-auto md:border-l-0 md:border-r-2 md:pr-6 md:pl-0 md:text-right" : ""}`}>
        {/* Triangle bullet */}
        <div
          className={`absolute top-1 ${align === "right" ? "md:-right-[5px] md:left-auto -left-[5px]" : "-left-[5px]"}`}
          aria-hidden="true"
        >
          <span
            className="block"
            style={{
              width: 8,
              height: 8,
              clipPath: align === "right"
                ? "polygon(0% 50%, 100% 0%, 100% 100%)"
                : "polygon(100% 50%, 0% 0%, 0% 100%)",
              backgroundColor: "var(--rogue-accent)",
              opacity: 0.5,
            }}
          />
        </div>
        {/* Step index */}
        <span className={`font-mono text-[10px] text-muted-foreground/40 absolute top-0.5 ${align === "right" ? "md:-right-8 md:left-auto -left-8" : "-left-8"}`}>
          {String(index + 1).padStart(2, "0")}
        </span>
        {children}
      </div>
    </ScrollReveal>
  );
}

function HowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 mb-1">
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

/* ═══════════════════════════════════════════
   WHAT section card — terminal window style
   ═══════════════════════════════════════════ */

function WhatCard({
  icon,
  title,
  text,
  delay = 0,
  index = 0,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  delay?: number;
  index?: number;
}) {
  return (
    <ScrollReveal delay={delay} variant="scale-in">
      <div className="terminal-card bg-card p-6 h-full">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
          <span className="ml-auto font-mono text-[9px] text-muted-foreground/40 tracking-wider">
            {String(index).padStart(2, "0")}:{title.toLowerCase().replace(/\s+/g, "-")}
          </span>
        </div>
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center bg-primary/10 text-primary">
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
