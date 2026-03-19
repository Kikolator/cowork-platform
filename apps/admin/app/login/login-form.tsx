"use client";

import { useState } from "react";
import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await sendMagicLink(email);

    if (result?.error) {
      setError(result.error);
      setPending(false);
    } else {
      setSent(true);
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-6 text-center">
        <p className="text-sm font-medium text-green-200">
          Check your email
        </p>
        <p className="mt-2 text-sm text-green-300">
          We sent a magic link to{" "}
          <span className="font-medium">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground/80"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          placeholder="you@example.com"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}
