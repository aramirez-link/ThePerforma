import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();

type BrowserGlobal = typeof globalThis & {
  __performaSupabaseBrowser?: SupabaseClient | null;
};

export const isBrowserSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const getBrowserSupabaseClient = (): SupabaseClient | null => {
  if (!isBrowserSupabaseEnabled || !supabaseUrl || !supabaseAnonKey) return null;
  const scope = globalThis as BrowserGlobal;
  if (scope.__performaSupabaseBrowser) return scope.__performaSupabaseBrowser;
  scope.__performaSupabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return scope.__performaSupabaseBrowser;
};
