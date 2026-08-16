import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("full_name, role, login_id, created_at")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          My account
        </h1>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-md space-y-6">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-parchment-dim">Name</dt>
                <dd className="text-parchment">{employee?.full_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-parchment-dim">Role</dt>
                <dd className="text-parchment">
                  {employee?.role === "master_admin" ? "👑 Master Admin" : "Staff"}
                </dd>
              </div>
              {employee?.login_id && (
                <div className="flex justify-between">
                  <dt className="text-parchment-dim">Staff ID</dt>
                  <dd className="font-mono text-brass-bright">{employee.login_id}</dd>
                </div>
              )}
              {!employee?.login_id && (
                <div className="flex justify-between">
                  <dt className="text-parchment-dim">Email</dt>
                  <dd className="text-parchment">{user.email}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-parchment-dim">Member since</dt>
                <dd className="text-parchment">
                  {employee?.created_at
                    ? new Date(employee.created_at).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
