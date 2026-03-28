"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ResendButtonProps {
  sessionId: string;
}

export function ResendButton({ sessionId }: ResendButtonProps) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    setStatus("sending");
    try {
      const res = await fetch("/api/checkout/resend-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (res.status === 429) {
        setStatus("idle");
        setCooldown(60);
        return;
      }

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setStatus("sent");
      setCooldown(60);
    } catch {
      setStatus("error");
    }
  }, [sessionId]);

  const isDisabled = status === "sending" || cooldown > 0;

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        disabled={isDisabled}
        onClick={handleResend}
      >
        {status === "sending"
          ? "Sending..."
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend magic link"}
      </Button>
      {status === "sent" && (
        <p className="text-center text-sm text-green-600">
          Magic link sent! Check your inbox.
        </p>
      )}
      {status === "error" && (
        <p className="text-center text-sm text-destructive">
          Failed to resend. Please try again.
        </p>
      )}
    </div>
  );
}
