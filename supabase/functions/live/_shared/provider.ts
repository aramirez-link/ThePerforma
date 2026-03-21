import { createCloudflareAdapter } from "./provider.cloudflare.ts";
import type { DestinationStatus, LiveProvider, LiveProviderAdapter } from "./types.ts";

const inferFromBool = (enabled: boolean): DestinationStatus => (enabled ? "CONNECTING" : "DISABLED");

const createMockAdapter = (): LiveProviderAdapter => ({
  async createLiveInput({ sessionId }) {
    const short = sessionId.slice(0, 8);
    return {
      inputId: `mock-input-${short}`,
      playbackId: `mock-playback-${short}`,
      ingestType: "rtmp",
      ingestUrl: "rtmp://live.mock.performa/app",
      streamKey: `mk_${crypto.randomUUID().replace(/-/g, "")}`
    };
  },
  async createOrUpdateOutput({ destination }) {
    return {
      outputId: destination.provider_output_id || `mock-output-${crypto.randomUUID().slice(0, 8)}`,
      status: inferFromBool(destination.enabled)
    };
  },
  async setOutputEnabled() {
    return { ok: true as const };
  },
  async deleteOutput() {
    return { ok: true as const };
  },
  async deleteLiveInput() {
    return { ok: true as const };
  },
  mapWebhookToStatus(payload) {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    return {
      sessionId: body.sessionId ? String(body.sessionId) : undefined,
      ingestStatus: body.ingestStatus ? String(body.ingestStatus).toUpperCase() as any : undefined,
      destinationOutputId: body.destinationOutputId ? String(body.destinationOutputId) : undefined,
      destinationStatus: body.destinationStatus ? String(body.destinationStatus).toUpperCase() as any : undefined,
      destinationError: body.destinationError ? String(body.destinationError) : null,
      destinationHeartbeatAt: new Date().toISOString()
    };
  }
});

export const createProviderAdapter = (provider: LiveProvider): LiveProviderAdapter => {
  if (provider !== "cloudflare_stream") {
    return createMockAdapter();
  }
  const accountId = Deno.env.get("CF_STREAM_ACCOUNT_ID") || "";
  const apiToken = Deno.env.get("CF_STREAM_API_TOKEN") || "";
  if (!accountId || !apiToken) {
    return createMockAdapter();
  }
  return createCloudflareAdapter({ accountId, apiToken });
};
