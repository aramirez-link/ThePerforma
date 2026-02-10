import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type BlastStatus = "live" | "offline" | "test";
type Platform = "youtube" | "instagram" | "facebook" | "twitch" | "multi";

type BlastPayload = {
  status?: BlastStatus;
  title?: string;
  streamUrl?: string;
  platform?: Platform;
  message?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-operator",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const normalizePlatform = (value: unknown): Platform => {
  const input = String(value || "multi").toLowerCase();
  if (input === "youtube" || input === "instagram" || input === "facebook" || input === "twitch" || input === "multi") {
    return input;
  }
  return "multi";
};

const formatPhone = (raw: string) => raw.replace(/[^\d+]/g, "");

const getProjectRef = (supabaseUrl: string) => {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
};

const buildMessage = (payload: Required<BlastPayload>) => {
  if (payload.message?.trim()) return payload.message.trim();
  if (payload.status === "offline") {
    return `Stream closed: ${payload.title}. Replay and clips soon.`;
  }
  if (payload.status === "test") {
    return `Test alert from Chip Lee stream system: ${payload.title}`;
  }
  return `Chip Lee is live now: ${payload.title}. Tap in: ${payload.streamUrl}`;
};

const sendEmailWithResend = async (
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  htmlBuilder: (email: string) => string
) => {
  if (!to.length) return { accepted: 0, errors: [] as string[] };
  const errors: string[] = [];
  let accepted = 0;

  for (const email of to) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html: htmlBuilder(email)
      })
    });

    if (!response.ok) {
      errors.push(`email:${email}`);
      continue;
    }
    accepted += 1;
  }

  return { accepted, errors };
};

