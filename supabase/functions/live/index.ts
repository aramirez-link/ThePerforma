import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLiveHandler, json } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const encryptionKey = Deno.env.get("LIVE_SECRET_ENCRYPTION_KEY") || "";

if (!supabaseUrl || !serviceRole) {
  Deno.serve(() => json(500, { error: "Missing Supabase runtime secrets." }));
} else {
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const handler = createLiveHandler({
    supabase,
    encryptionKey
  });
  Deno.serve(handler);
}

