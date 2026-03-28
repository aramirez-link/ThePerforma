import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "./supabaseBrowser";

export type LiveSessionStatus = "DRAFT" | "READY" | "LIVE" | "ENDED";
export type LiveDestinationStatus = "DISABLED" | "CONNECTING" | "LIVE" | "ERROR";
export type LiveProvider = "cloudflare_stream" | "livepeer_studio";
export type DestinationProvider = "twitch" | "facebook" | "instagram_manual" | "custom_rtmp";
export type LiveIngestType = "rtmp" | "webrtc" | "srt";

export type LiveSession = {
  id: string;
  creator_id: string;
  title: string;
  status: LiveSessionStatus;
  provider: LiveProvider;
  provider_input_id: string | null;
  provider_playback_id: string | null;
  ingest_type: LiveIngestType;
  ingest_url: string | null;
  webrtc_publish_url?: string | null;
  webrtc_playback_url?: string | null;
  srt_ingest_url?: string | null;
  srt_stream_id?: string | null;
  ingest_status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  scheduled_for: string | null;
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

export type PublicLiveStatus = {
  sessionId: string;
  title: string;
  provider: LiveProvider;
  status: LiveSessionStatus;
  ingestStatus: string;
  ingestType: LiveIngestType;
  playbackId: string | null;
  isLive: boolean;
  health: "healthy" | "starting" | "stale";
  latencyMode: "ll-hls" | "standard";
  lastWebhookAt: string | null;
  ingestHeartbeatAt: string | null;
  scheduledFor: string | null;
};

export type LiveSessionPresence = {
  session_id: string;
  user_id: string;
  display_name: string;
  user_email: string;
  avatar_url: string | null;
  joined_at: string;
  last_seen_at: string;
  last_path: string | null;
  device_kind: "web" | "mobile_web" | "tablet_web";
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const supabaseUrl = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();
export const isPerformaLiveCloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;
export const getLiveSupabaseBrowser = () => {
  if (!isPerformaLiveCloudEnabled || !supabaseUrl || !supabaseAnonKey) return null;
  if (supabase) return supabase;
  supabase = getBrowserSupabaseClient();
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

const callLivePublicFunction = async <T>(path: string, payload: Record<string, unknown> = {}): Promise<Result<T>> => {
  const projectRef = getProjectRef();
  if (!projectRef) return { ok: false, error: "Supabase URL not configured." };
  const response = await fetch(`https://${projectRef}.functions.supabase.co/live/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []) as LiveSession[] };
};

export const loadAdminLiveSessions = async (): Promise<Result<LiveSession[]>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: true, data: [] };
  const { data, error } = await client
    .from("live_sessions")
    .select("*")
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
  scheduledFor?: string;
}): Promise<Result<{ session: LiveSession; ingest: { url: string; streamKey: string; revealOnce: true } }>> =>
  callLiveFunction("session.create", args);

export const updateLiveSessionSchedule = async (
  sessionId: string,
  scheduledFor: string | null
): Promise<Result<{ session: LiveSession }>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: false, error: "Please sign in first." };
  const { data, error } = await client
    .from("live_sessions")
    .update({ scheduled_for: scheduledFor })
    .eq("id", sessionId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Unable to update session schedule." };
  return { ok: true, data: { session: data as LiveSession } };
};

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

export const deleteLiveSession = async (sessionId: string): Promise<Result<{ deleted: true; sessionId: string }>> =>
  callLiveFunction("session.delete", { sessionId });

export const adminForceEndLiveSession = async (sessionId: string): Promise<Result<{ session: LiveSession }>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: false, error: "Please sign in first." };

  const endedAt = new Date().toISOString();
  const { data, error } = await client
    .from("live_sessions")
    .update({
      status: "ENDED",
      ended_at: endedAt,
      ingest_status: "IDLE"
    })
    .eq("id", sessionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Unable to end session." };
  }

  await client
    .from("live_destinations")
    .update({
      enabled: false,
      status: "DISABLED",
      destination_heartbeat_at: endedAt
    })
    .eq("session_id", sessionId);

  return { ok: true, data: { session: data as LiveSession } };
};

export const adminForceDeleteLiveSession = async (sessionId: string): Promise<Result<{ deleted: true; sessionId: string }>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: false, error: "Please sign in first." };

  const { error } = await client.from("live_sessions").delete().eq("id", sessionId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { deleted: true, sessionId } };
};

export const syncLiveSession = async (sessionId: string): Promise<Result<{ session: LiveSession }>> =>
  callLiveFunction("session.sync", { sessionId });

export const getPublicLiveStatus = async (): Promise<Result<PublicLiveStatus | null>> => {
  const response = await callLivePublicFunction<{ session: PublicLiveStatus | null }>("public.status", {});
  if (!response.ok) return response;
  return { ok: true, data: response.data.session || null };
};

export const loadAdminLivePresence = async (sessionId?: string | null): Promise<Result<LiveSessionPresence[]>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: true, data: [] };

  let query = client.from("live_session_presence").select("*").order("last_seen_at", { ascending: false });
  const cleanSessionId = String(sessionId || "").trim();
  if (cleanSessionId) {
    query = query.eq("session_id", cleanSessionId);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []) as LiveSessionPresence[] };
};

export const upsertLiveSessionPresence = async (input: {
  sessionId: string;
  displayName: string;
  userEmail: string;
  avatarUrl?: string | null;
  lastPath?: string | null;
  deviceKind?: LiveSessionPresence["device_kind"];
}): Promise<Result<{ tracked: true }>> => {
  const client = getLiveSupabaseBrowser();
  const user = await getLiveUser();
  if (!client || !user) return { ok: false, error: "Please sign in first." };

  const sessionId = String(input.sessionId || "").trim();
  if (!sessionId) return { ok: false, error: "Session id is required." };

  const now = new Date().toISOString();
  const { error } = await client.from("live_session_presence").upsert(
    {
      session_id: sessionId,
      user_id: user.id,
      display_name: String(input.displayName || "").trim() || "Fan",
      user_email: String(input.userEmail || "").trim().toLowerCase(),
      avatar_url: input.avatarUrl || null,
      last_seen_at: now,
      last_path: String(input.lastPath || "").trim() || null,
      device_kind: input.deviceKind || "web"
    },
    { onConflict: "session_id,user_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { tracked: true } };
};
