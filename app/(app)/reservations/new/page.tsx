import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createBooking } from "@/lib/actions/stays";
import { NewBookingForm } from "./form";

export default async function NewBookingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_number, price, status")
    .order("room_number");

  const { data: guests } = await supabase
    .from("guests")
    .select("id, full_name, phone")
    .order("full_name");

  async function action(formData: FormData) {
    "use server";
    const result = await createBooking(formData);
    if (result.ok) {
      redirect("/reservations");
    }
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
          action={action}
        />
      </div>
    </main>
  );
}
