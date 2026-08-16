import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updateHotelSettings } from "@/lib/actions/settings";

export default async function HotelSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("role, hotel_id")
    .eq("id", user.id)
    .single();
  if (me?.role !== "master_admin") redirect("/dashboard");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("name, timezone, default_currency, session_timeout_minutes")
    .eq("id", me.hotel_id)
    .single();

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Hotel settings
        </h1>
      </header>

      <div className="px-6 py-8">
        <form
          action={async (formData: FormData) => {
            "use server";
            await updateHotelSettings(formData);
          }}
          className="mx-auto max-w-md space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-6"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-parchment">
              Hotel name
            </label>
            <input
              name="name"
              defaultValue={hotel?.name ?? ""}
              required
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-parchment">
              Timezone
            </label>
            <input
              name="timezone"
              defaultValue={hotel?.timezone ?? "UTC"}
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-parchment">
              Currency code
            </label>
            <input
              name="default_currency"
              defaultValue={hotel?.default_currency ?? "EUR"}
              maxLength={3}
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-parchment">
              Auto-lock after inactivity (minutes)
            </label>
            <input
              type="number"
              name="session_timeout_minutes"
              defaultValue={hotel?.session_timeout_minutes ?? 15}
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
            />
          </div>
          <button className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright">
            Save settings
          </button>
        </form>
      </div>
    </main>
  );
}
