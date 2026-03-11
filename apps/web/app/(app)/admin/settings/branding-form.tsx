"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brandingSchema, type BrandingFormValues } from "./schemas";
import { updateSpaceBranding } from "./actions";

interface BrandingFormProps {
  space: {
    name: string;
    slug: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
  };
}

export function BrandingForm({ space }: BrandingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slugConfirm, setSlugConfirm] = useState<BrandingFormValues | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      name: space.name,
      slug: space.slug,
      logoUrl: space.logo_url ?? "",
      faviconUrl: space.favicon_url ?? "",
      primaryColor: space.primary_color ?? "#000000",
      accentColor: space.accent_color ?? "#3b82f6",
    },
  });

  const primaryColor = watch("primaryColor");
  const accentColor = watch("accentColor");

  function submitBranding(data: BrandingFormValues) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSpaceBranding(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  function onSubmit(data: BrandingFormValues) {
    if (data.slug !== space.slug) {
      setSlugConfirm(data);
    } else {
      submitBranding(data);
    }
  }

  function confirmSlugChange() {
    if (slugConfirm) {
      submitBranding(slugConfirm);
      setSlugConfirm(null);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {serverError}
          </p>
        )}
        {success && !serverError && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Branding updated.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Space name</Label>
            <Input id="brand-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-slug">Slug</Label>
            <Input id="brand-slug" {...register("slug")} />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            <p className="text-xs text-muted-foreground">Changing the slug changes your workspace URL.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-logo">Logo URL</Label>
            <Input id="brand-logo" {...register("logoUrl")} placeholder="https://..." />
            {errors.logoUrl && <p className="text-xs text-destructive">{errors.logoUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-favicon">Favicon URL</Label>
            <Input id="brand-favicon" {...register("faviconUrl")} placeholder="https://..." />
            {errors.faviconUrl && <p className="text-xs text-destructive">{errors.faviconUrl.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-primary">Primary color</Label>
            <div className="flex gap-2">
              <Input
                id="brand-primary"
                type="color"
                value={primaryColor}
                onChange={(e) => setValue("primaryColor", e.target.value, { shouldValidate: true })}
                className="h-10 w-14 p-1"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setValue("primaryColor", e.target.value, { shouldValidate: true })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
            {errors.primaryColor && <p className="text-xs text-destructive">{errors.primaryColor.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-accent">Accent color</Label>
            <div className="flex gap-2">
              <Input
                id="brand-accent"
                type="color"
                value={accentColor}
                onChange={(e) => setValue("accentColor", e.target.value, { shouldValidate: true })}
                className="h-10 w-14 p-1"
              />
              <Input
                value={accentColor}
                onChange={(e) => setValue("accentColor", e.target.value, { shouldValidate: true })}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
            {errors.accentColor && <p className="text-xs text-destructive">{errors.accentColor.message}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Branding"}
          </Button>
        </div>
      </form>

      {/* Slug change confirmation */}
      <AlertDialog open={!!slugConfirm} onOpenChange={(open) => { if (!open) setSlugConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change workspace URL?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the slug will change your workspace URL from{" "}
              <strong>{space.slug}.cowork.app</strong> to{" "}
              <strong>{slugConfirm?.slug}.cowork.app</strong>.
              Members will need to use the new URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={confirmSlugChange}>
              Change URL
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
