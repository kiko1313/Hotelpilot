"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireEmployee() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, hotel_id, role, status")
    .eq("id", user.id)
    .single();

  if (!employee || employee.status !== "active") {
    throw new Error("Account is not active.");
  }

  return { supabase, employee, userId: user.id };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// NEW BOOKING (reservation) — guest may be new or existing
// ---------------------------------------------------------------------------
export async function createBooking(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const guestId = formData.get("guest_id") as string | null;
    const newGuestName = (formData.get("new_guest_name") as string | null)?.trim();
    const newGuestPhone = (formData.get("new_guest_phone") as string | null)?.trim();
    const roomId = formData.get("room_id") as string;
    const arrivalAt = formData.get("arrival_at") as string;
    const checkoutAt = formData.get("checkout_at") as string;
    const numGuests = Number(formData.get("num_guests") ?? 1);
    const roomPrice = Number(formData.get("room_price"));
    const totalAmount = Number(formData.get("total_amount"));
    const deposit = Number(formData.get("deposit") ?? 0);
    const notes = (formData.get("notes") as string | null) ?? null;

    if (!roomId || !arrivalAt || !checkoutAt || !roomPrice || !totalAmount) {
      return { ok: false, error: "Please fill in all required fields." };
    }
    if (new Date(checkoutAt) <= new Date(arrivalAt)) {
      return { ok: false, error: "Checkout must be after arrival." };
    }

    let finalGuestId = guestId;

    if (!finalGuestId) {
      if (!newGuestName) {
        return { ok: false, error: "Enter a guest name or pick an existing guest." };
      }
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          hotel_id: employee.hotel_id,
          full_name: newGuestName,
          phone: newGuestPhone || null,
          created_by: employee.id,
        })
        .select("id")
        .single();
      if (guestError || !guest) {
        return { ok: false, error: "Could not create guest record." };
      }
      finalGuestId = guest.id;
    }

    const { data: stay, error: stayError } = await supabase
      .from("stays")
      .insert({
        hotel_id: employee.hotel_id,
        guest_id: finalGuestId,
        room_id: roomId,
        arrival_at: arrivalAt,
        original_checkout_at: checkoutAt,
        current_checkout_at: checkoutAt,
        num_guests: numGuests,
        room_price: roomPrice,
        total_amount: totalAmount,
        status: "RESERVED",
        created_by: employee.id,
        notes,
      })
      .select("id")
      .single();

    if (stayError || !stay) {
      return { ok: false, error: "Could not create booking." };
    }

    if (deposit > 0) {
      await supabase.from("payments").insert({
        hotel_id: employee.hotel_id,
        stay_id: stay.id,
        amount: deposit,
        employee_id: employee.id,
        note: "Deposit at booking",
      });
    }

    // Only mark the room RESERVED if the arrival is today or in the past
    // and the room is currently available — don't overwrite an occupied room.
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();
    if (room?.status === "AVAILABLE") {
      await supabase.from("rooms").update({ status: "RESERVED" }).eq("id", roomId);
    }

    await supabase.rpc("log_audit_event", {
      p_action: "BOOKING_CREATED",
      p_object_type: "stay",
      p_object_id: stay.id,
      p_new_value: { room_id: roomId, arrival_at: arrivalAt, total_amount: totalAmount },
    });

    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// CHECK-IN — converts a RESERVED stay (or creates a walk-in stay) into ACTIVE
// ---------------------------------------------------------------------------
export async function checkInStay(stayId: string): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const { data: stay } = await supabase
      .from("stays")
      .select("id, room_id, status")
      .eq("id", stayId)
      .single();

    if (!stay) return { ok: false, error: "Booking not found." };
    if (stay.status !== "RESERVED") {
      return { ok: false, error: "This booking isn't in a reserved state." };
    }

    const { error: updateError } = await supabase
      .from("stays")
      .update({ status: "ACTIVE", check_in_at: new Date().toISOString() })
      .eq("id", stayId);
    if (updateError) return { ok: false, error: "Could not check in." };

    await supabase.from("rooms").update({ status: "OCCUPIED" }).eq("id", stay.room_id);

    await supabase.rpc("log_audit_event", {
      p_action: "CHECK_IN",
      p_object_type: "stay",
      p_object_id: stayId,
      p_new_value: { employee_id: employee.id },
    });

    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------
export async function checkOutStay(stayId: string): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const { data: stay } = await supabase
      .from("stays")
      .select("id, room_id, status")
      .eq("id", stayId)
      .single();

    if (!stay) return { ok: false, error: "Stay not found." };
    if (stay.status !== "ACTIVE") {
      return { ok: false, error: "This stay isn't active." };
    }

    const { error: updateError } = await supabase
      .from("stays")
      .update({
        status: "CHECKED_OUT",
        checked_out_at: new Date().toISOString(),
        checked_out_by: employee.id,
      })
      .eq("id", stayId);
    if (updateError) return { ok: false, error: "Could not check out." };

    await supabase.from("rooms").update({ status: "AVAILABLE" }).eq("id", stay.room_id);

    await supabase.rpc("log_audit_event", {
      p_action: "CHECK_OUT",
      p_object_type: "stay",
      p_object_id: stayId,
      p_new_value: { employee_id: employee.id },
    });

    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// RECORD PAYMENT
// ---------------------------------------------------------------------------
export async function recordPayment(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const stayId = formData.get("stay_id") as string;
    const amount = Number(formData.get("amount"));
    const note = (formData.get("note") as string | null) ?? null;

    if (!stayId || !amount || amount <= 0) {
      return { ok: false, error: "Enter a valid payment amount." };
    }

    const { error } = await supabase.from("payments").insert({
      hotel_id: employee.hotel_id,
      stay_id: stayId,
      amount,
      employee_id: employee.id,
      note,
    });
    if (error) return { ok: false, error: "Could not record payment." };

    await supabase.rpc("log_audit_event", {
      p_action: "PAYMENT_RECORDED",
      p_object_type: "stay",
      p_object_id: stayId,
      p_new_value: { amount },
    });

    revalidatePath("/reservations");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// EXTEND CHECKOUT — never overwrites, always appends a change record
// ---------------------------------------------------------------------------
export async function extendCheckout(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const stayId = formData.get("stay_id") as string;
    const newCheckoutAt = formData.get("new_checkout_at") as string;
    const reason = (formData.get("reason") as string | null) ?? null;

    const { data: stay } = await supabase
      .from("stays")
      .select("id, current_checkout_at")
      .eq("id", stayId)
      .single();
    if (!stay) return { ok: false, error: "Stay not found." };

    if (new Date(newCheckoutAt) <= new Date(stay.current_checkout_at)) {
      return { ok: false, error: "New checkout must be later than the current one." };
    }

    const { error: changeError } = await supabase.from("checkout_changes").insert({
      stay_id: stayId,
      previous_checkout_at: stay.current_checkout_at,
      new_checkout_at: newCheckoutAt,
      employee_id: employee.id,
      reason,
    });
    if (changeError) return { ok: false, error: "Could not record extension." };

    await supabase
      .from("stays")
      .update({ current_checkout_at: newCheckoutAt })
      .eq("id", stayId);

    await supabase.rpc("log_audit_event", {
      p_action: "CHECKOUT_EXTENDED",
      p_object_type: "stay",
      p_object_id: stayId,
      p_previous_value: { checkout_at: stay.current_checkout_at },
      p_new_value: { checkout_at: newCheckoutAt },
      p_reason: reason,
    });

    revalidatePath("/reservations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
