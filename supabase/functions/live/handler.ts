import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptSecret, encryptSecret } from "./_shared/crypto.ts";
import { createProviderAdapter } from "./_shared/provider.ts";
import { applySessionTransition, desiredDestinationStatus } from "./_shared/stateMachine.ts";
import type {
  DestinationProvider,
  DestinationRow,
  DestinationStatus,
  IngestStatus,
  LiveProvider,
  LiveSessionRow,
  SessionStatus
} from "./_shared/types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

export const resolveRoute = (pathname: string) => {
  const clean = pathname.replace(/^\/+/, "");
  if (clean.endsWith("public.status")) return "public.status";
  if (clean.endsWith("session.create")) return "session.create";
  if (clean.endsWith("session.delete")) return "session.delete";
  if (clean.endsWith("session.sync")) return "session.sync";
  if (clean.endsWith("destination.upsert")) return "destination.upsert";
  if (clean.endsWith("session.start")) return "session.start";
  if (clean.endsWith("session.end")) return "session.end";
  if (clean.endsWith("webhook")) return "webhook";
  return "unknown";
};

const parseBearerToken = (authHeader: string | null) => {
  const raw = String(authHeader || "");
  return raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : "";
};

const asText = (value: unknown) => String(value || "").trim();
const INVALID_DATETIME = "__invalid_datetime__";

const parseOptionalDateTime = (value: unknown) => {
  const raw = asText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return INVALID_DATETIME;
  return parsed.toISOString();
};

const isSessionProvider = (value: unknown): value is LiveProvider =>
  value === "cloudflare_stream" || value === "livepeer_studio";

const isDestinationProvider = (value: unknown): value is DestinationProvider =>
  value === "twitch" || value === "facebook" || value === "instagram_manual" || value === "custom_rtmp";

const parseDestinationProvider = (value: unknown): DestinationProvider => {
  const normalized = asText(value).toLowerCase();
  if (normalized === "instagram_manual") return "instagram_manual";
  if (normalized === "custom_rtmp") return "custom_rtmp";
  if (normalized === "twitch") return "twitch";
  if (normalized === "facebook") return "facebook";
  return "custom_rtmp";
};

const parseIngestStatus = (value: unknown): IngestStatus => {
  const status = asText(value).toUpperCase();
  if (status === "LIVE" || status === "ERROR" || status === "CONNECTING" || status === "IDLE") {
    return status;
  }
  return "CONNECTING";
};

const parseDestinationStatus = (value: unknown): DestinationStatus => {
  const status = asText(value).toUpperCase();
  if (status === "LIVE" || status === "ERROR" || status === "DISABLED" || status === "CONNECTING") {
    return status;
  }
  return "CONNECTING";
};

export const verifyWebhookSignature = async (
  signatureHeader: string | null,
  rawBody: string,
  secret: string
) => {
  if (!secret) return true;
  const incoming = asText(signatureHeader);
  if (!incoming) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return incoming === expected;
};

const getActor = async (supabase: SupabaseClient, req: Request) => {
  const token = parseBearerToken(req.headers.get("authorization"));
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data.user || null;
};

const insertAudit = async (
  supabase: SupabaseClient,
  actorId: string | null,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown>
) => {
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    object_type: objectType,
    object_id: objectId,
    metadata_json: metadata
  });
};

const isStoreAdminUser = async (supabase: SupabaseClient, userId: string) => {
  const { count, error } = await supabase
    .from("store_admins")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return false;
  return Number(count || 0) > 0;
};

