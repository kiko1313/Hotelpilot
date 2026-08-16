"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireMasterAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: employee } = await supabase
    .from("employees")
    .select("hotel_id, role")
    .eq("id", user.id)
    .single();

  if (!employee || employee.role !== "master_admin") {
    throw new Error("Only the Master Admin can do this.");
  }
  return { supabase, employee };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateHotelSettings(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireMasterAdmin();

    const name = (formData.get("name") as string)?.trim();
    const timezone = (formData.get("timezone") as string)?.trim();
    const currency = (formData.get("default_currency") as string)?.trim().toUpperCase();
    const sessionTimeout = Number(formData.get("session_timeout_minutes"));

    if (!name) return { ok: false, error: "Hotel name is required." };

    const { error } = await supabase
      .from("hotels")
      .update({
        name,
        timezone: timezone || "UTC",
        default_currency: currency || "EUR",
        session_timeout_minutes: sessionTimeout || 15,
      })
      .eq("id", employee.hotel_id);

    if (error) return { ok: false, error: "Could not save settings." };

    revalidatePath("/admin/hotel-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function addPaymentMethod(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireMasterAdmin();
    const name = (formData.get("name") as string)?.trim();
    if (!name) return { ok: false, error: "Enter a payment method name." };

    const { error } = await supabase
      .from("payment_methods")
      .insert({ hotel_id: employee.hotel_id, name });
    if (error) return { ok: false, error: "Could not add payment method." };

    revalidatePath("/admin/pricing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function togglePaymentMethod(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireMasterAdmin();
    const { error } = await supabase.from("payment_methods").update({ active }).eq("id", id);
    if (error) return { ok: false, error: "Could not update." };
    revalidatePath("/admin/pricing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
