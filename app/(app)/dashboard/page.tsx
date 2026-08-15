import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, status")
    .order("room_number");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { data: activeAndReservedStays } = await supabase
    .from("stays_with_details")
    .select("*")
    .in("status", ["ACTIVE", "RESERVED"]);

  const stays = activeAndReservedStays ?? [];

  const occupied = rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
  const available = rooms?.filter((r) => r.status === "AVAILABLE").length ?? 0;
  const reserved = rooms?.filter((r) => r.status === "RESERVED").length ?? 0;

  const arrivalsToday = stays.filter(
    (s) =>
      s.status === "RESERVED" &&
      new Date(s.arrival_at) >= todayStart &&
      new Date(s.arrival_at) < todayEnd
  ).length;

  const checkoutsToday = stays.filter(
    (s) =>
      s.status === "ACTIVE" &&
      new Date(s.current_checkout_at) >= todayStart &&
      new Date(s.current_checkout_at) < todayEnd
  ).length;

  const outstanding = stays.reduce((sum, s) => sum + Number(s.balance ?? 0), 0);

  const roomsWithStay = (rooms ?? []).map((room) => {
    const stay = stays.find((s) => s.room_id === room.id);
    return { ...room, stay };
  });

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Dashboard
        </h1>
        <p className="text-xs text-parchment-dim">
          {employee?.full_name ?? user.email}
          {employee?.role === "master_admin" ? " · 👑 Master Admin" : " · Staff"}
        </p>
      </header>

      <div className="px-6 py-8">
        <section className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Occupied" value={occupied} accent="ok" />
          <StatCard label="Available" value={available} accent="brass" />
          <StatCard label="Reserved" value={reserved} accent="warn" />
          <StatCard label="Arrivals today" value={arrivalsToday} accent="neutral" />
        </section>

        <section className="mb-8 grid grid-cols-2 gap-4">
          <StatCard label="Checkouts today" value={checkoutsToday} accent="neutral" />
          <StatCard
            label="Outstanding balance"
            value={`€${outstanding.toFixed(2)}`}
            accent={outstanding > 0 ? "danger" : "ok"}
          />
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-5 py-3 text-sm font-medium text-parchment-dim">
            Rooms
          </div>
          <ul className="divide-y divide-ink-800">
            {roomsWithStay.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div>
                  <span className="font-display text-base text-parchment">
                    Room {room.room_number}
                  </span>
                  {room.stay && (
                    <span className="ml-2 text-xs text-parchment-dim">
                      {room.stay.guest_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {room.stay?.status === "ACTIVE" && (
                    <span className="text-xs text-parchment-dim">
                      Checkout {new Date(room.stay.current_checkout_at).toLocaleDateString()}
                    </span>
                  )}
                  {room.stay?.status === "RESERVED" && (
                    <span className="text-xs text-parchment-dim">
                      Arrival {new Date(room.stay.arrival_at).toLocaleDateString()}
                    </span>
                  )}
                  <RoomStatusBadge status={room.status} />
                </div>
              </li>
            ))}
            {(!rooms || rooms.length === 0) && (
              <li className="px-5 py-10 text-center text-sm text-parchment-dim">
                No rooms yet. Add rooms from Admin → Rooms.
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            href="/reservations/new"
            className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright"
          >
            📅 New booking
          </Link>
          <Link
            href="/reservations"
            className="rounded-lg border border-ink-600 px-4 py-2.5 text-sm text-parchment transition-colors hover:border-brass-dim"
          >
            🔄 Check-in / Check-out
          </Link>
          <Link
            href="/payments"
            className="rounded-lg border border-ink-600 px-4 py-2.5 text-sm text-parchment transition-colors hover:border-brass-dim"
          >
            💳 Payments
          </Link>
          <Link
            href="/ai"
            className="rounded-lg border border-brass-dim px-4 py-2.5 text-sm text-brass-bright transition-colors hover:border-brass"
          >
            🤖 Ask HotelPilot AI
          </Link>
        </section>
      </div>
    </main>
  );
}

function RoomStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OCCUPIED: "bg-ok/15 text-ok",
    AVAILABLE: "bg-brass/15 text-brass-bright",
    RESERVED: "bg-warn/15 text-warn",
  };
  const labels: Record<string, string> = {
    OCCUPIED: "Occupied",
    AVAILABLE: "Available",
    RESERVED: "Reserved",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "ok" | "brass" | "warn" | "danger" | "neutral";
}) {
  const accentColor =
    accent === "ok"
      ? "text-ok"
      : accent === "brass"
      ? "text-brass-bright"
      : accent === "warn"
      ? "text-warn"
      : accent === "danger"
      ? "text-danger"
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
