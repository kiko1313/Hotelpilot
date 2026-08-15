"use client";

import { useState, useTransition } from "react";
import { resetStaffPassword } from "@/lib/actions/employees";

export function ResetPasswordButton({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim"
      >
        Reset password
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        className="w-28 rounded-lg border border-ink-600 bg-ink-950 px-2 py-1 text-xs text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
      />
      <button
        disabled={isPending || password.length < 8}
        onClick={() => {
          const formData = new FormData();
          formData.set("employee_id", employeeId);
          formData.set("new_password", password);
          startTransition(async () => {
            const result = await resetStaffPassword(formData);
            setMessage(result.ok ? "Done" : result.error);
            if (result.ok) {
              setTimeout(() => {
                setOpen(false);
                setPassword("");
                setMessage(null);
              }, 1200);
            }
          });
        }}
        className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim disabled:opacity-50"
      >
        {isPending ? "…" : "Save"}
      </button>
      {message && <span className="text-xs text-parchment-dim">{message}</span>}
    </div>
  );
}
