"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
            <span className="font-display text-lg text-brass-bright">01</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-parchment">
            HotelPilot AI
          </h1>
          <p className="mt-1 text-sm text-parchment-dim">
            Sign in with your staff ID
          </p>
        </div>

        <form
          action={handleSubmit}
          className="rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-xl shadow-black/30"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-sm font-medium text-parchment"
              >
                Staff ID
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                placeholder="e.g. ST001"
                autoComplete="username"
                className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-base text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
              />
              <p className="mt-1 text-xs text-parchment-dim">
                Master Admin: sign in with your email instead.
              </p>
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
                name="password"
                type="password"
                required
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
              disabled={isPending}
              className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright disabled:opacity-60"
            >
              {isPending ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-brass-bright hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-parchment-dim">
          Staff accounts are created by the hotel administrator.
          <br />
          There is no public sign-up — this keeps every action traceable
          to a real person.
        </p>
      </div>
    </main>
  );
}
