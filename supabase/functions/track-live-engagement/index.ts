import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const pixelBytes = Uint8Array.from(
  atob("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs="),
  (char) => char.charCodeAt(0)
);

const parseDispatchId = (value: string | null) => {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const safeUrl = (value: string | null) => {
  if (!value) return "https://theperforma.com/live";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // ignore
  }
  return "https://theperforma.com/live";
};

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const url = new URL(req.url);
  const eventType = url.searchParams.get("event");
  const dispatchId = parseDispatchId(url.searchParams.get("dispatch_id"));
  const recipient = (url.searchParams.get("recipient") || "").slice(0, 180);
  const target = safeUrl(url.searchParams.get("url"));

  if ((eventType !== "open" && eventType !== "click") || !dispatchId) {
    return new Response("Bad request", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await supabase.from("fan_live_engagement_events").insert({
    dispatch_id: dispatchId,
    event_type: eventType,
    recipient: recipient || null,
    metadata: {
      user_agent: req.headers.get("user-agent") || "",
      referer: req.headers.get("referer") || ""
    }
  });

  if (eventType === "click") {
    return Response.redirect(target, 302);
  }

  return new Response(pixelBytes, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0"
    }
  });
});

