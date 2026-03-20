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
import { ImageUpload } from "@/components/image-upload";
import { brandingSchema, type BrandingFormValues } from "./schemas";
import { updateSpaceBranding } from "./actions";

interface BrandingFormProps {
  space: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    logo_dark_url: string | null;
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
      logoDarkUrl: space.logo_dark_url ?? "",
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
            <Label>Logo</Label>
            <ImageUpload
              currentUrl={watch("logoUrl") || null}
              spaceId={space.id}
              bucket="space-assets"
              pathPrefix="logo"
              maxSizeMb={2}
              maxWidth={512}
              maxHeight={512}
              label="Logo"
              previewClassName="h-16 w-auto"
              onUploaded={(url) => setValue("logoUrl", url, { shouldDirty: true })}
              onCleared={() => setValue("logoUrl", "", { shouldDirty: true })}
            />
            {errors.logoUrl && <p className="text-xs text-destructive">{errors.logoUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Dark Mode Logo</Label>
            <ImageUpload
              currentUrl={watch("logoDarkUrl") || null}
              spaceId={space.id}
              bucket="space-assets"
              pathPrefix="logo-dark"
              maxSizeMb={2}
              maxWidth={512}
              maxHeight={512}
              label="Dark Mode Logo"
              hint="Optional. Used when dark mode is active."
              previewClassName="h-16 w-auto"
              onUploaded={(url) => setValue("logoDarkUrl", url, { shouldDirty: true })}
              onCleared={() => setValue("logoDarkUrl", "", { shouldDirty: true })}
            />
            {errors.logoDarkUrl && <p className="text-xs text-destructive">{errors.logoDarkUrl.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Favicon</Label>
            <ImageUpload
              currentUrl={watch("faviconUrl") || null}
              spaceId={space.id}
              bucket="space-assets"
              pathPrefix="favicon"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
              maxSizeMb={1}
              maxWidth={256}
              maxHeight={256}
              label="Favicon"
              hint="PNG, JPG, WebP, SVG or ICO. Images are auto-resized to 256×256px."
              previewClassName="h-8 w-8"
              crop={{ aspect: 1, cropShape: "rect" }}
              onUploaded={(url) => setValue("faviconUrl", url, { shouldDirty: true })}
              onCleared={() => setValue("faviconUrl", "", { shouldDirty: true })}
            />
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
              <strong>{space.slug}.{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000"}</strong> to{" "}
              <strong>{slugConfirm?.slug}.{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000"}</strong>.
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
