import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
}

export const supabaseAnon = createClient(url, anonKey);

export function getSupabaseAdmin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  return createClient(url as string, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
