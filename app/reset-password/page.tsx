"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  // Supabase's email link logs the user into a short-lived "recovery"
  // session automatically when they land here. We just wait for that
  // session to be present before letting them submit a new password.
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    // Also check immediately in case the event already fired before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError("Couldn't update your password. Request a new reset link and try again.");
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
            <span className="font-display text-lg text-brass-bright">01</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-parchment">
            Choose a new password
          </h1>
        </div>

        <div className="rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-xl shadow-black/30">
          {done ? (
            <p className="text-sm text-ok">
              Password updated. Taking you to the dashboard…
            </p>
          ) : !sessionReady ? (
            <p className="text-sm text-parchment-dim">
              Verifying your reset link…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-parchment"
                >
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-base text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-parchment"
                >
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
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
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
