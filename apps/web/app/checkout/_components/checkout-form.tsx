"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const checkoutFormSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

interface CheckoutFormProps {
  type: "daypass" | "membership";
  planSlug?: string;
}

export function CheckoutForm({ type, planSlug }: CheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { email: "", name: "" },
  });

  async function onSubmit(data: CheckoutFormValues) {
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
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(
          (body as { error?: string }).error ?? "Something went wrong",
        );
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Redirecting to payment..." : "Continue to payment"}
      </Button>
    </form>
  );
}
