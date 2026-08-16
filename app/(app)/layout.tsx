import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: employee, error } = await supabase
    .from("employees")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  // Never guess a role. If the employee record can't be found or read,
  // that's a real problem to surface — not something to default to "Staff".
  if (error || !employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-danger/10 p-6 text-center">
          <h1 className="mb-2 font-display text-lg font-semibold text-parchment">
            Profile not found
          </h1>
          <p className="mb-4 text-sm text-parchment-dim">
            You&apos;re signed in as <strong>{user.email}</strong>, but no
            matching employee record was found. Your role could not be
            determined. Contact your hotel administrator — this needs to be
            fixed before continuing.
          </p>
          <form action="/auth/logout" method="post">
            <button className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-parchment transition-colors hover:border-brass-dim">
              Log out
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (employee.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-danger/10 p-6 text-center">
          <h1 className="mb-2 font-display text-lg font-semibold text-parchment">
            Account disabled
          </h1>
          <p className="mb-4 text-sm text-parchment-dim">
            This account has been disabled. Contact your hotel administrator.
          </p>
          <form action="/auth/logout" method="post">
            <button className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-parchment transition-colors hover:border-brass-dim">
              Log out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isAdmin = employee.role === "master_admin";

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
