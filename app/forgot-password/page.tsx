"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setLoading(false);

    if (!resetError) {
      setSent(true);
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
            <span className="font-display text-lg text-brass-bright">01</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-parchment">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-parchment-dim">
            We&apos;ll email you a link to choose a new one
          </p>
        </div>

        <div className="rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-xl shadow-black/30">
          {sent ? (
            <p className="text-sm text-parchment">
              If an account exists for <strong>{email}</strong>, a reset link
              has been sent. Check your inbox (and spam folder) and open it on
              this device.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-parchment"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-base text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-parchment"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-brass-bright hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
