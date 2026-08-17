import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createBooking, type ActionResult } from "@/lib/actions/stays";
import { NewBookingForm } from "./form";

export default async function NewBookingPage() {
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

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, price, status")
    .order("room_number");

  const { data: guests } = await supabase
    .from("guests")
    .select("id, full_name, phone")
    .order("full_name");

  async function action(
    _prevState: ActionResult | null,
    formData: FormData
  ): Promise<ActionResult> {
    "use server";
    const result = await createBooking(formData);
    if (result.ok) {
      redirect("/reservations");
    }
    return result;
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          New booking
        </h1>
      </header>

      <div className="px-6 py-8">
        <NewBookingForm
          rooms={rooms ?? []}
          guests={guests ?? []}
          currency={hotel?.default_currency ?? "DZD"}
          action={action}
        />
      </div>
    </main>
  );
}
