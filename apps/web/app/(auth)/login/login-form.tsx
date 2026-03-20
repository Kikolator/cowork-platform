"use client";

import { useState } from "react";
import { sendMagicLink } from "./actions";
import {
  signInWithDevPassword,
  signUpWithDevPassword,
} from "./dev-auth-actions";

const isDevAuth = process.env.NEXT_PUBLIC_APP_ENV === "development";

export function LoginForm({ spaceName }: { spaceName?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  async function handleDevSignIn() {
    setPending(true);
    setError(null);
    setMessage(null);

    const result = await signInWithDevPassword(email, password);

    if (result.error) {
      setError(result.error);
      setPending(false);
    } else if (result.redirectTo) {
      window.location.href = result.redirectTo;
    }
  }

  async function handleDevSignUp() {
    setPending(true);
    setError(null);
    setMessage(null);

    const result = await signUpWithDevPassword(email, password);

    if (result.error) {
      setError(result.error);
      setPending(false);
    } else if (result.message) {
      setMessage(result.message);
      setPending(false);
    } else if (result.redirectTo) {
      window.location.href = result.redirectTo;
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-6 text-center backdrop-blur-sm">
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          Check your email
        </p>
        <p className="mt-2 text-sm text-green-700 dark:text-green-300">
          We sent a magic link to{" "}
          <span className="font-medium">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {spaceName ? `Sign in to ${spaceName}` : "Start managing your space"}
        </p>
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
            className="mt-1 block w-full rounded-xl border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5"
            placeholder="you@example.com"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="text-sm text-green-600 dark:text-green-400">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {isDevAuth && (
        <div className="space-y-3 border-t border-dashed border-[var(--glass-border)] pt-4">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Dev only
          </p>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground/80"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5"
              placeholder="Password"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !email || !password}
              onClick={handleDevSignIn}
              className="flex-1 rounded-xl border border-[var(--glass-border)] bg-white/50 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:bg-white/80 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={pending || !email || !password}
              onClick={handleDevSignUp}
              className="flex-1 rounded-xl border border-dashed border-[var(--glass-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-white/50 disabled:opacity-50 dark:hover:bg-white/5"
            >
              Sign up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
