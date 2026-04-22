"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";

const checkoutFormSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

interface CheckoutFormProps {
  type: "daypass" | "membership";
  planSlug?: string;
  communityRulesText?: string | null;
}

export function CheckoutForm({ type, planSlug, communityRulesText }: CheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const hasRules = !!communityRulesText?.trim();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { email: "", name: "" },
  });

  async function onSubmit(data: CheckoutFormValues) {
    if (hasRules && !rulesAccepted) return;
    setIsSubmitting(true);
    setServerError(null);

    try {
      const spaceParam = new URLSearchParams(window.location.search).get("space");
      const apiUrl = `/api/checkout/session${spaceParam ? `?space=${spaceParam}` : ""}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          email: data.email,
          name: data.name || undefined,
          plan_slug: planSlug,
          community_rules_accepted: hasRules && rulesAccepted,
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
          // Response wasn't JSON — use default message
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}

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
        <Label htmlFor="name">Name (optional)</Label>
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
              checked={rulesAccepted}
              onCheckedChange={(checked) => setRulesAccepted(checked === true)}
            />
            <span className="text-sm">
              I accept the community rules and workspace etiquette
            </span>
          </label>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting || (hasRules && !rulesAccepted)}>
        {isSubmitting ? "Redirecting to payment..." : "Continue to payment"}
      </Button>
    </form>
  );
}
