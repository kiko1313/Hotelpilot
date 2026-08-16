import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ACTION_LABELS: Record<string, string> = {
  BOOKING_CREATED: "Booking created",
  CHECK_IN: "Checked in",
  CHECK_OUT: "Checked out",
  PAYMENT_RECORDED: "Payment recorded",
  CHECKOUT_EXTENDED: "Checkout extended",
  EMPLOYEE_CREATED: "Employee created",
  EMPLOYEE_ENABLED: "Employee enabled",
  EMPLOYEE_DISABLED: "Employee disabled",
  PASSWORD_RESET_BY_ADMIN: "Password reset (by admin)",
};

const ACTION_COLORS: Record<string, string> = {
  BOOKING_CREATED: "bg-brass/15 text-brass-bright",
  CHECK_IN: "bg-ok/15 text-ok",
  CHECK_OUT: "bg-ink-700 text-parchment-dim",
  PAYMENT_RECORDED: "bg-ok/15 text-ok",
  CHECKOUT_EXTENDED: "bg-warn/15 text-warn",
  EMPLOYEE_CREATED: "bg-brass/15 text-brass-bright",
  EMPLOYEE_ENABLED: "bg-ok/15 text-ok",
  EMPLOYEE_DISABLED: "bg-danger/15 text-danger",
  PASSWORD_RESET_BY_ADMIN: "bg-warn/15 text-warn",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; employee?: string }>;
}) {
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

  const params = await searchParams;

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, login_id")
    .order("full_name");

  let query = supabase
    .from("audit_logs")
    .select("id, action, object_type, object_id, previous_value, new_value, reason, created_at, employee_id, employees(full_name, login_id)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.action) query = query.eq("action", params.action);
  if (params.employee) query = query.eq("employee_id", params.employee);

  const { data: logs } = await query;

  const actionOptions = Object.keys(ACTION_LABELS);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          Audit log
        </h1>
        <p className="text-xs text-parchment-dim">
          Every important action, permanently recorded. Nothing here can be edited or deleted — not even by you.
        </p>
      </header>

      <div className="px-6 py-8">
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-parchment-dim">
              Action
            </label>
            <select
              name="action"
              defaultValue={params.action ?? ""}
              className="rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-parchment focus:border-brass focus:outline-none"
            >
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-parchment-dim">
              Employee
            </label>
            <select
              name="employee"
              defaultValue={params.employee ?? ""}
              className="rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-parchment focus:border-brass focus:outline-none"
            >
              <option value="">All employees</option>
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} {e.login_id ? `(${e.login_id})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-parchment transition-colors hover:border-brass-dim">
            Filter
          </button>
          {(params.action || params.employee) && (
            <a
              href="/admin/audit-log"
              className="text-sm text-parchment-dim hover:text-parchment"
            >
              Clear
            </a>
          )}
        </form>

        <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-parchment-dim">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {(logs ?? []).map((log) => {
                const employee = Array.isArray(log.employees)
                  ? log.employees[0]
                  : log.employees;
                return (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-parchment-dim">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-parchment">
                      {employee?.full_name ?? "—"}
                      {employee?.login_id && (
                        <span className="ml-1 text-xs text-parchment-dim">
                          ({employee.login_id})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          ACTION_COLORS[log.action] ?? "bg-ink-700 text-parchment-dim"
                        }`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-parchment-dim">
                      {log.reason && (
                        <div className="mb-1 text-parchment">Reason: {log.reason}</div>
                      )}
                      {(log.previous_value || log.new_value) && (
                        <details>
                          <summary className="cursor-pointer text-brass-bright hover:underline">
                            View data
                          </summary>
                          <div className="mt-1 space-y-1 font-mono">
                            {log.previous_value ? (
                              <div>Before: {JSON.stringify(log.previous_value)}</div>
                            ) : null}
                            {log.new_value ? (
                              <div>After: {JSON.stringify(log.new_value)}</div>
                            ) : null}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-parchment-dim">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {logs && logs.length === 200 && (
          <p className="mt-3 text-center text-xs text-parchment-dim">
            Showing the most recent 200 entries.
          </p>
        )}
      </div>
    </main>
  );
}
