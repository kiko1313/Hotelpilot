import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { currencySymbol } from "@/lib/currency";

export default async function RoomOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("hotel_id")
    .eq("id", user.id)
    .single();
  const { data: hotel } = await supabase
    .from("hotels")
    .select("default_currency")
    .eq("id", employee?.hotel_id)
    .single();
  const symbol = currencySymbol(hotel?.default_currency ?? "DZD");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, status, price")
    .order("room_number");

  const { data: stays } = await supabase
    .from("stays_with_details")
    .select("*")
    .in("status", ["ACTIVE", "RESERVED"]);

  const styles: Record<string, string> = {
    OCCUPIED: "border-ok/40 bg-ok/10",
    AVAILABLE: "border-ink-700 bg-ink-900",
    RESERVED: "border-warn/40 bg-warn/10",
  };
  const dot: Record<string, string> = {
    OCCUPIED: "bg-ok",
    AVAILABLE: "bg-brass-dim",
    RESERVED: "bg-warn",
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Room overview
        </h1>
      </header>

      <div className="px-6 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(rooms ?? []).map((room) => {
            const stay = (stays ?? []).find((s) => s.room_id === room.id);
            return (
              <div
                key={room.id}
                className={`rounded-2xl border p-4 ${styles[room.status] ?? "border-ink-700 bg-ink-900"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-xl text-parchment">
                    {room.room_number}
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${dot[room.status] ?? ""}`} />
                </div>
                <p className="text-xs text-parchment-dim">{room.status}</p>
                {stay && (
                  <p className="mt-1 truncate text-xs text-parchment">{stay.guest_name}</p>
                )}
                <p className="mt-2 text-xs text-parchment-dim">{symbol}{room.price}/night</p>
              </div>
            );
          })}
          {(!rooms || rooms.length === 0) && (
            <p className="col-span-full py-10 text-center text-sm text-parchment-dim">
              No rooms yet. Add rooms from Admin → Rooms.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
