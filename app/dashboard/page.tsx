import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("full_name, role, hotel_id")
    .eq("id", user.id)
    .single();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, status")
    .order("room_number");

  const occupied = rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
  const available = rooms?.filter((r) => r.status === "AVAILABLE").length ?? 0;

  return (
    <main className="min-h-screen bg-ink-950">
      <header className="border-b border-ink-700 bg-ink-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
              <span className="font-display text-sm text-brass-bright">01</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-parchment">
                HotelPilot AI
              </h1>
              <p className="text-xs text-parchment-dim">
                {employee?.full_name ?? user.email}
                {employee?.role === "master_admin" ? " · Master Admin" : " · Staff"}
              </p>
            </div>
          </div>
          <form action="/auth/logout" method="post">
            <button className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-parchment-dim transition-colors hover:border-brass-dim hover:text-parchment">
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Occupied" value={occupied} accent="ok" />
          <StatCard label="Available" value={available} accent="brass" />
          <StatCard label="Check-ins today" value="—" accent="neutral" />
          <StatCard label="Check-outs today" value="—" accent="neutral" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-5 py-3 text-sm font-medium text-parchment-dim">
            Rooms
          </div>
          <ul className="divide-y divide-ink-800">
            {(rooms ?? []).map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <span className="font-display text-base text-parchment">
                  Room {room.room_number}
                </span>
                <span
                  className={
                    room.status === "OCCUPIED"
                      ? "rounded-full bg-ok/15 px-2.5 py-1 text-xs font-medium text-ok"
                      : "rounded-full bg-brass/15 px-2.5 py-1 text-xs font-medium text-brass-bright"
                  }
                >
                  {room.status === "OCCUPIED" ? "Occupied" : "Available"}
                </span>
              </li>
            ))}
            {(!rooms || rooms.length === 0) && (
              <li className="px-5 py-10 text-center text-sm text-parchment-dim">
                No rooms yet. Add rooms from Admin → Rooms.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "ok" | "brass" | "neutral";
}) {
  const accentColor =
    accent === "ok"
      ? "text-ok"
      : accent === "brass"
      ? "text-brass-bright"
      : "text-parchment";

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <div className="text-xs font-medium text-parchment-dim">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${accentColor}`}>
        {value}
      </div>
    </div>
  );
}
