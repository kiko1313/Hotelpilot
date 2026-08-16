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
    .select("id, hotel_id, role")
    .eq("id", user.id)
    .single();

  if (!employee || employee.role !== "master_admin") {
    throw new Error("Only the Master Admin can do this.");
  }
  return { supabase, employee };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createRoom(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireMasterAdmin();
    const roomNumber = (formData.get("room_number") as string)?.trim();
    const price = Number(formData.get("price"));

    if (!roomNumber || !price || price <= 0) {
      return { ok: false, error: "Enter a room number and a price greater than 0." };
    }

    const { error } = await supabase.from("rooms").insert({
      hotel_id: employee.hotel_id,
      room_number: roomNumber,
      price,
    });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("duplicate") ? "That room number already exists." : "Could not add room.",
      };
    }

    revalidatePath("/rooms/management");
    revalidatePath("/rooms/overview");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateRoomPrice(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireMasterAdmin();
    const roomId = formData.get("room_id") as string;
    const price = Number(formData.get("price"));

    if (!price || price <= 0) return { ok: false, error: "Enter a valid price." };

    const { error } = await supabase.from("rooms").update({ price }).eq("id", roomId);
    if (error) return { ok: false, error: "Could not update price." };

    revalidatePath("/rooms/management");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
