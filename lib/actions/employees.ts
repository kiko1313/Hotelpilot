"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const STAFF_EMAIL_DOMAIN = "staff.hotelpilot.local";

function loginIdToEmail(loginId: string) {
  return `${loginId.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

async function requireMasterAdmin() {
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

  if (!employee || employee.role !== "master_admin" || employee.status !== "active") {
    throw new Error("Only the Master Admin can do this.");
  }

  return { supabase, employee };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// CREATE STAFF ACCOUNT — ID + password, no email required from the employee
// ---------------------------------------------------------------------------
export async function createStaffAccount(formData: FormData): Promise<ActionResult> {
  try {
    const { employee } = await requireMasterAdmin();

    const fullName = (formData.get("full_name") as string)?.trim();
    const loginId = (formData.get("login_id") as string)?.trim().toUpperCase();
    const password = formData.get("password") as string;

    if (!fullName || !loginId || !password) {
      return { ok: false, error: "Fill in name, ID, and password." };
    }
    if (!/^[A-Z0-9_-]{3,20}$/.test(loginId)) {
      return {
        ok: false,
        error: "ID must be 3–20 characters: letters, numbers, - or _ only.",
      };
    }
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const admin = createAdminClient();
    const email = loginIdToEmail(loginId);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      if (createError?.message?.toLowerCase().includes("already")) {
        return { ok: false, error: "That ID is already taken." };
      }
      return { ok: false, error: "Could not create the account." };
    }

    const { error: insertError } = await admin.from("employees").insert({
      id: created.user.id,
      hotel_id: employee.hotel_id,
      auth_user_id: created.user.id,
      full_name: fullName,
      login_id: loginId,
      role: "staff",
      status: "active",
      created_by: employee.id,
    });

    if (insertError) {
      // Roll back the auth user so we don't leave an orphaned login.
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: "Could not save the employee record." };
    }

    const supabase = await createClient();
    await supabase.rpc("log_audit_event", {
      p_action: "EMPLOYEE_CREATED",
      p_object_type: "employee",
      p_object_id: created.user.id,
      p_new_value: { login_id: loginId, full_name: fullName },
    });

    revalidatePath("/admin/employees");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// RESET STAFF PASSWORD
// ---------------------------------------------------------------------------
export async function resetStaffPassword(formData: FormData): Promise<ActionResult> {
  try {
    await requireMasterAdmin();

    const employeeId = formData.get("employee_id") as string;
    const newPassword = formData.get("new_password") as string;

    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(employeeId, {
      password: newPassword,
    });
    if (error) return { ok: false, error: "Could not reset password." };

    const supabase = await createClient();
    await supabase.rpc("log_audit_event", {
      p_action: "PASSWORD_RESET_BY_ADMIN",
      p_object_type: "employee",
      p_object_id: employeeId,
    });

    revalidatePath("/admin/employees");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// ENABLE / DISABLE STAFF
// ---------------------------------------------------------------------------
export async function setEmployeeStatus(
  employeeId: string,
  status: "active" | "disabled"
): Promise<ActionResult> {
  try {
    const { supabase } = await requireMasterAdmin();

    const { error } = await supabase
      .from("employees")
      .update({ status })
      .eq("id", employeeId);
    if (error) return { ok: false, error: "Could not update status." };

    await supabase.rpc("log_audit_event", {
      p_action: status === "active" ? "EMPLOYEE_ENABLED" : "EMPLOYEE_DISABLED",
      p_object_type: "employee",
      p_object_id: employeeId,
    });

    revalidatePath("/admin/employees");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
