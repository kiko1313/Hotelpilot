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
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            🏨 HotelPilot AI
          </h1>
          <p className="text-sm text-slate-500">
            Welcome, {employee?.full_name ?? user.email}
            {employee?.role === "master_admin" ? " · Master Admin" : ""}
          </p>
        </div>
        <form action="/auth/logout" method="post">
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
            Log out
          </button>
        </form>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="OCCUPIED" value={occupied} />
        <StatCard label="AVAILABLE" value={available} />
        <StatCard label="TODAY'S CHECK-INS" value="—" />
        <StatCard label="TODAY'S CHECK-OUTS" value="—" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          Rooms
        </div>
        <ul className="divide-y divide-slate-100">
          {(rooms ?? []).map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-900">
                {room.room_number}
              </span>
              <span
                className={
                  room.status === "OCCUPIED"
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                }
              >
                {room.status}
              </span>
            </li>
          ))}
          {(!rooms || rooms.length === 0) && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              No rooms yet. Add rooms from Admin → Rooms.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
