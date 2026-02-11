import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

const stripeGet = async (secret: string, path: string) => {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
};

const verifyStripeSignature = async (body: string, signatureHeader: string, signingSecret: string) => {
  const parts = signatureHeader.split(",").map((item) => item.trim());
  const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || !signatures.length) return false;

  const signedPayload = `${timestamp}.${body}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signedPayload));
  const expected = toHex(new Uint8Array(digest));
  return signatures.some((value) => safeEqual(value, expected));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!supabaseUrl || !serviceRole || !stripeSecret || !webhookSecret) {
    return json(500, { error: "Missing runtime secrets." });
  }

  const signature = req.headers.get("stripe-signature") || "";
  const body = await req.text();
  const valid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!valid) return json(401, { error: "Invalid Stripe signature." });

  const event = JSON.parse(body);
  const type = String(event?.type || "");
  const data = event?.data?.object || {};

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (type === "checkout.session.completed") {
    const sessionId = String(data.id || "");
    if (!sessionId) return json(400, { error: "Missing session id." });

    const checkoutStatus = String(data.payment_status || "unpaid");
    const mode = String(data.mode || "payment");
    const customerEmail = String(data.customer_details?.email || data.customer_email || "").toLowerCase();
    const userId = data.client_reference_id ? String(data.client_reference_id) : null;
    const currency = String(data.currency || "usd");
    const subtotal = Number(data.amount_subtotal || 0);
    const tax = Number(data.total_details?.amount_tax || 0);
    const shipping = Number(data.total_details?.amount_shipping || 0);
    const total = Number(data.amount_total || 0);
    const sessionStatus = checkoutStatus === "paid" || mode === "subscription" ? "paid" : "pending";

    const { data: existingOrder } = await supabase
      .from("store_orders")
      .select("id,status")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    let orderId = existingOrder?.id ? Number(existingOrder.id) : 0;

    if (orderId) {
      const { data: updatedOrder, error: updateError } = await supabase
        .from("store_orders")
        .update({
          user_id: userId,
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: data.payment_intent ? String(data.payment_intent) : null,
          stripe_customer_id: data.customer ? String(data.customer) : null,
          stripe_customer_email: customerEmail || null,
          status: sessionStatus,
          currency,
          subtotal_cents: subtotal,
          tax_cents: tax,
          shipping_cents: shipping,
          total_cents: total,
          metadata: {
            ...(data.metadata || {}),
            stripe_mode: mode
          }
        })
        .eq("id", orderId)
        .select("id")
        .single();
      if (updateError) return json(500, { error: updateError.message });
      orderId = Number(updatedOrder?.id || orderId);
    } else {
      const { data: insertedOrder, error: insertError } = await supabase
        .from("store_orders")
        .insert({
          user_id: userId,
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: data.payment_intent ? String(data.payment_intent) : null,
          stripe_customer_id: data.customer ? String(data.customer) : null,
          stripe_customer_email: customerEmail || null,
          status: sessionStatus,
          currency,
          subtotal_cents: subtotal,
          tax_cents: tax,
          shipping_cents: shipping,
          total_cents: total,
          metadata: {
            ...(data.metadata || {}),
            stripe_mode: mode
          }
        })
        .select("id")
        .single();
      if (insertError || !insertedOrder?.id) {
        return json(500, { error: insertError?.message || "Failed creating order row." });
      }
      orderId = Number(insertedOrder.id);
    }

    const lineResult = await stripeGet(
      stripeSecret,
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100&expand[]=data.price.product`
    );
    const lineRows = Array.isArray(lineResult.data?.data) ? lineResult.data.data : [];

    const variantIds = lineRows
      .map((line: any) => String(line?.price?.product?.metadata?.variant_id || ""))
      .filter(Boolean);

    let deliveryByVariant = new Map<string, string>();
    if (variantIds.length) {
      const { data: variants } = await supabase
        .from("store_product_variants")
        .select("id,digital_delivery_url")
        .in("id", variantIds);
      deliveryByVariant = new Map((variants || []).map((row: any) => [String(row.id), String(row.digital_delivery_url || "")]));
    }

    await supabase.from("store_order_items").delete().eq("order_id", orderId);

    if (lineRows.length) {
      const purchasedByVariant = new Map<string, number>();
      for (const line of lineRows) {
        const metadata = line?.price?.product?.metadata || {};
        const variantId = String(metadata.variant_id || "");
        if (!variantId) continue;
        const qty = Math.max(1, Number(line.quantity || 1));
        purchasedByVariant.set(variantId, (purchasedByVariant.get(variantId) || 0) + qty);
      }

      if (purchasedByVariant.size) {
        const finiteVariantIds = Array.from(purchasedByVariant.keys());
        const { data: stockRows } = await supabase
          .from("store_product_variants")
          .select("id,inventory_mode,inventory_count")
          .in("id", finiteVariantIds);

        for (const row of stockRows || []) {
          if (row.inventory_mode !== "finite") continue;
          const current = Math.max(0, Number(row.inventory_count || 0));
          const purchased = purchasedByVariant.get(String(row.id)) || 0;
          const next = Math.max(0, current - purchased);
          await supabase
            .from("store_product_variants")
            .update({ inventory_count: next })
            .eq("id", row.id);
        }
      }

      await supabase.from("store_order_items").insert(
        lineRows.map((line: any) => {
          const metadata = line?.price?.product?.metadata || {};
          const variantId = String(metadata.variant_id || "") || null;
          const productId = String(metadata.product_id || "") || null;
          const quantity = Number(line.quantity || 1);
          const unit = Number(line.price?.unit_amount || 0);
          return {
            order_id: orderId,
            product_id: productId,
            variant_id: variantId,
            title: String(line.description || "Store item"),
            variant_title: variantId ? String(line.description || "") : null,
            sku: metadata.sku ? String(metadata.sku) : null,
            quantity,
            unit_price_cents: unit,
            line_total_cents: unit * quantity,
            delivery_url: variantId ? deliveryByVariant.get(variantId) || null : null,
            metadata: {}
          };
        })
      );
    }

    await supabase.from("store_order_events").insert({
      order_id: orderId,
      action: "webhook_checkout_completed",
      details: {
        event_id: String(event.id || ""),
        checkout_status: checkoutStatus
      }
    });

    return json(200, { ok: true });
  }

  if (type === "charge.refunded") {
    const paymentIntentId = String(data.payment_intent || "");
    if (!paymentIntentId) return json(200, { ok: true });

    const amountRefunded = Number(data.amount_refunded || 0);
    const amountCharged = Number(data.amount || 0);
    const nextStatus = amountRefunded >= amountCharged ? "refunded" : "partially_refunded";

    const { data: updatedOrders, error } = await supabase
      .from("store_orders")
      .update({ status: nextStatus })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id");
    if (error) return json(500, { error: error.message });

    if (updatedOrders?.length) {
      await supabase.from("store_order_events").insert(
        updatedOrders.map((row: any) => ({
          order_id: row.id,
          action: "webhook_refund",
          details: {
            event_id: String(event.id || ""),
            payment_intent_id: paymentIntentId,
            amount_refunded: amountRefunded
          }
        }))
      );
    }
    return json(200, { ok: true });
  }

  if (type === "checkout.session.expired") {
    const sessionId = String(data.id || "");
    if (sessionId) {
      const { data: updatedOrders } = await supabase
        .from("store_orders")
        .update({ status: "cancelled", cancel_reason: "checkout_session_expired" })
        .eq("stripe_checkout_session_id", sessionId)
        .eq("status", "pending")
        .select("id");
      if (updatedOrders?.length) {
        await supabase.from("store_order_events").insert(
          updatedOrders.map((row: any) => ({
            order_id: row.id,
            action: "webhook_checkout_expired",
            details: {
              event_id: String(event.id || "")
            }
          }))
        );
      }
    }
    return json(200, { ok: true });
  }

  return json(200, { ok: true, ignored: type });
});
