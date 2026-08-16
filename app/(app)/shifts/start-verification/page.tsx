import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { verifyRoom } from "@/lib/actions/shifts";

export default async function StartVerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: openShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("status", "OPEN")
    .maybeSingle();

  if (!openShift) redirect("/shifts");

  const { data: availableRooms } = await supabase
    .from("rooms")
    .select("id, room_number")
    .eq("status", "AVAILABLE")
    .order("room_number");

  const { data: alreadyChecked } = await supabase
    .from("shift_room_checks")
    .select("room_id")
    .eq("shift_id", openShift.id);

  const checkedIds = new Set((alreadyChecked ?? []).map((c) => c.room_id));
  const pending = (availableRooms ?? []).filter((r) => !checkedIds.has(r.id));
  const done = (availableRooms ?? []).filter((r) => checkedIds.has(r.id));

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Start shift verification
        </h1>
        <p className="text-xs text-parchment-dim">
          Only rooms marked empty need a physical check — no need to disturb occupied guests.
        </p>
      </header>

      <div className="px-6 py-8">
        {pending.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-ok/40 bg-ok/10 p-6 text-center">
            <p className="text-sm text-parchment">
              All empty rooms verified for this shift.
            </p>
          </div>
        ) : (
          <ul className="mx-auto max-w-md space-y-3">
            {pending.map((room) => (
              <li
                key={room.id}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
              >
                <p className="mb-3 font-display text-base text-parchment">
                  Room {room.room_number}
                </p>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      const fd = new FormData();
                      fd.set("shift_id", openShift.id);
                      fd.set("room_id", room.id);
                      fd.set("reported_status", "AVAILABLE");
                      await verifyRoom(fd);
                    }}
                    className="flex-1"
                  >
                    <button className="w-full rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok transition-colors hover:bg-ok/25">
                      ✓ Confirm empty
                    </button>
                  </form>
                  <DiscrepancyForm shiftId={openShift.id} roomId={room.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <div className="mx-auto mt-6 max-w-md">
            <p className="mb-2 text-xs text-parchment-dim">Already verified:</p>
            <ul className="flex flex-wrap gap-2">
              {done.map((r) => (
                <li
                  key={r.id}
                  className="rounded-full bg-ink-800 px-2.5 py-1 text-xs text-parchment-dim"
                >
                  Room {r.room_number}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

function DiscrepancyForm({ shiftId, roomId }: { shiftId: string; roomId: string }) {
  async function action(formData: FormData) {
    "use server";
    formData.set("shift_id", shiftId);
    formData.set("room_id", roomId);
    formData.set("reported_status", "OCCUPIED");
    await verifyRoom(formData);
  }

  return (
    <form action={action} className="flex-1">
      <button
        formAction={action}
        className="w-full rounded-lg bg-danger/15 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/25"
      >
        ⚠ Report discrepancy
      </button>
    </form>
  );
}
