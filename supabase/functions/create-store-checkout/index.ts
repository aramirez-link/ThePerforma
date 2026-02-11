import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type CheckoutItem = {
  variantId: string;
  quantity: number;
};

type CheckoutPayload = {
  items?: CheckoutItem[];
  promoCode?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const toStripeForm = (payload: Record<string, string>) => {
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => form.set(key, value));
  return form;
};

const stripeRequest = async (secret: string, path: string, body?: URLSearchParams) => {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const getPromotionCodeId = async (secret: string, code: string) => {
  const clean = code.trim();
  if (!clean) return "";
  const result = await stripeRequest(secret, `/v1/promotion_codes?active=true&code=${encodeURIComponent(clean)}&limit=1`);
  if (!result.ok || !Array.isArray(result.data?.data) || !result.data.data[0]?.id) return "";
  return String(result.data.data[0].id);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!supabaseUrl || !serviceRole || !stripeSecret) {
    return json(500, { error: "Missing runtime secrets." });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return json(401, { error: "Fan Vault login is required for checkout." });

  let userId: string | null = null;
  let authEmail = "";

  const { data: userData } = await supabase.auth.getUser(token);
  if (userData.user) {
    userId = userData.user.id;
    authEmail = userData.user.email || "";
  }
  if (!userId) return json(401, { error: "Fan Vault login is required for checkout." });

  const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
  const items = Array.isArray(body.items) ? body.items : [];
  const successUrl = String(body.successUrl || "").trim();
  const cancelUrl = String(body.cancelUrl || "").trim();
  const promoCode = String(body.promoCode || "").trim();
  const customerEmail = String(body.customerEmail || authEmail || "").trim().toLowerCase();

  if (!items.length) return json(400, { error: "Cart is empty." });
  if (!successUrl || !cancelUrl) return json(400, { error: "Missing success/cancel URLs." });

  const variantIds = [...new Set(items.map((item) => String(item.variantId || "").trim()).filter(Boolean))];
  if (!variantIds.length) return json(400, { error: "Invalid cart items." });

  const { data: variants, error: variantError } = await supabase
    .from("store_product_variants")
    .select("id,product_id,sku,title,price_cents,inventory_mode,inventory_count,attributes,digital_delivery_url,is_active,store_products(id,name,description,product_type,status,currency)")
    .in("id", variantIds);

  if (variantError) return json(400, { error: variantError.message });

  const variantMap = new Map<string, any>();
  for (const row of variants || []) variantMap.set(String(row.id), row);

  const lines = items
    .map((item) => ({
      variantId: String(item.variantId || ""),
      quantity: Math.max(1, Math.round(Number(item.quantity || 1)))
    }))
    .filter((item) => variantMap.has(item.variantId));

  if (!lines.length) return json(400, { error: "No purchasable items found." });

  let containsSubscription = false;
  let containsOneTime = false;

  for (const line of lines) {
    const row = variantMap.get(line.variantId);
    const product = row?.store_products;
    if (!row?.is_active || !product || product.status !== "active") {
      return json(400, { error: "One or more items are not available." });
    }
    if (row.inventory_mode === "finite" && row.inventory_count != null && Number(row.inventory_count) < line.quantity) {
      return json(400, { error: `Insufficient stock for ${product.name} (${row.title}).` });
    }

    if (product.product_type === "subscription") containsSubscription = true;
    else containsOneTime = true;
  }

  if (containsSubscription && containsOneTime) {
    return json(400, { error: "Subscriptions must be checked out separately from one-time items." });
  }

  const mode = containsSubscription ? "subscription" : "payment";
  const stripePayload: Record<string, string> = {
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "automatic_tax[enabled]": "true",
    "allow_promotion_codes": "true",
    "metadata[source]": "the-performa-store"
  };

  if (customerEmail) stripePayload.customer_email = customerEmail;
  if (userId) stripePayload["client_reference_id"] = userId;

  let subtotal = 0;

  lines.forEach((line, index) => {
    const row = variantMap.get(line.variantId);
    const product = row.store_products;
    const amount = Number(row.price_cents || 0);
    const currency = String(product.currency || "usd").toLowerCase();
    const quantity = Math.max(1, line.quantity);
    subtotal += amount * quantity;

    stripePayload[`line_items[${index}][quantity]`] = String(quantity);
    stripePayload[`line_items[${index}][price_data][currency]`] = currency;
    stripePayload[`line_items[${index}][price_data][unit_amount]`] = String(amount);
    stripePayload[`line_items[${index}][price_data][product_data][name]`] = `${product.name} - ${row.title}`;
    stripePayload[`line_items[${index}][price_data][product_data][description]`] = String(product.description || "");
    stripePayload[`line_items[${index}][price_data][product_data][metadata][product_id]`] = String(product.id);
    stripePayload[`line_items[${index}][price_data][product_data][metadata][variant_id]`] = String(row.id);
    stripePayload[`line_items[${index}][price_data][product_data][metadata][sku]`] = String(row.sku || "");
    stripePayload[`line_items[${index}][price_data][tax_behavior]`] = "exclusive";
    if (mode === "subscription") {
      const interval = String(row?.attributes?.interval || "month");
      stripePayload[`line_items[${index}][price_data][recurring][interval]`] =
        interval === "year" ? "year" : interval === "week" ? "week" : interval === "day" ? "day" : "month";
    }
  });

  if (promoCode) {
    const promotionCodeId = await getPromotionCodeId(stripeSecret, promoCode);
    if (promotionCodeId) {
      stripePayload["discounts[0][promotion_code]"] = promotionCodeId;
    }
  }

  const sessionResult = await stripeRequest(stripeSecret, "/v1/checkout/sessions", toStripeForm(stripePayload));
  if (!sessionResult.ok || !sessionResult.data?.id || !sessionResult.data?.url) {
    return json(400, { error: String(sessionResult.data?.error?.message || "Unable to create Stripe checkout session.") });
  }

  await supabase.from("store_orders").insert({
    user_id: userId,
    stripe_checkout_session_id: String(sessionResult.data.id),
    stripe_customer_email: customerEmail || null,
    status: "pending",
    currency: lines.length ? String(variantMap.get(lines[0].variantId)?.store_products?.currency || "usd") : "usd",
    subtotal_cents: subtotal,
    metadata: {
      mode,
      cart: lines
    }
  });

  return json(200, {
    ok: true,
    checkoutSessionId: String(sessionResult.data.id),
    checkoutUrl: String(sessionResult.data.url)
  });
});
