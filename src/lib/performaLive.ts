import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type LiveSessionStatus = "DRAFT" | "READY" | "LIVE" | "ENDED";
export type LiveDestinationStatus = "DISABLED" | "CONNECTING" | "LIVE" | "ERROR";
export type LiveProvider = "cloudflare_stream" | "livepeer_studio";
export type DestinationProvider = "twitch" | "facebook" | "instagram_manual" | "custom_rtmp";

export type LiveSession = {
  id: string;
  creator_id: string;
  title: string;
  status: LiveSessionStatus;
  provider: LiveProvider;
  provider_input_id: string | null;
  provider_playback_id: string | null;
  ingest_type: "rtmp";
  ingest_url: string | null;
  ingest_status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  last_webhook_at: string | null;
  ingest_last_heartbeat_at: string | null;
};

export type LiveDestination = {
  id: string;
  session_id: string;
  provider: DestinationProvider;
  display_name: string;
  enabled: boolean;
  status: LiveDestinationStatus;
  rtmp_url: string;
  provider_output_id: string | null;
  last_error: string | null;
  last_success_at: string | null;
  destination_heartbeat_at: string | null;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const supabaseUrl = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();
export const isPerformaLiveCloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;
export const getLiveSupabaseBrowser = () => {
  if (!isPerformaLiveCloudEnabled || !supabaseUrl || !supabaseAnonKey) return null;
  if (supabase) return supabase;
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return supabase;
};

export const getLiveSession = async (): Promise<Session | null> => {
  const client = getLiveSupabaseBrowser();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session || null;
};

export const getLiveUser = async () => {
  const client = getLiveSupabaseBrowser();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user || null;
};

export const signInLiveWithMagicLink = async (email: string): Promise<Result<{ sent: true }>> => {
  const client = getLiveSupabaseBrowser();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/live` : undefined;
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: redirectTo }
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { sent: true } };
};

export const signOutLive = async () => {
  const client = getLiveSupabaseBrowser();
  if (!client) return;
  await client.auth.signOut();
};

const getProjectRef = () => {
  if (!supabaseUrl) return "";
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
};

const callLiveFunction = async <T>(path: string, payload: Record<string, unknown>): Promise<Result<T>> => {
  const projectRef = getProjectRef();
  if (!projectRef) return { ok: false, error: "Supabase URL not configured." };
  const session = await getLiveSession();
  if (!session?.access_token) return { ok: false, error: "Please sign in first." };

  const response = await fetch(`https://${projectRef}.functions.supabase.co/live/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: String((data as any).error || "Live function call failed.") };
  }
  return { ok: true, data: data as T };
};

export const loadLiveSessions = async (): Promise<Result<LiveSession[]>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: true, data: [] };
  const { data, error } = await client
    .from("live_sessions")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []) as LiveSession[] };
};

export const loadLiveSessionById = async (id: string): Promise<Result<LiveSession | null>> => {
  const client = getLiveSupabaseBrowser();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client.from("live_sessions").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as LiveSession | null) || null };
};

export const loadLiveDestinations = async (sessionId: string): Promise<Result<LiveDestination[]>> => {
  const client = getLiveSupabaseBrowser();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client
    .from("live_destinations")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []) as LiveDestination[] };
};

export const createLiveSession = async (args: {
  title: string;
  provider: LiveProvider;
}): Promise<Result<{ session: LiveSession; ingest: { url: string; streamKey: string; revealOnce: true } }>> =>
  callLiveFunction("session.create", args);

export const upsertLiveDestination = async (args: {
  sessionId: string;
  destinationId?: string;
  provider: DestinationProvider;
  displayName: string;
  enabled: boolean;
  rtmpUrl: string;
  streamKey?: string;
}): Promise<Result<{ destination: LiveDestination }>> =>
  callLiveFunction("destination.upsert", args);

export const startLiveSession = async (sessionId: string): Promise<Result<{ session: LiveSession }>> =>
  callLiveFunction("session.start", { sessionId });

export const endLiveSession = async (sessionId: string): Promise<Result<{ session: LiveSession }>> =>
  callLiveFunction("session.end", { sessionId });

export const syncLiveSession = async (sessionId: string): Promise<Result<{ session: LiveSession }>> =>
  callLiveFunction("session.sync", { sessionId });
