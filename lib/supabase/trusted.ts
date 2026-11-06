import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only client for bounded processing finalization RPCs.
 * It is never imported by client components and does not use a browser-exposed key.
 */
export function createTrustedClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante pour le traitement serveur.");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
