import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ActionPayload = {
  orderId?: number;
  action?: "refund" | "cancel" | "mark_shipped" | "resend_download_link";
  note?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const stripePost = async (secret: string, path: string, values: Record<string, string>) => {
  const body = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => body.set(key, value));
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
};

const sendResendEmail = async (apiKey: string, from: string, to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html
    })
  });
  return response.ok;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "";
  if (!supabaseUrl || !serviceRole) return json(500, { error: "Missing runtime secrets." });

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return json(401, { error: "Missing bearer token." });

  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) return json(401, { error: "Unauthorized." });

  const { data: adminRow } = await supabase.from("store_admins").select("role").eq("user_id", user.id).maybeSingle();
  if (!adminRow?.role) return json(403, { error: "Store admin access required." });

  const body = (await req.json().catch(() => ({}))) as ActionPayload;
  const orderId = Number(body.orderId || 0);
  const action = body.action;
  if (!orderId || !action) return json(400, { error: "Missing orderId/action." });

  const { data: order, error: orderError } = await supabase.from("store_orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError || !order) return json(404, { error: orderError?.message || "Order not found." });

  const { data: items } = await supabase.from("store_order_items").select("*").eq("order_id", orderId);

  if (action === "refund") {
    if (!stripeSecret) return json(500, { error: "STRIPE_SECRET_KEY not configured." });
    const paymentIntentId = String(order.stripe_payment_intent_id || "");
    if (!paymentIntentId) return json(400, { error: "Order has no Stripe payment intent." });

    const refund = await stripePost(stripeSecret, "/v1/refunds", {
      payment_intent: paymentIntentId
    });
    if (!refund.ok) {
      return json(400, { error: String(refund.data?.error?.message || "Failed to create refund.") });
    }

    await supabase
      .from("store_orders")
      .update({
        status: "refunded"
      })
      .eq("id", orderId);
  }

  if (action === "cancel") {
    if (order.status === "pending" && stripeSecret && order.stripe_checkout_session_id) {
      await stripePost(stripeSecret, `/v1/checkout/sessions/${encodeURIComponent(String(order.stripe_checkout_session_id))}/expire`, {});
    }

    await supabase
      .from("store_orders")
      .update({
        status: "cancelled",
        cancel_reason: body.note || "Cancelled by admin"
      })
      .eq("id", orderId);
  }

  if (action === "mark_shipped") {
    await supabase
      .from("store_orders")
      .update({
        status: "fulfilled",
        shipped_at: new Date().toISOString(),
        fulfilled_at: new Date().toISOString(),
        tracking_number: body.trackingNumber || order.tracking_number || null,
        shipping_carrier: body.shippingCarrier || order.shipping_carrier || null
      })
      .eq("id", orderId);
  }

  if (action === "resend_download_link") {
    const email = String(order.stripe_customer_email || "").trim().toLowerCase();
    if (!email) return json(400, { error: "Order has no customer email." });
    if (!resendApiKey || !resendFrom) return json(500, { error: "Resend is not configured." });

    const digitalLines = (items || []).filter((item: any) => item.delivery_url);
    if (!digitalLines.length) return json(400, { error: "No digital links are stored for this order." });

    const links = digitalLines
      .map(
        (line: any) =>
          `<li><strong>${String(line.title || "Digital item")}</strong>: <a href="${String(line.delivery_url)}">Open private access link</a></li>`
      )
      .join("");

    const sent = await sendResendEmail(
      resendApiKey,
      resendFrom,
      email,
      `Your digital access links - Order #${orderId}`,
      `<p>Here are your private digital access links for The Performa order #${orderId}.</p><ul>${links}</ul><p>If you have trouble accessing, reply to this email.</p>`
    );
    if (!sent) return json(500, { error: "Failed to resend digital links." });
  }

  await supabase.from("store_order_events").insert({
    order_id: orderId,
    actor_user_id: user.id,
    action,
    details: {
      note: body.note || "",
      tracking_number: body.trackingNumber || ""
    }
  });

  return json(200, { ok: true });
});
