export type SessionStatus = "DRAFT" | "READY" | "LIVE" | "ENDED";
export type IngestStatus = "IDLE" | "CONNECTING" | "LIVE" | "ERROR";
export type DestinationStatus = "DISABLED" | "CONNECTING" | "LIVE" | "ERROR";
export type IngestType = "rtmp" | "webrtc" | "srt";
export type LiveProvider = "cloudflare_stream" | "livepeer_studio";
export type DestinationProvider = "twitch" | "facebook" | "instagram_manual" | "custom_rtmp";

export type LiveSessionRow = {
  id: string;
  creator_id: string;
  title: string;
  status: SessionStatus;
  provider: LiveProvider;
  provider_input_id: string | null;
  provider_playback_id: string | null;
  ingest_type: IngestType;
  ingest_url: string | null;
  webrtc_publish_url?: string | null;
  webrtc_playback_url?: string | null;
  srt_ingest_url?: string | null;
  srt_stream_id?: string | null;
  ingest_stream_key_secret_ref: string | null;
  ingest_status: IngestStatus;
  last_webhook_at: string | null;
  ingest_last_heartbeat_at: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  scheduled_for: string | null;
};

export type DestinationRow = {
  id: string;
  session_id: string;
  provider: DestinationProvider;
  display_name: string;
  enabled: boolean;
  status: DestinationStatus;
  rtmp_url: string;
  stream_key_secret_ref: string;
  provider_output_id: string | null;
  last_error: string | null;
  last_success_at: string | null;
  destination_heartbeat_at: string | null;
  created_at: string;
};

export type SecretCipherPayload = {
  alg: "A256GCM";
  iv: string;
  ciphertext: string;
  createdAt: string;
};

export type ProviderInput = {
  inputId: string;
  playbackId?: string | null;
  ingestType: IngestType;
  ingestUrl: string;
  streamKey: string;
  webrtcPublishUrl?: string | null;
  webrtcPlaybackUrl?: string | null;
  srtIngestUrl?: string | null;
  srtStreamId?: string | null;
};

export type ProviderOutput = {
  outputId: string;
  status: DestinationStatus;
};

export type WebhookStatusUpdate = {
  sessionId?: string;
  ingestStatus?: IngestStatus;
  destinationOutputId?: string;
  destinationStatus?: DestinationStatus;
  destinationError?: string | null;
  destinationHeartbeatAt?: string | null;
};

export type LiveProviderAdapter = {
  createLiveInput: (args: { sessionId: string; title: string }) => Promise<ProviderInput>;
  createRealtimeInput?: (args: {
    sessionId: string;
    title: string;
    ingestType: Exclude<IngestType, "rtmp">;
  }) => Promise<ProviderInput>;
  createOrUpdateOutput: (args: {
    session: LiveSessionRow;
    destination: DestinationRow;
    streamKey: string;
  }) => Promise<ProviderOutput>;
  setOutputEnabled: (args: {
    session: LiveSessionRow;
    destination: DestinationRow;
    enabled: boolean;
  }) => Promise<{ ok: true }>;
  deleteOutput?: (args: {
    session: LiveSessionRow;
    destination: DestinationRow;
  }) => Promise<{ ok: true }>;
  deleteLiveInput?: (args: {
    session: LiveSessionRow;
  }) => Promise<{ ok: true }>;
  getIngestStatus?: (args: {
    session: LiveSessionRow;
  }) => Promise<{ ingestStatus: IngestStatus; heartbeatAt?: string | null }>;
  mapWebhookToStatus: (payload: unknown) => WebhookStatusUpdate | null;
};
