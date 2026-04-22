"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import { DateAvailability } from "./date-availability";

const passCheckoutSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().optional(),
  startDate: z.string().min(1, "Please select a date"),
  communityRulesAccepted: z.boolean().optional(),
});

type PassCheckoutValues = z.infer<typeof passCheckoutSchema>;

interface PassCheckoutFormProps {
  productSlug: string;
  durationDays: number;
  communityRulesText: string | null;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function PassCheckoutForm({
  productSlug,
  durationDays,
  communityRulesText,
}: PassCheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    available: boolean;
    spots_left: number | null;
  } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const hasRules = !!communityRulesText?.trim();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PassCheckoutValues>({
    resolver: zodResolver(passCheckoutSchema),
    defaultValues: {
      email: "",
      name: "",
      startDate: getTodayString(),
      communityRulesAccepted: false,
    },
  });

  const watchDate = watch("startDate");
  const watchRulesAccepted = watch("communityRulesAccepted");

  // Check availability when date changes
  useEffect(() => {
    if (!watchDate) return;

    let cancelled = false;
    setCheckingAvailability(true);
    setAvailability(null);

    const spaceParam = new URLSearchParams(window.location.search).get("space");
    const params = new URLSearchParams({
      type: "product",
      product_slug: productSlug,
      date: watchDate,
    });
    if (spaceParam) params.set("space", spaceParam);

    fetch(`/api/checkout/availability?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setAvailability(data as { available: boolean; spots_left: number | null });
          setCheckingAvailability(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({ available: false, spots_left: null });
          setCheckingAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [watchDate, productSlug]);

  async function onSubmit(data: PassCheckoutValues) {
    if (hasRules && !data.communityRulesAccepted) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const spaceParam = new URLSearchParams(window.location.search).get("space");
      const apiUrl = `/api/checkout/session${spaceParam ? `?space=${spaceParam}` : ""}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "product",
          email: data.email,
          name: data.name || undefined,
          product_slug: productSlug,
          start_date: data.startDate,
          community_rules_accepted: hasRules && data.communityRulesAccepted,
        }),
      });

      if (!res.ok) {
        let errorMessage = "Something went wrong";
        try {
          const body = await res.json();
          if (body && typeof body === "object" && "error" in body) {
            errorMessage = String(body.error);
          }
        } catch {
          // Response wasn't JSON
        }
        setServerError(errorMessage);
        setIsSubmitting(false);
        return;
      }

      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch {
      setServerError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    !isSubmitting &&
    availability?.available &&
    !checkingAvailability &&
    (!hasRules || watchRulesAccepted);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="startDate">
          {durationDays === 1 ? "Date" : "Start Date"}
        </Label>
        <Input
          id="startDate"
          type="date"
          min={getTodayString()}
          {...register("startDate")}
        />
        {errors.startDate && (
          <p className="text-xs text-destructive">{errors.startDate.message}</p>
        )}
      </div>

      <DateAvailability
        checking={checkingAvailability}
        availability={availability}
      />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">
          Name{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          autoComplete="name"
          {...register("name")}
        />
      </div>

      {hasRules && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="text-sm font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
          >
            {rulesExpanded ? "Hide" : "View"} community rules
          </button>
          {rulesExpanded && (
            <div className="prose prose-sm dark:prose-invert max-h-48 max-w-none overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
              <ReactMarkdown>{communityRulesText!}</ReactMarkdown>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={watchRulesAccepted ?? false}
              onCheckedChange={(checked) =>
                setValue("communityRulesAccepted", checked === true)
              }
            />
            <span className="text-sm">
              I accept the community rules and workspace etiquette
            </span>
          </label>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isSubmitting ? "Redirecting to payment..." : "Continue to payment"}
      </Button>
    </form>
  );
}
