import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createStaffAccount, setEmployeeStatus } from "@/lib/actions/employees";
import { NewStaffForm } from "./new-staff-form";
import { ResetPasswordButton } from "./reset-password-button";

export default async function EmployeesAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "master_admin") redirect("/dashboard");

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, login_id, role, status, created_at")
    .order("created_at", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    return createStaffAccount(formData);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Employees
        </h1>
        <p className="text-xs text-parchment-dim">
          Staff sign in with an ID and password — no email needed.
        </p>
      </header>

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-5 py-3 text-sm font-medium text-parchment-dim">
            Staff accounts
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(employees ?? []).map((emp) => (
                <tr key={emp.id}>
                  <td className="px-4 py-3 font-mono text-brass-bright">
                    {emp.login_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-parchment">{emp.full_name}</td>
                  <td className="px-4 py-3 text-parchment-dim">
                    {emp.role === "master_admin" ? "👑 Master Admin" : "Staff"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        emp.status === "active"
                          ? "bg-ok/15 text-ok"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {emp.role !== "master_admin" && (
                      <div className="flex items-center gap-2">
                        <ResetPasswordButton employeeId={emp.id} />
                        <form
                          action={async () => {
                            "use server";
                            await setEmployeeStatus(
                              emp.id,
                              emp.status === "active" ? "disabled" : "active"
                            );
                          }}
                        >
                          <button className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-parchment transition-colors hover:border-brass-dim">
                            {emp.status === "active" ? "Disable" : "Enable"}
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(!employees || employees.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-parchment-dim">
                    No staff accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <NewStaffForm action={createAction} />
      </div>
    </main>
  );
}
