import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { acceptHandover } from "@/lib/actions/shifts";

const SLOT_LABELS: Record<string, string> = {
  SHIFT_1: "08:00 – 16:00",
  SHIFT_2: "16:00 – 00:00",
  SHIFT_3: "00:00 – 08:00",
  CUSTOM: "Custom",
};

export default async function HandoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: openShift } = await supabase
    .from("shifts")
    .select("id, previous_shift_id, accepted_at")
    .eq("status", "OPEN")
    .maybeSingle();

  if (!openShift) redirect("/shifts");

  if (!openShift.previous_shift_id) {
    return (
      <main className="min-h-screen">
        <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
          <h1 className="font-display text-lg font-semibold text-parchment">Handover</h1>
        </header>
        <div className="px-6 py-16 text-center text-sm text-parchment-dim">
          This is the first shift on record — nothing to hand over from.
        </div>
      </main>
    );
  }

  const { data: prevShift } = await supabase
    .from("shifts")
    .select("id, slot, started_at, ended_at, closing_note, responsible_employee_id, employees:responsible_employee_id(full_name)")
    .eq("id", openShift.previous_shift_id)
    .single();

  const responsibleName = Array.isArray(prevShift?.employees)
    ? (prevShift?.employees[0] as { full_name?: string } | undefined)?.full_name
    : (prevShift?.employees as { full_name?: string } | undefined)?.full_name;

  const { data: discrepancies } = await supabase
    .from("shift_room_checks")
    .select("id, room_id, note, rooms(room_number)")
    .eq("shift_id", openShift.previous_shift_id)
    .eq("is_discrepancy", true);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">Handover</h1>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <p className="mb-1 font-display text-lg text-parchment">
            Previous shift: {SLOT_LABELS[prevShift?.slot ?? ""] ?? prevShift?.slot}
          </p>
          <p className="mb-4 text-xs text-parchment-dim">
            {responsibleName ?? "—"} ·{" "}
            {prevShift?.ended_at ? new Date(prevShift.ended_at).toLocaleString() : "not closed"}
          </p>

          {prevShift?.closing_note && (
            <div className="mb-4 rounded-lg border border-ink-600 bg-ink-950 p-3 text-sm text-parchment">
              {prevShift.closing_note}
            </div>
          )}

          {discrepancies && discrepancies.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3">
              <p className="mb-1 text-sm font-medium text-danger">
                {discrepancies.length} discrepancy report(s)
              </p>
              <ul className="space-y-1 text-xs text-parchment">
                {discrepancies.map((d) => {
                  const room = Array.isArray(d.rooms) ? d.rooms[0] : d.rooms;
                  return (
                    <li key={d.id}>
                      Room {room?.room_number}: {d.note ?? "no note"}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {openShift.accepted_at ? (
            <p className="text-sm text-ok">
              ✓ Accepted {new Date(openShift.accepted_at).toLocaleString()}
            </p>
          ) : (
            <form
              action={async () => {
                "use server";
                const fd = new FormData();
                fd.set("shift_id", openShift.id);
                await acceptHandover(fd);
              }}
            >
              <button className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright">
                Accept shift
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
