"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/image-upload";
import { personalProfileSchema, type PersonalProfileValues } from "./schemas";
import { updatePersonalProfile } from "./actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Espa\u00f1ol" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Fran\u00e7ais" },
  { value: "pt", label: "Portugu\u00eas" },
  { value: "nl", label: "Nederlands" },
] as const;

interface PersonalFormProps {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    preferred_lang: string | null;
  };
}

export function PersonalForm({ profile }: PersonalFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PersonalProfileValues>({
    resolver: zodResolver(personalProfileSchema),
    defaultValues: {
      fullName: profile.full_name ?? null,
      phone: profile.phone ?? null,
      avatarUrl: profile.avatar_url ?? null,
      preferredLang: (profile.preferred_lang as PersonalProfileValues["preferredLang"]) ?? "en",
    },
  });

  function onSubmit(data: PersonalProfileValues) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updatePersonalProfile(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  const watchLang = watch("preferredLang");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && !serverError && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Profile updated.
        </p>
      )}

      <div className="space-y-1.5">
        <Label>Avatar</Label>
        <ImageUpload
          currentUrl={watch("avatarUrl") || null}
          spaceId={profile.id}
          bucket="user-avatars"
          pathPrefix="avatar"
          maxSizeMb={2}
          maxWidth={512}
          maxHeight={512}
          label="Avatar"
          previewClassName="h-16 w-16 rounded-full"
          onUploaded={(url) => setValue("avatarUrl", url, { shouldDirty: true })}
          onCleared={() => setValue("avatarUrl", "", { shouldDirty: true })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={profile.email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-fullName">Full name</Label>
          <Input id="profile-fullName" {...register("fullName")} placeholder="Jane Doe" />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input id="profile-phone" {...register("phone")} placeholder="+34 600 000 000" />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select
            value={watchLang}
            onValueChange={(v) => {
              if (v) setValue("preferredLang", v as PersonalProfileValues["preferredLang"]);
            }}
            items={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
          >
            <SelectTrigger>
              <SelectValue>
                {LANGUAGES.find((l) => l.value === watchLang)?.label ?? "English"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
