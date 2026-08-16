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
    .select("id, hotel_id, role, status, full_name")
    .eq("id", user.id)
    .single();

  if (!employee || employee.status !== "active") {
    throw new Error("Account is not active.");
  }

  return { supabase, employee };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function currentSlot(): "SHIFT_1" | "SHIFT_2" | "SHIFT_3" {
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 16) return "SHIFT_1";
  if (hour >= 16) return "SHIFT_2";
  return "SHIFT_3";
}

// ---------------------------------------------------------------------------
// START SHIFT — opens a new shift, linking it to the previous one if present
// ---------------------------------------------------------------------------
export async function startShift(): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const { data: existingOpen } = await supabase
      .from("shifts")
      .select("id")
      .eq("status", "OPEN")
      .maybeSingle();

    if (existingOpen) {
      return { ok: false, error: "A shift is already open. Close it first, or take it over." };
    }

    const { data: lastShift } = await supabase
      .from("shifts")
      .select("id")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: shift, error } = await supabase
      .from("shifts")
      .insert({
        hotel_id: employee.hotel_id,
        slot: currentSlot(),
        responsible_employee_id: employee.id,
        previous_shift_id: lastShift?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !shift) return { ok: false, error: "Could not start shift." };

    await supabase.from("shift_events").insert({
      shift_id: shift.id,
      event_type: "STARTED",
      employee_id: employee.id,
    });

    await supabase.rpc("log_audit_event", {
      p_action: "SHIFT_STARTED",
      p_object_type: "shift",
      p_object_id: shift.id,
    });

    revalidatePath("/shifts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// VERIFY AN EMPTY ROOM — confirm it's actually empty, or flag a discrepancy
// ---------------------------------------------------------------------------
export async function verifyRoom(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const shiftId = formData.get("shift_id") as string;
    const roomId = formData.get("room_id") as string;
    const reportedStatus = formData.get("reported_status") as "AVAILABLE" | "OCCUPIED";
    const note = (formData.get("note") as string | null) ?? null;

    const { error } = await supabase.from("shift_room_checks").insert({
      shift_id: shiftId,
      room_id: roomId,
      expected_status: "AVAILABLE",
      reported_status: reportedStatus,
      is_discrepancy: reportedStatus !== "AVAILABLE",
      employee_id: employee.id,
      note,
    });
    if (error) return { ok: false, error: "Could not save verification." };

    if (reportedStatus !== "AVAILABLE") {
      await supabase.rpc("log_audit_event", {
        p_action: "ROOM_DISCREPANCY_REPORTED",
        p_object_type: "room",
        p_object_id: roomId,
        p_reason: note,
      });
    }

    revalidatePath("/shifts/start-verification");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// CLOSE SHIFT
// ---------------------------------------------------------------------------
export async function closeShift(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    const shiftId = formData.get("shift_id") as string;
    const note = (formData.get("closing_note") as string | null) ?? null;

    const { error } = await supabase
      .from("shifts")
      .update({
        status: "CLOSED",
        ended_at: new Date().toISOString(),
        closing_note: note,
        closing_confirmed_by: employee.id,
        closing_confirmed_at: new Date().toISOString(),
      })
      .eq("id", shiftId);
    if (error) return { ok: false, error: "Could not close shift." };

    await supabase.from("shift_events").insert({
      shift_id: shiftId,
      event_type: "CLOSED",
      employee_id: employee.id,
    });

    await supabase.rpc("log_audit_event", {
      p_action: "SHIFT_CLOSED",
      p_object_type: "shift",
      p_object_id: shiftId,
      p_reason: note,
    });

    revalidatePath("/shifts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// ACCEPT HANDOVER — incoming employee formally accepts the previous shift
// ---------------------------------------------------------------------------
export async function acceptHandover(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();
    const shiftId = formData.get("shift_id") as string;

    const { error } = await supabase
      .from("shifts")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", shiftId);
    if (error) return { ok: false, error: "Could not accept handover." };

    await supabase.from("shift_events").insert({
      shift_id: shiftId,
      event_type: "HANDOVER_ACCEPTED",
      employee_id: employee.id,
    });

    await supabase.rpc("log_audit_event", {
      p_action: "SHIFT_HANDOVER_ACCEPTED",
      p_object_type: "shift",
      p_object_id: shiftId,
    });

    revalidatePath("/shifts/handover");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// TAKE OVER SHIFT — manager steps in on an interrupted shift, preserving history
// ---------------------------------------------------------------------------
export async function takeOverShift(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, employee } = await requireEmployee();

    if (employee.role !== "master_admin") {
      return { ok: false, error: "Only the Master Admin can take over a shift." };
    }

    const shiftId = formData.get("shift_id") as string;
    const reason = (formData.get("reason") as string | null) ?? null;

    const { data: shift } = await supabase
      .from("shifts")
      .select("responsible_employee_id")
      .eq("id", shiftId)
      .single();
    if (!shift) return { ok: false, error: "Shift not found." };

    const originalEmployeeId = shift.responsible_employee_id;

    const { error } = await supabase
      .from("shifts")
      .update({ responsible_employee_id: employee.id })
      .eq("id", shiftId);
    if (error) return { ok: false, error: "Could not take over shift." };

    await supabase.from("shift_events").insert({
      shift_id: shiftId,
      event_type: "TAKEOVER",
      employee_id: employee.id,
      related_employee_id: originalEmployeeId,
      reason,
    });

    await supabase.rpc("log_audit_event", {
      p_action: "SHIFT_TAKEOVER",
      p_object_type: "shift",
      p_object_id: shiftId,
      p_reason: reason,
    });

    revalidatePath("/shifts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
