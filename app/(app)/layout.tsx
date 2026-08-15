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

  const { data: employee } = await supabase
    .from("employees")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = employee?.role === "master_admin";

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
