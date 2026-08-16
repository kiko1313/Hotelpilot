import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PermissionsPage() {
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
    .select("full_name, login_id, role, status")
    .order("role");

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Permissions
        </h1>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <h2 className="mb-3 font-display text-base font-semibold text-parchment">
              How access works here
            </h2>
            <ul className="space-y-2 text-sm text-parchment-dim">
              <li>
                <strong className="text-parchment">👑 Master Admin</strong> — exactly one
                per hotel, enforced by the database itself. Full access: rooms, guests,
                payments, employees, shifts, audit log, settings.
              </li>
              <li>
                <strong className="text-parchment">Staff</strong> — can check guests
                in/out, take payments, extend checkouts, run shifts. Cannot delete
                historical records, cannot see the audit log, cannot create or edit
                other employees.
              </li>
              <li>
                These rules are enforced at the database level (Row Level Security),
                not just hidden in the interface — even a direct request bypassing the
                UI is blocked the same way.
              </li>
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
            <div className="border-b border-ink-700 px-5 py-3 text-sm font-medium text-parchment-dim">
              Current accounts
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {(employees ?? []).map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-parchment">{e.full_name}</td>
                    <td className="px-4 py-3 font-mono text-brass-bright">
                      {e.login_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-parchment-dim">
                      {e.role === "master_admin" ? "👑 Master Admin" : "Staff"}
                    </td>
                    <td className="px-4 py-3 text-parchment-dim">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </main>
  );
}
