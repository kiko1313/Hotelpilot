import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addPaymentMethod, togglePaymentMethod } from "@/lib/actions/settings";

export default async function PricingPage() {
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

  const { data: methods } = await supabase
    .from("payment_methods")
    .select("id, name, active")
    .order("name");

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Payments / prices
        </h1>
        <p className="text-xs text-parchment-dim">
          Room prices are managed per-room under Rooms → Management.
        </p>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="mb-4 font-display text-base font-semibold text-parchment">
            Payment methods
          </h2>
          <ul className="mb-4 space-y-2">
            {(methods ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2"
              >
                <span className="text-sm text-parchment">{m.name}</span>
                <form
                  action={async () => {
                    "use server";
                    await togglePaymentMethod(m.id, !m.active);
                  }}
                >
                  <button
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      m.active ? "bg-ok/15 text-ok" : "bg-ink-700 text-parchment-dim"
                    }`}
                  >
                    {m.active ? "Active" : "Disabled"}
                  </button>
                </form>
              </li>
            ))}
            {(!methods || methods.length === 0) && (
              <li className="text-center text-sm text-parchment-dim">
                No payment methods yet.
              </li>
            )}
          </ul>

          <form
            action={async (formData: FormData) => {
              "use server";
              await addPaymentMethod(formData);
            }}
            className="flex gap-2"
          >
            <input
              name="name"
              placeholder="e.g. Cash, Card, Bank transfer"
              required
              className="flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
            />
            <button className="rounded-lg border border-ink-600 px-3 py-2 text-sm text-parchment transition-colors hover:border-brass-dim">
              Add
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
