import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AIChat } from "./ai-chat";

export default async function OperationsAssistantPage() {
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

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          🤖 Operations Assistant
        </h1>
        <p className="text-xs text-parchment-dim">
          Read-only by default. Any change requires your explicit confirmation.
        </p>
      </header>

      <div className="px-6 py-8">
        <AIChat />
      </div>
    </main>
  );
}
