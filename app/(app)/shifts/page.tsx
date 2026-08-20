import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { startShift, takeOverShift } from "@/lib/actions/shifts";

const SLOT_LABELS: Record<string, string> = {
  SHIFT_1: "08:00 – 16:00",
  SHIFT_2: "16:00 – 00:00",
  SHIFT_3: "00:00 – 08:00",
  CUSTOM: "Custom",
};

export default async function ShiftsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const { data: openShift } = await supabase
    .from("shifts")
    .select("id, slot, started_at, responsible_employee_id, employees:responsible_employee_id(full_name)")
    .eq("status", "OPEN")
    .maybeSingle();

  const responsibleName = Array.isArray(openShift?.employees)
    ? (openShift?.employees[0] as { full_name?: string } | undefined)?.full_name
    : (openShift?.employees as { full_name?: string } | undefined)?.full_name;

  async function startAction() {
    "use server";
    await startShift();
    redirect("/shifts/start-verification");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Shifts
        </h1>
      </header>

      <div className="px-6 py-8">
        {!openShift ? (
          <div className="mx-auto max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
            <p className="mb-4 text-sm text-parchment-dim">
              No shift is currently open.
            </p>
            <form action={startAction}>
              <button className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright">
                Start shift
              </button>
            </form>
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-ok" />
              <span className="text-sm font-medium text-parchment">Shift open</span>
            </div>
            <p className="mb-1 font-display text-lg text-parchment">
              {SLOT_LABELS[openShift.slot] ?? openShift.slot}
            </p>
            <p className="mb-4 text-xs text-parchment-dim">
              Responsible: {responsibleName ?? "—"} · started{" "}
              {new Date(openShift.started_at).toLocaleTimeString()}
            </p>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/shifts/start-verification"
                className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-parchment transition-colors hover:border-brass-dim"
              >
                Room verification
              </Link>
              <Link
                href="/shifts/current"
                className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-parchment transition-colors hover:border-brass-dim"
              >
                Current activity
              </Link>
              <Link
                href="/shifts/handover"
                className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-parchment transition-colors hover:border-brass-dim"
              >
                Handover
              </Link>
            </div>

            {me?.role === "master_admin" && me.id !== openShift.responsible_employee_id && (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  formData.set("shift_id", openShift.id);
                  await takeOverShift(formData);
                }}
                className="mt-4 border-t border-ink-700 pt-4"
              >
                <input
                  type="text"
                  name="reason"
                  placeholder="Reason for taking over (optional)"
                  className="mb-2 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-xs text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
                />
                <button className="w-full rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-medium text-warn transition-colors hover:bg-warn/20">
                  Take over this shift
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mx-auto mt-4 max-w-md text-center">
          <Link
            href="/shifts/reports"
            className="text-sm text-brass-bright hover:underline"
          >
            View past shift reports →
          </Link>
        </div>
      </div>
    </main>
  );
}