const loadAccessibleSession = async (supabase: SupabaseClient, sessionId: string, actorId: string) => {
  const isAdmin = await isStoreAdminUser(supabase, actorId);
  const query = isAdmin
    ? supabase.from("live_sessions").select("*").eq("id", sessionId)
    : supabase.from("live_sessions").select("*").eq("id", sessionId).eq("creator_id", actorId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as LiveSessionRow;
};

const loadDestinations = async (supabase: SupabaseClient, sessionId: string) => {
  const { data } = await supabase
    .from("live_destinations")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return (data || []) as DestinationRow[];
};

const createSecretRef = async (supabase: SupabaseClient, plaintext: string, encryptionKey: string) => {
  const encryptedValue = await encryptSecret(plaintext, encryptionKey);
  const { data, error } = await supabase
    .from("secret_store")
    .insert({
      encrypted_value: encryptedValue,
      key_version: "v1"
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to store encrypted secret.");
  }
  return String(data.id);
};

const readSecretRef = async (supabase: SupabaseClient, secretRef: string, encryptionKey: string) => {
  const { data, error } = await supabase
    .from("secret_store")
    .select("encrypted_value")
    .eq("id", secretRef)
    .maybeSingle();
  if (error || !data?.encrypted_value) {
    throw new Error(error?.message || "Unable to load encrypted secret.");
  }
  return decryptSecret(String(data.encrypted_value), encryptionKey);
};

type CreateSessionPayload = {
  title?: string;
  provider?: LiveProvider;
  scheduledFor?: string;
};

type UpsertDestinationPayload = {
  sessionId?: string;
  destinationId?: string;
  provider?: DestinationProvider;
  displayName?: string;
  enabled?: boolean;
  rtmpUrl?: string;
  streamKey?: string;
};

type SessionMutationPayload = {
  sessionId?: string;
};

export const createLiveHandler = (deps: {
  supabase: SupabaseClient;
  encryptionKey: string;
  now?: () => string;
}) => {
  const now = deps.now || (() => new Date().toISOString());

  const routeSessionCreate = async (req: Request, body: CreateSessionPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });

    const title = asText(body.title || "Performa Live Session");
    const provider: LiveProvider = isSessionProvider(body.provider) ? body.provider : "cloudflare_stream";
    const scheduledFor = parseOptionalDateTime(body.scheduledFor);
    if (scheduledFor === INVALID_DATETIME) {
      return json(400, { error: "scheduledFor must be a valid ISO date/time." });
    }
    const adapter = createProviderAdapter(provider);

    const { data: created, error: createError } = await deps.supabase
      .from("live_sessions")
      .insert({
        creator_id: actor.id,
        title,
        status: "DRAFT",
        provider,
        ingest_type: "rtmp",
        ingest_status: "IDLE",
        scheduled_for: scheduledFor
      })
      .select("*")
      .single();
    if (createError || !created) return json(500, { error: createError?.message || "Unable to create session." });

    const draft = created as LiveSessionRow;
    let input;
    let ingestSecretRef = "";
    try {
      input = await adapter.createLiveInput({ sessionId: draft.id, title: draft.title });
      ingestSecretRef = await createSecretRef(deps.supabase, input.streamKey, deps.encryptionKey);
    } catch (error) {
      await deps.supabase
        .from("live_sessions")
        .update({
          status: "DRAFT",
          ingest_status: "ERROR"
        })
        .eq("id", draft.id);
      return json(502, {
        error: error instanceof Error ? error.message : "Provider input creation failed."
      });
    }

    const { data: updated, error: updateError } = await deps.supabase
      .from("live_sessions")
      .update({
        status: "READY",
        provider_input_id: input.inputId,
        provider_playback_id: input.playbackId || null,
        ingest_type: input.ingestType,
        ingest_url: input.ingestUrl,
        ingest_stream_key_secret_ref: ingestSecretRef,
        ingest_status: "CONNECTING"
      })
      .eq("id", draft.id)
      .select("*")
      .single();
    if (updateError || !updated) return json(500, { error: updateError?.message || "Unable to activate session ingest." });

    await insertAudit(deps.supabase, actor.id, "live_session_created", "live_session", draft.id, {
      provider
    });

    return json(200, {
      ok: true,
      session: updated,
      ingest: {
        url: input.ingestUrl,
        streamKey: input.streamKey,
        revealOnce: true
      }
    });
  };

  const routePublicStatus = async () => {
    const { data, error } = await deps.supabase
      .from("live_sessions")
      .select("id,title,provider,status,ingest_status,ingest_type,provider_playback_id,last_webhook_at,ingest_last_heartbeat_at,started_at,created_at,scheduled_for")
      .in("status", ["LIVE", "READY"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return json(500, { error: error.message });

    const rows = Array.isArray(data) ? data : [];
    const pickScore = (row: Record<string, unknown>) => {
      const scheduledFor = row.scheduled_for ? Date.parse(String(row.scheduled_for)) : Number.POSITIVE_INFINITY;
      return Number.isFinite(scheduledFor) ? scheduledFor : Number.POSITIVE_INFINITY;
    };

    const pickedLive =
      rows.find((row) => String((row as any).status || "").toUpperCase() === "LIVE") ||
      rows.find((row) => String((row as any).ingest_status || "").toUpperCase() === "LIVE") ||
      null;
    const pickedUpcoming =
      rows
        .filter((row) => String((row as any).status || "").toUpperCase() === "READY")
        .sort((a, b) => pickScore(a as Record<string, unknown>) - pickScore(b as Record<string, unknown>))[0] ||
      null;
    const picked = pickedLive || pickedUpcoming || rows[0] || null;

    if (!picked) {
      return json(200, { ok: true, session: null });
    }

    const heartbeatAt = (picked as any).ingest_last_heartbeat_at
      ? String((picked as any).ingest_last_heartbeat_at)
      : null;
    const scheduledFor = (picked as any).scheduled_for ? String((picked as any).scheduled_for) : null;
    const heartbeatAgeMs = heartbeatAt ? Date.now() - new Date(heartbeatAt).getTime() : Number.POSITIVE_INFINITY;
    const ingestStatus = String((picked as any).ingest_status || "CONNECTING");
    const sessionStatus = String((picked as any).status || "READY").toUpperCase();
    const isLive = sessionStatus === "LIVE" || ingestStatus.toUpperCase() === "LIVE";
    const health =
      !isLive
        ? "starting"
        : heartbeatAgeMs <= 90_000
        ? "healthy"
        : "stale";

    return json(200, {
      ok: true,
      session: {
        sessionId: String((picked as any).id),
        title: String((picked as any).title || "Performa Live"),
        provider: String((picked as any).provider || "cloudflare_stream"),
        status: sessionStatus,
        ingestStatus,
        ingestType: String((picked as any).ingest_type || "rtmp"),
        playbackId: (picked as any).provider_playback_id ? String((picked as any).provider_playback_id) : null,
        isLive,
        health,
        latencyMode: String((picked as any).ingest_type || "rtmp").toLowerCase() === "rtmp" ? "ll-hls" : "standard",
        lastWebhookAt: (picked as any).last_webhook_at ? String((picked as any).last_webhook_at) : null,
        ingestHeartbeatAt: heartbeatAt,
        scheduledFor
      }
    });
  };

  const routeDestinationUpsert = async (req: Request, body: UpsertDestinationPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });

    const sessionId = asText(body.sessionId);
    if (!sessionId) return json(400, { error: "sessionId is required." });

    const session = await loadAccessibleSession(deps.supabase, sessionId, actor.id);
    if (!session) return json(404, { error: "Session not found." });

    const destinationId = asText(body.destinationId);
    const enabled = body.enabled !== false;
    const rtmpUrl = asText(body.rtmpUrl);
    if (!rtmpUrl.startsWith("rtmp://") && !rtmpUrl.startsWith("rtmps://")) {
      return json(400, { error: "rtmpUrl must start with rtmp:// or rtmps://." });
    }

    let existing: DestinationRow | null = null;
    if (destinationId) {
      const { data } = await deps.supabase
        .from("live_destinations")
        .select("*")
        .eq("id", destinationId)
        .eq("session_id", session.id)
        .maybeSingle();
      existing = (data as DestinationRow | null) || null;
      if (!existing) return json(404, { error: "Destination not found." });
    }

    const destinationProvider = existing?.provider || parseDestinationProvider(body.provider);
    const displayName = asText(body.displayName || existing?.display_name || destinationProvider.replace(/_/g, " "));

    let secretRef = existing?.stream_key_secret_ref || "";
    const incomingStreamKey = asText(body.streamKey);
    if (incomingStreamKey) {
      secretRef = await createSecretRef(deps.supabase, incomingStreamKey, deps.encryptionKey);
      await insertAudit(deps.supabase, actor.id, "live_destination_secret_rotated", "live_destination", existing?.id || "pending", {
        session_id: session.id,
        provider: destinationProvider
      });
    } else if (!secretRef) {
      return json(400, { error: "streamKey is required for new destinations." });
    }

    const desiredStatus = desiredDestinationStatus(enabled, session.status);
    const basePayload = {
      session_id: session.id,
      provider: destinationProvider,
      display_name: displayName,
      enabled,
      status: desiredStatus,
      rtmp_url: rtmpUrl,
      stream_key_secret_ref: secretRef,
      last_error: null
    };

    const upsertQuery = existing
      ? deps.supabase.from("live_destinations").update(basePayload).eq("id", existing.id).select("*").single()
      : deps.supabase.from("live_destinations").insert(basePayload).select("*").single();
    const { data: saved, error: saveError } = await upsertQuery;
    if (saveError || !saved) return json(500, { error: saveError?.message || "Unable to save destination." });
    let destination = saved as DestinationRow;

    if (destination.enabled) {
      const adapter = createProviderAdapter(session.provider);
      const streamKey = incomingStreamKey || (await readSecretRef(deps.supabase, destination.stream_key_secret_ref, deps.encryptionKey));
      try {
        const output = await adapter.createOrUpdateOutput({
          session,
          destination,
          streamKey
        });
        const { data: updated } = await deps.supabase
          .from("live_destinations")
          .update({
            provider_output_id: output.outputId,
            status: output.status,
            last_success_at: now(),
            destination_heartbeat_at: now(),
            last_error: null
          })
          .eq("id", destination.id)
          .select("*")
          .single();
        if (updated) destination = updated as DestinationRow;
      } catch (error) {
        await deps.supabase
          .from("live_destinations")
          .update({
            status: "ERROR",
            last_error: error instanceof Error ? error.message : "Provider output sync failed."
          })
          .eq("id", destination.id);
      }
    }

    await insertAudit(deps.supabase, actor.id, "live_destination_upserted", "live_destination", destination.id, {
      session_id: session.id,
      provider: destination.provider,
      enabled: destination.enabled
    });

    return json(200, { ok: true, destination });
  };

  const routeSessionSync = async (req: Request, body: SessionMutationPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });
    const sessionId = asText(body.sessionId);
    if (!sessionId) return json(400, { error: "sessionId is required." });

    const session = await loadAccessibleSession(deps.supabase, sessionId, actor.id);
    if (!session) return json(404, { error: "Session not found." });

    const adapter = createProviderAdapter(session.provider);
    if (!adapter.getIngestStatus) {
      return json(200, { ok: true, session, idempotent: true });
    }

    try {
      const status = await adapter.getIngestStatus({ session });
      const patch: Record<string, unknown> = {
        ingest_status: parseIngestStatus(status.ingestStatus),
        ingest_last_heartbeat_at: status.heartbeatAt || now()
      };
      if (status.ingestStatus === "LIVE") {
        patch.last_webhook_at = now();
      }
      const { data: updated, error } = await deps.supabase
        .from("live_sessions")
        .update(patch)
        .eq("id", session.id)
        .select("*")
        .single();
      if (error || !updated) return json(500, { error: error?.message || "Unable to sync session." });
      return json(200, { ok: true, session: updated });
    } catch (error) {
      await deps.supabase
        .from("live_sessions")
        .update({
          ingest_status: "ERROR"
        })
        .eq("id", session.id);
      return json(502, { error: error instanceof Error ? error.message : "Provider sync failed." });
    }
  };

  const routeSessionStart = async (req: Request, body: SessionMutationPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });
    const sessionId = asText(body.sessionId);
    if (!sessionId) return json(400, { error: "sessionId is required." });
    const session = await loadAccessibleSession(deps.supabase, sessionId, actor.id);
    if (!session) return json(404, { error: "Session not found." });

    if (session.status === "LIVE") return json(200, { ok: true, session, idempotent: true });
    if (session.status === "ENDED") return json(409, { error: "Session is already ended." });

    let next: SessionStatus;
    try {
      next = applySessionTransition(session.status, "LIVE");
    } catch (error) {
      return json(409, { error: error instanceof Error ? error.message : "Invalid state transition." });
    }

    const { data: updatedSession, error: updateError } = await deps.supabase
      .from("live_sessions")
      .update({
        status: next,
        started_at: session.started_at || now(),
        ingest_status: "CONNECTING"
      })
      .eq("id", session.id)
      .select("*")
      .single();
    if (updateError || !updatedSession) return json(500, { error: updateError?.message || "Unable to start session." });

    const destinations = await loadDestinations(deps.supabase, session.id);
    const adapter = createProviderAdapter(session.provider);
    for (const destination of destinations) {
      if (!destination.enabled || !destination.provider_output_id) continue;
      try {
        await adapter.setOutputEnabled({
          session: updatedSession as LiveSessionRow,
          destination,
          enabled: true
        });
        await deps.supabase
          .from("live_destinations")
          .update({
            status: "CONNECTING",
            last_error: null,
            destination_heartbeat_at: now()
          })
          .eq("id", destination.id);
      } catch (error) {
        await deps.supabase
          .from("live_destinations")
          .update({
            status: "ERROR",
            last_error: error instanceof Error ? error.message : "Unable to enable output."
          })
          .eq("id", destination.id);
      }
    }

    await insertAudit(deps.supabase, actor.id, "live_session_started", "live_session", session.id, {});
    return json(200, { ok: true, session: updatedSession });
  };

  const routeSessionDelete = async (req: Request, body: SessionMutationPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });
    const sessionId = asText(body.sessionId);
    if (!sessionId) return json(400, { error: "sessionId is required." });

    const session = await loadAccessibleSession(deps.supabase, sessionId, actor.id);
    if (!session) return json(404, { error: "Session not found." });
    if (session.status === "LIVE") {
      return json(409, { error: "End the session before deleting it." });
    }

    const destinations = await loadDestinations(deps.supabase, session.id);
    const adapter = createProviderAdapter(session.provider);
    try {
      for (const destination of destinations) {
        if (destination.provider_output_id && adapter.deleteOutput) {
          await adapter.deleteOutput({
            session,
            destination
          });
        }
      }
      if (session.provider_input_id && adapter.deleteLiveInput) {
        await adapter.deleteLiveInput({ session });
      }
    } catch (error) {
      return json(502, {
        error: error instanceof Error ? error.message : "Unable to clean up provider resources before deleting session."
      });
    }

    const secretRefs = Array.from(
      new Set(
        [
          session.ingest_stream_key_secret_ref,
          ...destinations.map((destination) => destination.stream_key_secret_ref)
        ].filter(Boolean)
      )
    ) as string[];

    const { error: deleteError } = await deps.supabase
      .from("live_sessions")
      .delete()
      .eq("id", session.id);
    if (deleteError) return json(500, { error: deleteError.message || "Unable to delete session." });

    if (secretRefs.length) {
      await deps.supabase.from("secret_store").delete().in("id", secretRefs);
    }

    await insertAudit(deps.supabase, actor.id, "live_session_deleted", "live_session", session.id, {
      provider: session.provider,
      destination_count: destinations.length
    });
    return json(200, { ok: true, deleted: true, sessionId: session.id });
  };

  const routeSessionEnd = async (req: Request, body: SessionMutationPayload) => {
    const actor = await getActor(deps.supabase, req);
    if (!actor) return json(401, { error: "Unauthorized." });
    const sessionId = asText(body.sessionId);
    if (!sessionId) return json(400, { error: "sessionId is required." });
    const session = await loadAccessibleSession(deps.supabase, sessionId, actor.id);
    if (!session) return json(404, { error: "Session not found." });
    if (session.status === "ENDED") return json(200, { ok: true, session, idempotent: true });

    let next: SessionStatus;
    try {
      next = applySessionTransition(session.status, "ENDED");
    } catch (error) {
      return json(409, { error: error instanceof Error ? error.message : "Invalid state transition." });
    }

    const { data: updatedSession, error: updateError } = await deps.supabase
      .from("live_sessions")
      .update({
        status: next,
        ended_at: session.ended_at || now(),
        ingest_status: "IDLE"
      })
      .eq("id", session.id)
      .select("*")
      .single();
    if (updateError || !updatedSession) return json(500, { error: updateError?.message || "Unable to end session." });

    const destinations = await loadDestinations(deps.supabase, session.id);
    const adapter = createProviderAdapter(session.provider);
    for (const destination of destinations) {
      if (destination.provider_output_id) {
        try {
          await adapter.setOutputEnabled({
            session: updatedSession as LiveSessionRow,
            destination,
            enabled: false
          });
        } catch {
          // Preserve end flow even when provider disable fails.
        }
      }
      await deps.supabase
        .from("live_destinations")
        .update({
          status: "DISABLED",
          enabled: false,
          destination_heartbeat_at: now()
        })
        .eq("id", destination.id);
    }

    await insertAudit(deps.supabase, actor.id, "live_session_ended", "live_session", session.id, {});
    return json(200, { ok: true, session: updatedSession });
  };

  const routeWebhook = async (req: Request, rawBody: string) => {
    const webhookSecret = Deno.env.get("LIVE_WEBHOOK_SECRET") || "";
    const verified = await verifyWebhookSignature(
      req.headers.get("x-live-signature"),
      rawBody,
      webhookSecret
    );
    if (!verified) return json(401, { error: "Invalid webhook signature." });

    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const provider = isSessionProvider(body.provider) ? body.provider : "cloudflare_stream";
    const adapter = createProviderAdapter(provider);
    const mapped = adapter.mapWebhookToStatus(body);
    if (!mapped) return json(200, { ok: true, ignored: true });

    const patch: Record<string, unknown> = {
      last_webhook_at: now()
    };
    if (mapped.ingestStatus) {
      patch.ingest_status = parseIngestStatus(mapped.ingestStatus);
      patch.ingest_last_heartbeat_at = mapped.destinationHeartbeatAt || now();
    }
    if (mapped.sessionId && Object.keys(patch).length >= 1) {
      await deps.supabase.from("live_sessions").update(patch).eq("id", mapped.sessionId);
    }

    if (mapped.destinationOutputId) {
      await deps.supabase
        .from("live_destinations")
        .update({
          status: mapped.destinationStatus ? parseDestinationStatus(mapped.destinationStatus) : "CONNECTING",
          last_error: mapped.destinationError || null,
          last_success_at: mapped.destinationStatus === "LIVE" ? now() : null,
          destination_heartbeat_at: mapped.destinationHeartbeatAt || now()
        })
        .eq("provider_output_id", mapped.destinationOutputId);
    }

    return json(200, { ok: true });
  };

  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "Method not allowed." });
    if (!deps.encryptionKey) return json(500, { error: "Missing LIVE_SECRET_ENCRYPTION_KEY runtime secret." });

    const route = resolveRoute(new URL(req.url).pathname);
    try {
      const rawBody = await req.text();
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
      } catch {
        return json(400, { error: "Invalid JSON payload." });
      }

      if (route === "session.create") return routeSessionCreate(req, body);
      if (route === "public.status") return routePublicStatus();
      if (route === "session.delete") return routeSessionDelete(req, body);
      if (route === "session.sync") return routeSessionSync(req, body);
      if (route === "destination.upsert") return routeDestinationUpsert(req, body);
      if (route === "session.start") return routeSessionStart(req, body);
      if (route === "session.end") return routeSessionEnd(req, body);
      if (route === "webhook") return routeWebhook(req, rawBody);

      return json(404, { error: "Unknown live route." });
    } catch (error) {
      return json(500, {
        error: error instanceof Error ? error.message : "Unhandled live function error."
      });
    }
  };
};
