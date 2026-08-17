import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { currencySymbol } from "@/lib/currency";

export default async function PaymentsPage() {
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

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, paid_at, note, stay_id, stays(guest_id, room_id, guests(full_name), rooms(room_number)), employees(full_name, login_id)"
    )
    .order("paid_at", { ascending: false })
    .limit(200);

  const total = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Payments
        </h1>
        <p className="text-xs text-parchment-dim">
          {payments?.length ?? 0} payments · {symbol}{total.toFixed(2)} total shown
        </p>
      </header>

      <div className="px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Recorded by</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(payments ?? []).map((p) => {
                const stay = Array.isArray(p.stays) ? p.stays[0] : p.stays;
                const guest = stay && (Array.isArray(stay.guests) ? stay.guests[0] : stay.guests);
                const room = stay && (Array.isArray(stay.rooms) ? stay.rooms[0] : stay.rooms);
                const emp = Array.isArray(p.employees) ? p.employees[0] : p.employees;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-parchment-dim">
                      {new Date(p.paid_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-parchment">
                      {(guest as { full_name?: string })?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-parchment-dim">
                      {(room as { room_number?: string })?.room_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-ok">{symbol}{p.amount}</td>
                    <td className="px-4 py-3 text-parchment-dim">
                      {(emp as { full_name?: string })?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-parchment-dim">{p.note ?? "—"}</td>
                  </tr>
                );
              })}
              {(!payments || payments.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-parchment-dim">
                    No payments recorded yet.
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
