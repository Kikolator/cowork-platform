"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ShareCardProps {
  code: string;
  shareUrl: string;
  expiresAt: string | null;
  referredDiscountPercent: number;
  referredDiscountMonths: number;
}

export function ShareCard({
  code,
  shareUrl,
  expiresAt,
  referredDiscountPercent,
  referredDiscountMonths,
}: ShareCardProps) {
  const [copied, setCopied] = useState<"code" | "url" | null>(null);

  async function copyToClipboard(text: string, type: "code" | "url") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Your referral code</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="rounded-lg bg-muted px-6 py-3 font-mono text-2xl font-bold tracking-widest">
              {code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(code, "code")}
            >
              {copied === "code" ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {referredDiscountPercent > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            New members get {referredDiscountPercent}% off their first{" "}
            {referredDiscountMonths === 1
              ? "month"
              : `${referredDiscountMonths} months`}
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(shareUrl, "url")}
          >
            {copied === "url" ? (
              <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="mr-1 h-3.5 w-3.5" />
            )}
            Copy Link
          </Button>
        </div>

        {expiresAt && (
          <p className="text-center text-xs text-muted-foreground">
            Code expires {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
