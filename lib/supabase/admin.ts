import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE ROLE client — bypasses Row Level Security.
 * Only import this inside server-side code (API routes, server actions)
 * that has already verified the caller is the Master Admin.
 * NEVER import this in a client component or expose it to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Server misconfigured: NEXT_PUBLIC_SUPABASE_URL is not set in this deployment's environment variables."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set in this deployment's environment variables. " +
        "Get it from Supabase Dashboard -> Settings -> API Keys (the 'service_role secret' key), " +
        "then set it in Vercel -> Settings -> Environment Variables -> Production, and redeploy."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
