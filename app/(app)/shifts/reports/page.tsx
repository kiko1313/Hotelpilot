import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SLOT_LABELS: Record<string, string> = {
  SHIFT_1: "08:00 – 16:00",
  SHIFT_2: "16:00 – 00:00",
  SHIFT_3: "00:00 – 08:00",
  CUSTOM: "Custom",
};

export default async function ShiftReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, slot, started_at, ended_at, status, closing_note, responsible_employee_id, employees:responsible_employee_id(full_name)")
    .eq("status", "CLOSED")
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Shift reports
        </h1>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-3">
          {(shifts ?? []).map((shift) => {
            const responsibleName = Array.isArray(shift.employees)
              ? (shift.employees[0] as { full_name?: string } | undefined)?.full_name
              : (shift.employees as { full_name?: string } | undefined)?.full_name;
            return (
              <div
                key={shift.id}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base text-parchment">
                    {SLOT_LABELS[shift.slot] ?? shift.slot}
                  </span>
                  <span className="text-xs text-parchment-dim">
                    {new Date(shift.started_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-parchment-dim">
                  {responsibleName ?? "—"} ·{" "}
                  {shift.ended_at
                    ? `closed ${new Date(shift.ended_at).toLocaleTimeString()}`
                    : "—"}
                </p>
                {shift.closing_note && (
                  <p className="mt-2 text-sm text-parchment">{shift.closing_note}</p>
                )}
              </div>
            );
          })}
          {(!shifts || shifts.length === 0) && (
            <p className="py-10 text-center text-sm text-parchment-dim">
              No closed shifts yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
