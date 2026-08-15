"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/employees";

export function NewStaffForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    const loginId = (formData.get("login_id") as string)?.toUpperCase();
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        `Account created. Give this employee: ID "${loginId}" and the password you set.`
      );
      (document.getElementById("new-staff-form") as HTMLFormElement)?.reset();
    });
  }

  return (
    <section className="h-fit rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <h2 className="mb-4 font-display text-base font-semibold text-parchment">
        Add staff
      </h2>
      <form id="new-staff-form" action={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Full name
          </label>
          <input
            name="full_name"
            required
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Staff ID
          </label>
          <input
            name="login_id"
            required
            placeholder="e.g. ST001"
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
          />
          <p className="mt-1 text-xs text-parchment-dim">
            Letters, numbers, - or _. This is what they type to sign in.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Password
          </label>
          <input
            name="password"
            type="text"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
          />
          <p className="mt-1 text-xs text-parchment-dim">
            Tell them this password directly — it won&apos;t be shown again.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-parchment"
          >
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-parchment">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create staff account"}
        </button>
      </form>
    </section>
  );
}
