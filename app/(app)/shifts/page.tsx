import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { closeShift } from "@/lib/actions/shifts";

export default async function CurrentShiftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: openShift } = await supabase
    .from("shifts")
    .select("id, slot, started_at")
    .eq("status", "OPEN")
    .maybeSingle();

  if (!openShift) redirect("/shifts");

  const since = openShift.started_at;

  const [{ data: checkIns }, { data: checkOuts }, { data: payments }, { data: extensions }, { data: discrepancies }] =
    await Promise.all([
      supabase.from("stays").select("id, check_in_at").eq("status", "ACTIVE").gte("check_in_at", since),
      supabase.from("stays").select("id, checked_out_at").eq("status", "CHECKED_OUT").gte("checked_out_at", since),
      supabase.from("payments").select("id, amount").gte("paid_at", since),
      supabase.from("checkout_changes").select("id").gte("created_at", since),
      supabase.from("shift_room_checks").select("id").eq("shift_id", openShift.id).eq("is_discrepancy", true),
    ]);

  const totalPayments = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Current shift activity
        </h1>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-4">
          <SummaryCard label="Check-ins" value={checkIns?.length ?? 0} />
          <SummaryCard label="Check-outs" value={checkOuts?.length ?? 0} />
          <SummaryCard label="Payments" value={`€${totalPayments.toFixed(2)}`} />
          <SummaryCard label="Checkout extensions" value={extensions?.length ?? 0} />
          <SummaryCard
            label="Discrepancies"
            value={discrepancies?.length ?? 0}
            accent={discrepancies && discrepancies.length > 0 ? "danger" : "ok"}
          />
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            formData.set("shift_id", openShift.id);
            const result = await closeShift(formData);
            if (result.ok) redirect("/shifts");
          }}
          className="mx-auto mt-8 max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6"
        >
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Closing note (optional)
          </label>
          <textarea
            name="closing_note"
            rows={2}
            className="mb-4 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
          />
          <p className="mb-3 text-xs text-parchment-dim">
            I confirm that I reviewed the shift activity and reported any discrepancies.
          </p>
          <button className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright">
            Close shift
          </button>
        </form>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "ok" | "danger";
}) {
  const color = accent === "danger" ? "text-danger" : accent === "ok" ? "text-ok" : "text-parchment";
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <div className="text-xs font-medium text-parchment-dim">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
