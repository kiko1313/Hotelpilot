import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;

  let query = supabase
    .from("guests")
    .select("id, full_name, phone, email, created_at")
    .order("full_name");

  if (q) query = query.ilike("full_name", `%${q}%`);

  const { data: guests } = await query;

  const { data: stayCounts } = await supabase
    .from("stays")
    .select("guest_id");

  const countsByGuest = new Map<string, number>();
  (stayCounts ?? []).forEach((s) => {
    countsByGuest.set(s.guest_id, (countsByGuest.get(s.guest_id) ?? 0) + 1);
  });

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Guests
        </h1>
      </header>

      <div className="px-6 py-8">
        <form className="mb-4">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name…"
            className="w-full max-w-sm rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
          />
        </form>

        <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Stays</th>
                <th className="px-4 py-3 font-medium">Guest since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(guests ?? []).map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 text-parchment">{g.full_name}</td>
                  <td className="px-4 py-3 text-parchment-dim">{g.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-parchment-dim">{g.email ?? "—"}</td>
                  <td className="px-4 py-3 text-parchment-dim">
                    {countsByGuest.get(g.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-parchment-dim">
                    {new Date(g.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!guests || guests.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-parchment-dim">
                    No guests found. Guests are created automatically from bookings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
