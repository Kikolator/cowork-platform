"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectCustomDomain,
  checkDomainStatus,
  disconnectCustomDomain,
} from "./actions";

interface DomainFormProps {
  customDomain: string | null;
  domainStatus: string | null;
}

export function DomainForm({ customDomain, domainStatus }: DomainFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState(domainStatus);
  const [currentDomain, setCurrentDomain] = useState(customDomain);
  const [configured, setConfigured] = useState(domainStatus === "active");

  function isApex(d: string) {
    return d.split(".").length === 2;
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await connectCustomDomain({ domain: domain.toLowerCase().trim() });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrentDomain(domain.toLowerCase().trim());
      setStatus(result.verified ? "active" : "pending");
      setConfigured(result.verified);
      setDomain("");
      setSuccess(result.verified ? "Domain connected and verified." : "Domain added. Configure your DNS records below.");
    });
  }

  function handleCheckStatus() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await checkDomainStatus();
      setStatus(result.status);
      setConfigured(result.configured);
      if (result.status === "active") {
        setSuccess("Domain verified and active.");
      } else {
        setSuccess("DNS not yet configured. Changes can take up to 48 hours to propagate.");
      }
    });
  }

  function handleDisconnect() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await disconnectCustomDomain();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrentDomain(null);
      setStatus(null);
      setConfigured(false);
      setSuccess("Domain disconnected.");
    });
  }

  // No domain configured
  if (!currentDomain) {
    return (
      <div className="space-y-6">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{success}</p>
        )}

        <div className="rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium">Custom Domain</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect your own domain so members access your space at your URL instead of a rogueops.app subdomain.
          </p>

          <form onSubmit={handleConnect} className="mt-4 flex gap-3">
            <div className="flex-1">
              <Label htmlFor="domain" className="sr-only">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="cowork.example.com"
                className="max-w-sm"
              />
            </div>
            <Button type="submit" disabled={isPending || !domain.trim()}>
              {isPending ? "Connecting..." : "Connect Domain"}
            </Button>
          </form>

          <p className="mt-3 text-xs text-muted-foreground">
            You&apos;ll need to configure a DNS record after connecting.
          </p>
        </div>
      </div>
    );
  }

  // Domain connected — pending or active
  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{success}</p>
      )}

      <div className="rounded-xl border border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium">Custom Domain</h3>
            <p className="mt-1 font-mono text-sm">{currentDomain}</p>
          </div>
          <div className="flex items-center gap-2">
            {status === "active" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Pending DNS
              </span>
            )}
          </div>
        </div>

        {status === "active" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Your domain is verified and serving traffic with automatic SSL.{" "}
            <a
              href={`https://${currentDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Visit site
            </a>
          </p>
        )}

        {status !== "active" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Configure the following DNS record at your domain registrar:
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {isApex(currentDomain) ? (
                    <tr>
                      <td className="px-3 py-2 font-mono">A</td>
                      <td className="px-3 py-2 font-mono">@</td>
                      <td className="px-3 py-2 font-mono">76.76.21.21</td>
                    </tr>
                  ) : (
                    <tr>
                      <td className="px-3 py-2 font-mono">CNAME</td>
                      <td className="px-3 py-2 font-mono">{currentDomain.split(".")[0]}</td>
                      <td className="px-3 py-2 font-mono">cname.vercel-dns.com</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              DNS changes can take up to 48 hours to propagate. SSL is provisioned automatically once DNS is verified.
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {status !== "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={isPending}
            >
              {isPending ? "Checking..." : "Check Status"}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={isPending}
          >
            {isPending ? "Removing..." : "Remove Domain"}
          </Button>
        </div>
      </div>
    </div>
  );
}
