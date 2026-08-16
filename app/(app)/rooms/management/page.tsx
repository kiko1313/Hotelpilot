import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createRoom, updateRoomPrice } from "@/lib/actions/rooms";

export default async function RoomManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "master_admin") redirect("/dashboard");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, status, price")
    .order("room_number");

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Room management
        </h1>
      </header>

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Price / night</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(rooms ?? []).map((room) => (
                <tr key={room.id}>
                  <td className="px-4 py-3 font-display text-parchment">
                    Room {room.room_number}
                  </td>
                  <td className="px-4 py-3 text-parchment-dim">{room.status}</td>
                  <td className="px-4 py-3">
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        formData.set("room_id", room.id);
                        await updateRoomPrice(formData);
                      }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-parchment-dim">€</span>
                      <input
                        type="number"
                        name="price"
                        step="0.01"
                        defaultValue={room.price}
                        className="w-20 rounded-lg border border-ink-600 bg-ink-950 px-2 py-1 text-sm text-parchment focus:border-brass focus:outline-none"
                      />
                      <button className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!rooms || rooms.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-parchment-dim">
                    No rooms yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-parchment">
            Add room
          </h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createRoom(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-parchment">
                Room number
              </label>
              <input
                name="room_number"
                required
                className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-parchment">
                Price / night
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                required
                className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
              />
            </div>
            <button className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright">
              Add room
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
