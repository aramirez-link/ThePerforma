import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createLiveHandler, resolveRoute, verifyWebhookSignature } from "./handler.ts";

Deno.test("resolveRoute maps supported live subpaths", () => {
  assertEquals(resolveRoute("/live/public.status"), "public.status");
  assertEquals(resolveRoute("/live/session.create"), "session.create");
  assertEquals(resolveRoute("/live/session.sync"), "session.sync");
  assertEquals(resolveRoute("/live/destination.upsert"), "destination.upsert");
  assertEquals(resolveRoute("/live/session.start"), "session.start");
  assertEquals(resolveRoute("/live/session.end"), "session.end");
  assertEquals(resolveRoute("/live/webhook"), "webhook");
  assertEquals(resolveRoute("/live/unknown"), "unknown");
});

Deno.test("verifyWebhookSignature validates HMAC signatures", async () => {
  const body = JSON.stringify({ ok: true });
  const secret = "top-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  assertEquals(await verifyWebhookSignature(signature, body, secret), true);
  assertEquals(await verifyWebhookSignature("invalid", body, secret), false);
});

Deno.test("handler requires auth for session.start route", async () => {
  const handler = createLiveHandler({
    encryptionKey: btoa("12345678901234567890123456789012"),
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: null } })
      }
    } as any
  });

  const response = await handler(
    new Request("https://example.functions.supabase.co/live/session.start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "abc" })
    })
  );
  const payload = await response.json();
  assertEquals(response.status, 401);
  assertEquals(payload.error, "Unauthorized.");
});

Deno.test("handler returns idempotent response when session already LIVE", async () => {
  const mockSession = {
    id: "session-1",
    creator_id: "user-1",
    title: "Live",
    status: "LIVE",
    provider: "cloudflare_stream",
    provider_input_id: "in_1",
    provider_playback_id: "in_1",
    ingest_type: "rtmp",
    ingest_url: "rtmp://x",
    ingest_stream_key_secret_ref: "secret-1",
    ingest_status: "LIVE",
    last_webhook_at: null,
    ingest_last_heartbeat_at: null,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    ended_at: null
  };

  const from = (table: string) => {
    if (table !== "live_sessions") {
      throw new Error("Unexpected table");
    }
    return {
      select() {
        return {
          eq() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: mockSession, error: null })
                };
              }
            };
          }
        };
      }
    };
  };

  const handler = createLiveHandler({
    encryptionKey: btoa("12345678901234567890123456789012"),
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from
    } as any
  });

  const response = await handler(
    new Request("https://example.functions.supabase.co/live/session.start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token"
      },
      body: JSON.stringify({ sessionId: "session-1" })
    })
  );
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.idempotent, true);
});
