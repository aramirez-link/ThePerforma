import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createProviderAdapter } from "./_shared/provider.ts";

Deno.test("provider factory falls back to mock when Cloudflare credentials are missing", async () => {
  const adapter = createProviderAdapter("cloudflare_stream");
  const input = await adapter.createLiveInput({
    sessionId: "11111111-2222-3333-4444-555555555555",
    title: "Session"
  });
  assertEquals(input.ingestType, "rtmp");
  assertEquals(input.ingestUrl.startsWith("rtmp://"), true);
});

Deno.test("mock webhook mapper returns status payload when provided", () => {
  const adapter = createProviderAdapter("livepeer_studio");
  const mapped = adapter.mapWebhookToStatus({
    sessionId: "session-1",
    ingestStatus: "LIVE",
    destinationOutputId: "output-1",
    destinationStatus: "LIVE"
  });
  assertEquals(mapped?.sessionId, "session-1");
  assertEquals(mapped?.destinationOutputId, "output-1");
});

