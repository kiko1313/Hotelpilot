import { ComingSoon } from "@/components/coming-soon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (employee?.role !== "master_admin") redirect("/dashboard");

  return (
    <ComingSoon
      title="Admin"
      stage="Stage 4"
      description="Hotel-wide settings and controls, visible only to the Master Admin."
    />
  );
}
