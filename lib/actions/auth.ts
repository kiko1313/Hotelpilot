"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STAFF_EMAIL_DOMAIN = "staff.hotelpilot.local";

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Accepts either:
 *  - a Master Admin's real email address, or
 *  - a staff login ID (e.g. "ST001")
 * and signs in with the matching internal Supabase Auth account.
 * The staff-facing ID -> email mapping never reaches the browser.
 */
export async function signIn(formData: FormData): Promise<LoginResult> {
  const identifier = (formData.get("identifier") as string)?.trim();
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { ok: false, error: "Enter your ID (or email) and password." };
  }

  let email = identifier;

  // Not an email shape -> treat as a staff login ID and resolve it.
  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    const { data: employee } = await admin
      .from("employees")
      .select("id, status")
      .eq("login_id", identifier.toUpperCase())
      .single();

    if (!employee) {
      return { ok: false, error: "That ID or password isn't right." };
    }
    if (employee.status !== "active") {
      return { ok: false, error: "This account has been disabled." };
    }

    email = `${identifier.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "That ID (or email) or password isn't right." };
  }

  return { ok: true };
}
