import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { checkInStay, checkOutStay, recordPayment } from "@/lib/actions/stays";
import { currencySymbol } from "@/lib/currency";

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-warn/15 text-warn",
  ACTIVE: "bg-ok/15 text-ok",
  CHECKED_OUT: "bg-ink-700 text-parchment-dim",
  CANCELLED: "bg-danger/15 text-danger",
};

const PAYMENT_STYLES: Record<string, string> = {
  PAID: "text-ok",
  PARTIALLY_PAID: "text-warn",
  UNPAID: "text-danger",
};

export default async function ReservationsPage() {
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

  const { data: stays } = await supabase
    .from("stays_with_details")
    .select("*")
    .in("status", ["RESERVED", "ACTIVE"])
    .order("arrival_at", { ascending: true });

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Reservations
        </h1>
        <Link
          href="/reservations/new"
          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright"
        >
          + New booking
        </Link>
      </header>

      <div className="px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Arrival</th>
                <th className="px-4 py-3 font-medium">Departure</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(stays ?? []).map((stay) => (
                <tr key={stay.id}>
                  <td className="px-4 py-3 text-parchment">{stay.guest_name}</td>
                  <td className="px-4 py-3 text-parchment-dim">{stay.room_number}</td>
                  <td className="px-4 py-3 text-parchment-dim">
                    {new Date(stay.arrival_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-parchment-dim">
                    {new Date(stay.current_checkout_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-parchment">{symbol}{stay.total_amount}</td>
                  <td className="px-4 py-3 text-parchment">{symbol}{stay.amount_paid}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      PAYMENT_STYLES[stay.payment_status] ?? "text-parchment"
                    }`}
                  >
                    {symbol}{stay.balance}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[stay.status] ?? ""
                      }`}
                    >
                      {stay.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {stay.status === "RESERVED" && (
                        <form
                          action={async () => {
                            "use server";
                            await checkInStay(stay.id);
                          }}
                        >
                          <button className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim">
                            Check in
                          </button>
                        </form>
                      )}
                      {stay.status === "ACTIVE" && (
                        <form
                          action={async () => {
                            "use server";
                            await checkOutStay(stay.id);
                          }}
                        >
                          <button className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim">
                            Check out
                          </button>
                        </form>
                      )}
                      <PaymentQuickForm stayId={stay.id} symbol={symbol} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!stays || stays.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-parchment-dim">
                    No reservations yet.{" "}
                    <Link href="/reservations/new" className="text-brass-bright hover:underline">
                      Create the first booking
                    </Link>
                    .
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

function PaymentQuickForm({ stayId, symbol }: { stayId: string; symbol: string }) {
  async function action(formData: FormData) {
    "use server";
    formData.set("stay_id", stayId);
    await recordPayment(formData);
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input
        type="number"
        name="amount"
        step="0.01"
        min="0.01"
        placeholder={symbol}
        required
        className="w-16 rounded-lg border border-ink-600 bg-ink-950 px-2 py-1 text-xs text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
      />
      <button className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim">
        Pay
      </button>
    </form>
  );
}
