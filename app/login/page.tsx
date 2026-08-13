"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("That email or password isn't right. Try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Signature: a numbered brass key tag, like a room key fob */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
            <span className="font-display text-lg text-brass-bright">01</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-parchment">
            HotelPilot AI
          </h1>
          <p className="mt-1 text-sm text-parchment-dim">
            Sign in with your staff account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-xl shadow-black/30"
        >
          <div className="space-y-4">
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

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-parchment"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-parchment-dim">
          Accounts are created by the hotel administrator.
          <br />
          There is no public sign-up — this keeps every action traceable
          to a real person.
        </p>
      </div>
    </main>
  );
}
