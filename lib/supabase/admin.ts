import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role client. BYPASSES Row Level Security — server-only.
// Used exclusively by the automation engine, scheduler, and invitation
// flows where privileged, audited server-side work is required.
// NEVER import this file from client components.
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Privileged operations (automation scheduler, invitations) are unavailable."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasServiceRole(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
