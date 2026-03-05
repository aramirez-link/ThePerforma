import type {
  DestinationRow,
  DestinationStatus,
  LiveProviderAdapter,
  LiveSessionRow,
  ProviderInput,
  ProviderOutput,
  WebhookStatusUpdate
} from "./types.ts";

type CloudflareConfig = {
  accountId: string;
  apiToken: string;
};

type CloudflareApiResponse<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

const CF_ROOT = "https://api.cloudflare.com/client/v4";

const assertSuccess = <T>(payload: CloudflareApiResponse<T>) => {
  if (!payload.success || !payload.result) {
    const reason = payload.errors?.[0]?.message || "Cloudflare API call failed.";
    throw new Error(reason);
  }
  return payload.result;
};

const cfFetch = async <T>(
  cfg: CloudflareConfig,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(`${CF_ROOT}/accounts/${cfg.accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as CloudflareApiResponse<T>;
  return assertSuccess(payload);
};

const inferDestinationStatus = (state: string | undefined): DestinationStatus => {
  const value = String(state || "").toLowerCase();
  if (value.includes("connected") || value === "live") return "LIVE";
  if (value.includes("error") || value.includes("failed")) return "ERROR";
  if (value.includes("disabled")) return "DISABLED";
  return "CONNECTING";
};

export const createCloudflareAdapter = (cfg: CloudflareConfig): LiveProviderAdapter => {
  const createLiveInput = async (args: { sessionId: string; title: string }): Promise<ProviderInput> => {
    const result = await cfFetch<{
      uid: string;
      rtmps?: { url?: string; streamKey?: string };
      webRTC?: { url?: string };
      playback?: { hls?: string; dash?: string };
    }>(cfg, "/stream/live_inputs", {
      method: "POST",
      body: JSON.stringify({
        meta: {
          session_id: args.sessionId,
          title: args.title
        },
        recording: { mode: "off" }
      })
    });

    const ingestUrl = String(result.rtmps?.url || "").trim();
    const streamKey = String(result.rtmps?.streamKey || "").trim();
    if (!ingestUrl || !streamKey || !result.uid) {
      throw new Error("Cloudflare did not return RTMP ingest details.");
    }
    return {
      inputId: result.uid,
      playbackId: result.uid,
      ingestType: "rtmp",
      ingestUrl,
      streamKey
    };
  };

  const createOrUpdateOutput = async (args: {
    session: LiveSessionRow;
    destination: DestinationRow;
    streamKey: string;
  }): Promise<ProviderOutput> => {
    if (!args.session.provider_input_id) {
      throw new Error("Session is missing provider input id.");
    }
    const endpoint = `/stream/live_inputs/${encodeURIComponent(args.session.provider_input_id)}/outputs`;
    if (args.destination.provider_output_id) {
      const result = await cfFetch<{ uid: string; enabled?: boolean; status?: string }>(
        cfg,
        `${endpoint}/${encodeURIComponent(args.destination.provider_output_id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            url: args.destination.rtmp_url,
            streamKey: args.streamKey,
            enabled: args.destination.enabled
          })
        }
      );
      return {
        outputId: result.uid,
        status: result.enabled === false ? "DISABLED" : inferDestinationStatus(result.status)
      };
    }

    const result = await cfFetch<{ uid: string; enabled?: boolean; status?: string }>(cfg, endpoint, {
      method: "POST",
      body: JSON.stringify({
        url: args.destination.rtmp_url,
        streamKey: args.streamKey,
        enabled: args.destination.enabled
      })
    });
    return {
      outputId: result.uid,
      status: result.enabled === false ? "DISABLED" : inferDestinationStatus(result.status)
    };
  };

  const setOutputEnabled = async (args: {
    session: LiveSessionRow;
    destination: DestinationRow;
    enabled: boolean;
  }) => {
    if (!args.session.provider_input_id || !args.destination.provider_output_id) {
      return { ok: true as const };
    }
    await cfFetch(
      cfg,
      `/stream/live_inputs/${encodeURIComponent(args.session.provider_input_id)}/outputs/${encodeURIComponent(args.destination.provider_output_id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          enabled: args.enabled
        })
      }
    );
    return { ok: true as const };
  };

  const mapWebhookToStatus = (payload: unknown): WebhookStatusUpdate | null => {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const sessionId = body.sessionId ? String(body.sessionId) : undefined;
    const destinationOutputId = body.outputId ? String(body.outputId) : undefined;
    const ingestState = String(body.ingestStatus || body.inputStatus || "").toLowerCase();
    const outputState = String(body.outputStatus || "").toLowerCase();

    const ingestStatus =
      ingestState === "live"
        ? "LIVE"
        : ingestState.includes("error")
        ? "ERROR"
        : ingestState
        ? "CONNECTING"
        : undefined;

    const destinationStatus = outputState
      ? inferDestinationStatus(outputState)
      : undefined;

    if (!sessionId && !destinationOutputId) return null;
    return {
      sessionId,
      ingestStatus,
      destinationOutputId,
      destinationStatus,
      destinationError:
        destinationStatus === "ERROR" ? String(body.error || body.reason || "Provider reported an error.") : null,
      destinationHeartbeatAt: new Date().toISOString()
    };
  };

  return {
    createLiveInput,
    createOrUpdateOutput,
    setOutputEnabled,
    mapWebhookToStatus
  };
};

