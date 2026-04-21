"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  "fade-up": "scroll-reveal-fade-up",
  "fade-left": "scroll-reveal-fade-left",
  "fade-right": "scroll-reveal-fade-right",
  "scale-in": "scroll-reveal-scale-in",
  "slide-up-stiff": "scroll-reveal-slide-up-stiff",
} as const;

type RevealVariant = keyof typeof VARIANT_CLASSES;

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  variant = "fade-up",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("revealed"), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn("scroll-reveal", VARIANT_CLASSES[variant], className)}
    >
      {children}
    </div>
  );
}
