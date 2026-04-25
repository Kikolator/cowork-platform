"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accessConfigSchema, type AccessConfigValues } from "./access-schemas";
import { updateAccessConfig, fetchNukiSmartlocks, triggerNukiSync } from "./access-actions";

const MODES = [
  { value: "manual", label: "Manual Codes", description: "Set shared codes per access level" },
  { value: "nuki", label: "Nuki Smart Lock", description: "Auto-generate individual keypad codes via Nuki API" },
] as const;

interface AccessFormProps {
  config: {
    enabled: boolean;
    mode: string;
    code_business_hours: string | null;
    code_extended: string | null;
    code_twenty_four_seven: string | null;
    nuki_api_token: string | null;
    nuki_smartlock_id: string | null;
    nuki_last_sync_at: string | null;
    nuki_sync_error: string | null;
    wifi_network: string | null;
    wifi_password: string | null;
  } | null;
}

export function AccessForm({ config }: AccessFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [smartlocks, setSmartlocks] = useState<{ id: string; name: string }[]>([]);
  const [isFetchingLocks, setIsFetchingLocks] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch } = useForm<AccessConfigValues>({
    resolver: zodResolver(accessConfigSchema),
    defaultValues: {
      enabled: config?.enabled ?? false,
      mode: (config?.mode as AccessConfigValues["mode"]) ?? "manual",
      codeBusinessHours: config?.code_business_hours ?? null,
      codeExtended: config?.code_extended ?? null,
      codeTwentyFourSeven: config?.code_twenty_four_seven ?? null,
      nukiApiToken: config?.nuki_api_token ?? null,
      nukiSmartlockId: config?.nuki_smartlock_id ?? null,
      wifiNetwork: config?.wifi_network ?? null,
      wifiPassword: config?.wifi_password ?? null,
    },
  });

  const watchEnabled = watch("enabled");
  const watchMode = watch("mode");
  const watchNukiToken = watch("nukiApiToken");
  const watchNukiSmartlockId = watch("nukiSmartlockId");

  async function handleFetchSmartlocks() {
    if (!watchNukiToken) return;
    setIsFetchingLocks(true);
    setLockError(null);
    const result = await fetchNukiSmartlocks(watchNukiToken);
    setIsFetchingLocks(false);
    if (result.success) {
      setSmartlocks(result.smartlocks);
    } else {
      setLockError(result.error);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    const result = await triggerNukiSync();
    setIsSyncing(false);
    if (result.success) {
      setSyncResult({ created: result.created, updated: result.updated, deleted: result.deleted, errors: result.errors });
    } else {
      setSyncResult({ created: 0, updated: 0, deleted: 0, errors: [result.error] });
    }
  }

  function onSubmit(data: AccessConfigValues) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateAccessConfig(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Access settings saved.
        </p>
      )}

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <Label className="text-sm font-medium">Enable Door Access Codes</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Show access codes to members based on their plan&apos;s access level.
          </p>
        </div>
        <Switch
          checked={watchEnabled}
          onCheckedChange={(checked) => setValue("enabled", checked === true)}
        />
      </div>

      {watchEnabled && (
        <>
          {/* Mode selector */}
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={watchMode}
              onValueChange={(v) => {
                if (v) setValue("mode", v as AccessConfigValues["mode"]);
              }}
              items={MODES.map((m) => ({ value: m.value, label: m.label }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div>
                      <span className="font-medium">{m.label}</span>
                      <span className="ml-2 text-muted-foreground">{m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {watchMode === "manual" && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                General Access Codes
              </h4>
              <p className="text-xs text-muted-foreground">
                Set one shared code per access level. All members with that access level will see this code.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="codeBusinessHours">Business Hours</Label>
                  <Input
                    id="codeBusinessHours"
                    {...register("codeBusinessHours")}
                    placeholder="e.g. 123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="codeExtended">Extended Hours</Label>
                  <Input
                    id="codeExtended"
                    {...register("codeExtended")}
                    placeholder="e.g. 234567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="codeTwentyFourSeven">24/7 Access</Label>
                  <Input
                    id="codeTwentyFourSeven"
                    {...register("codeTwentyFourSeven")}
                    placeholder="e.g. 345678"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can override codes for individual members in the Members section.
              </p>
            </div>
          )}

          {watchMode === "nuki" && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nuki Smart Lock Integration
              </h4>
              <p className="text-xs text-muted-foreground">
                Each member will automatically get their own keypad code with time restrictions matching their plan&apos;s access level.
                Codes are deactivated and deleted when subscriptions end.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nukiApiToken">API Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="nukiApiToken"
                      type="password"
                      {...register("nukiApiToken")}
                      placeholder="Nuki Web API token"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFetchSmartlocks}
                      disabled={!watchNukiToken || isFetchingLocks}
                    >
                      {isFetchingLocks ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                  {lockError && (
                    <p className="text-xs text-destructive">{lockError}</p>
                  )}
                </div>

                {smartlocks.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Smart Lock</Label>
                    <Select
                      value={watchNukiSmartlockId ?? ""}
                      onValueChange={(v) => { if (v) setValue("nukiSmartlockId", v); }}
                      items={smartlocks.map((l) => ({ value: l.id, label: l.name }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a smart lock" />
                      </SelectTrigger>
                      <SelectContent>
                        {smartlocks.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {watchNukiSmartlockId && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {isSyncing ? "Syncing..." : "Sync Codes Now"}
                    </Button>

                    {config?.nuki_last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(config.nuki_last_sync_at).toLocaleString()}
                      </p>
                    )}

                    {config?.nuki_sync_error && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {config.nuki_sync_error}
                      </p>
                    )}

                    {syncResult && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>
                            Sync complete: {syncResult.created} created, {syncResult.updated} updated, {syncResult.deleted} deleted
                          </span>
                        </div>
                        {syncResult.errors.length > 0 && (
                          <div className="mt-2 text-xs text-destructive">
                            {syncResult.errors.map((e, i) => (
                              <p key={i}>{e}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── WiFi ── */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          WiFi
        </h4>
        <p className="text-xs text-muted-foreground">
          Shown to pass holders and members in confirmation emails.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wifiNetwork">Network name</Label>
            <Input
              id="wifiNetwork"
              {...register("wifiNetwork")}
              placeholder="MySpace-WiFi"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wifiPassword">Password</Label>
            <Input
              id="wifiPassword"
              {...register("wifiPassword")}
              placeholder="wifi-password"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Access Settings"}
        </Button>
      </div>
    </form>
  );
}