const sendSmsWithTwilio = async (
  accountSid: string,
  authToken: string,
  from: string,
  to: string[],
  message: string
) => {
  if (!to.length) return { accepted: 0, errors: [] as string[] };
  const errors: string[] = [];
  let accepted = 0;

  for (const phone of to) {
    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: message
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    if (!response.ok) {
      errors.push(`sms:${phone}`);
      continue;
    }
    accepted += 1;
  }

  return { accepted, errors };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const blastToken = Deno.env.get("LIVE_BLAST_TOKEN");
  const authHeader = req.headers.get("authorization") || "";
  if (!blastToken || authHeader !== `Bearer ${blastToken}`) {
    return json(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json(500, { error: "Missing Supabase env vars in function runtime." });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (req.method === "GET") {
    const { data: dispatches, error } = await supabase
      .from("fan_live_dispatches")
      .select("id,created_at,created_by,status,title,stream_url,platform,email_count,sms_count,metadata")
      .order("id", { ascending: false })
      .limit(25);

    if (error) return json(500, { error: error.message });

    const ids = (dispatches || []).map((item: any) => item.id);
    let engagementRows: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("fan_live_engagement_events")
        .select("dispatch_id,event_type")
        .in("dispatch_id", ids);
      engagementRows = data || [];
    }

    const byDispatch: Record<string, { opens: number; clicks: number }> = {};
    for (const row of engagementRows) {
      const key = String(row.dispatch_id);
      if (!byDispatch[key]) byDispatch[key] = { opens: 0, clicks: 0 };
      if (row.event_type === "open") byDispatch[key].opens += 1;
      if (row.event_type === "click") byDispatch[key].clicks += 1;
    }

    const rows = (dispatches || []).map((item: any) => ({
      ...item,
      opens: byDispatch[String(item.id)]?.opens || 0,
      clicks: byDispatch[String(item.id)]?.clicks || 0
    }));

    return json(200, { ok: true, rows });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") || "";

  const body = (await req.json().catch(() => ({}))) as BlastPayload;
  const status: BlastStatus = body.status === "offline" || body.status === "test" ? body.status : "live";
  const title = String(body.title || "Chip Lee Pop-Up Fan Stream").trim();
  const streamUrl = String(body.streamUrl || "https://theperforma.com/live").trim();
  const platform = normalizePlatform(body.platform);
  const sendEmail = body.sendEmail !== false;
  const sendSms = body.sendSms === true;

  const payload: Required<BlastPayload> = {
    status,
    title,
    streamUrl,
    platform,
    message: body.message || "",
    sendEmail,
    sendSms
  };

  const message = buildMessage(payload);
  const subject = status === "offline" ? `Stream update: ${title}` : `Chip Lee is live: ${title}`;
  const operator = req.headers.get("x-operator") || "manual";

  const { data: dispatchRow } = await supabase
    .from("fan_live_dispatches")
    .insert({
      created_by: operator,
      status,
      title,
      stream_url: streamUrl,
      platform,
      email_count: 0,
      sms_count: 0,
      metadata: {}
    })
    .select("id")
    .single();

  const dispatchId = dispatchRow?.id;
  const projectRef = getProjectRef(supabaseUrl);

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("fan_live_subscriptions")
    .select("user_id,email_alerts,sms_alerts,sms_phone,preferred_platform,fan_profiles(email)")
    .eq("enabled", true);

  if (subscriptionError) {
    return json(500, { error: `Failed loading subscriptions: ${subscriptionError.message}` });
  }

  const emailRecipients = new Set<string>();
  const smsRecipients = new Set<string>();

  for (const row of subscriptions || []) {
    const preferencePlatform = String(row.preferred_platform || "multi").toLowerCase();
    const platformMatches = preferencePlatform === "multi" || platform === "multi" || preferencePlatform === platform;
    if (!platformMatches) continue;

    const profile = (row as any).fan_profiles;
    const email = profile?.email ? String(profile.email).toLowerCase().trim() : "";
    if (sendEmail && row.email_alerts && email) {
      emailRecipients.add(email);
    }

    const phoneRaw = row.sms_phone ? formatPhone(String(row.sms_phone)) : "";
    if (sendSms && row.sms_alerts && phoneRaw) {
      smsRecipients.add(phoneRaw);
    }
  }

  const result = {
    email: { attempted: emailRecipients.size, sent: 0, errors: [] as string[] },
    sms: { attempted: smsRecipients.size, sent: 0, errors: [] as string[] }
  };

  if (sendEmail && emailRecipients.size) {
    if (!resendApiKey || !resendFrom) {
      result.email.errors.push("Resend not configured.");
    } else {
      const delivery = await sendEmailWithResend(
        resendApiKey,
        resendFrom,
        Array.from(emailRecipients),
        subject,
        (email) => {
          const encodedUrl = encodeURIComponent(streamUrl);
          const encodedEmail = encodeURIComponent(email);
          const openPixel = projectRef
            ? `https://${projectRef}.functions.supabase.co/track-live-engagement?event=open&dispatch_id=${dispatchId}&recipient=${encodedEmail}`
            : "";
          const clickUrl = projectRef
            ? `https://${projectRef}.functions.supabase.co/track-live-engagement?event=click&dispatch_id=${dispatchId}&recipient=${encodedEmail}&url=${encodedUrl}`
            : streamUrl;

          return `<p>${message}</p><p><a href="${clickUrl}">Open Stream</a></p>${openPixel ? `<img src="${openPixel}" alt="" width="1" height="1" style="display:block;opacity:0" />` : ""}`;
        }
      );
      result.email.sent = delivery.accepted;
      result.email.errors.push(...delivery.errors);
    }
  }

  if (sendSms && smsRecipients.size) {
    if (!twilioSid || !twilioToken || !twilioFrom) {
      result.sms.errors.push("Twilio not configured.");
    } else {
      const delivery = await sendSmsWithTwilio(
        twilioSid,
        twilioToken,
        twilioFrom,
        Array.from(smsRecipients),
        message
      );
      result.sms.sent = delivery.accepted;
      result.sms.errors.push(...delivery.errors);
    }
  }

  await supabase
    .from("fan_live_dispatches")
    .update({
      email_count: result.email.sent,
      sms_count: result.sms.sent,
      metadata: {
        attempted_email: result.email.attempted,
        attempted_sms: result.sms.attempted,
        errors: [...result.email.errors, ...result.sms.errors]
      }
    })
    .eq("id", dispatchId);

  return json(200, {
    ok: true,
    status,
    title,
    streamUrl,
    platform,
    dispatchId,
    result
  });
});
