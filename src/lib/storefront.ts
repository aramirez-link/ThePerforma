import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type StoreProductType = "physical" | "digital_tool" | "digital_download" | "subscription" | "bundle";
export type StoreProductStatus = "draft" | "active" | "archived";
export type StoreAdminRole = "owner" | "manager" | "support";
export type StoreOrderStatus = "pending" | "paid" | "cancelled" | "refunded" | "fulfilled" | "partially_refunded";

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  product_type: StoreProductType;
  status: StoreProductStatus;
  currency: string;
  base_price_cents: number;
  cover_image: string | null;
  gallery: string[];
  related_product_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoreVariant = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  price_cents: number;
  compare_at_cents: number | null;
  inventory_mode: "finite" | "unlimited";
  inventory_count: number | null;
  weight_grams: number | null;
  attributes: Record<string, unknown>;
  digital_delivery_url: string | null;
  stripe_price_id: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreReview = {
  id: number;
  product_id: string;
  user_id: string | null;
  rating: number;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type StoreOrder = {
  id: number;
  user_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_email: string | null;
  status: StoreOrderStatus;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  fulfilled_at: string | null;
  cancel_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoreOrderItem = {
  id: number;
  order_id: number;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  delivery_url: string | null;
};

export type StoreCartItem = {
  variantId: string;
  quantity: number;
};

export type StorefrontProductView = StoreProduct & {
  variants: StoreVariant[];
  reviews: StoreReview[];
  defaultVariant: StoreVariant | null;
};

export const LOW_STOCK_THRESHOLD = 5;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
export const isStoreCloudEnabled = Boolean(url && anonKey);

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseBrowser = () => {
  if (!isStoreCloudEnabled || !url || !anonKey) return null;
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return supabaseClient;
};

const getProjectRef = () => {
  if (!url) return "";
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
};

const toArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

const mapProduct = (row: any): StoreProduct => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description || "",
  product_type: row.product_type,
  status: row.status,
  currency: row.currency || "usd",
  base_price_cents: Number(row.base_price_cents || 0),
  cover_image: row.cover_image || null,
  gallery: toArray(row.gallery),
  related_product_ids: toArray(row.related_product_ids),
  metadata: (row.metadata || {}) as Record<string, unknown>,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapVariant = (row: any): StoreVariant => ({
  id: row.id,
  product_id: row.product_id,
  sku: row.sku,
  title: row.title,
  price_cents: Number(row.price_cents || 0),
  compare_at_cents: row.compare_at_cents == null ? null : Number(row.compare_at_cents),
  inventory_mode: row.inventory_mode === "finite" ? "finite" : "unlimited",
  inventory_count: row.inventory_count == null ? null : Number(row.inventory_count),
  weight_grams: row.weight_grams == null ? null : Number(row.weight_grams),
  attributes: (row.attributes || {}) as Record<string, unknown>,
  digital_delivery_url: row.digital_delivery_url || null,
  stripe_price_id: row.stripe_price_id || null,
  is_default: Boolean(row.is_default),
  is_active: Boolean(row.is_active),
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapReview = (row: any): StoreReview => ({
  id: Number(row.id),
  product_id: row.product_id,
  user_id: row.user_id || null,
  rating: Number(row.rating || 0),
  title: row.title || "",
  body: row.body || "",
  status: row.status,
  created_at: row.created_at
});

const mapOrder = (row: any): StoreOrder => ({
  id: Number(row.id),
  user_id: row.user_id || null,
  stripe_checkout_session_id: row.stripe_checkout_session_id || null,
  stripe_payment_intent_id: row.stripe_payment_intent_id || null,
  stripe_customer_email: row.stripe_customer_email || null,
  status: row.status,
  currency: row.currency || "usd",
  subtotal_cents: Number(row.subtotal_cents || 0),
  tax_cents: Number(row.tax_cents || 0),
  shipping_cents: Number(row.shipping_cents || 0),
  total_cents: Number(row.total_cents || 0),
  shipping_carrier: row.shipping_carrier || null,
  tracking_number: row.tracking_number || null,
  shipped_at: row.shipped_at || null,
  fulfilled_at: row.fulfilled_at || null,
  cancel_reason: row.cancel_reason || null,
  metadata: (row.metadata || {}) as Record<string, unknown>,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapOrderItem = (row: any): StoreOrderItem => ({
  id: Number(row.id),
  order_id: Number(row.order_id),
  product_id: row.product_id || null,
  variant_id: row.variant_id || null,
  title: row.title,
  variant_title: row.variant_title || null,
  sku: row.sku || null,
  quantity: Number(row.quantity || 1),
  unit_price_cents: Number(row.unit_price_cents || 0),
  line_total_cents: Number(row.line_total_cents || 0),
  delivery_url: row.delivery_url || null
});

export const formatMoney = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2
  }).format((cents || 0) / 100);

export const getSession = async (): Promise<Session | null> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
};

export const getCurrentUser = async () => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
};

export const signInWithMagicLink = async (email: string): Promise<Result<{ sent: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/store` : undefined
    }
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { sent: true } };
};

export const signInWithProvider = async (provider: "google" | "github" | "facebook" | "apple"): Promise<Result<{ redirected: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/admin/store` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo }
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { redirected: true } };
};

export const signOutStore = async () => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
};

const callStoreFunction = async <T>(name: string, body: Record<string, unknown>, withAuth = false): Promise<Result<T>> => {
  const projectRef = getProjectRef();
  if (!projectRef) return { ok: false, error: "Supabase project is not configured." };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const session = await getSession();
  if (withAuth && !session?.access_token) {
    return { ok: false, error: "Please sign in first." };
  }
  if (withAuth && session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`https://${projectRef}.functions.supabase.co/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: String(payload?.error || "Function call failed.") };
  return { ok: true, data: payload as T };
};

export const loadStorefrontProducts = async (): Promise<Result<StorefrontProductView[]>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { data: productRows, error: productError } = await supabase
    .from("store_products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (productError) return { ok: false, error: productError.message };

  const products = (productRows || []).map(mapProduct);
  if (!products.length) return { ok: true, data: [] };

  const ids = products.map((item) => item.id);

  const [{ data: variantRows }, { data: reviewRows }] = await Promise.all([
    supabase.from("store_product_variants").select("*").in("product_id", ids).eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("store_reviews").select("*").in("product_id", ids).eq("status", "approved").order("created_at", { ascending: false })
  ]);

  const variants = (variantRows || []).map(mapVariant);
  const reviews = (reviewRows || []).map(mapReview);

  const groupedVariants = new Map<string, StoreVariant[]>();
  variants.forEach((variant) => {
    const arr = groupedVariants.get(variant.product_id) || [];
    arr.push(variant);
    groupedVariants.set(variant.product_id, arr);
  });

  const groupedReviews = new Map<string, StoreReview[]>();
  reviews.forEach((review) => {
    const arr = groupedReviews.get(review.product_id) || [];
    arr.push(review);
    groupedReviews.set(review.product_id, arr);
  });

  const payload: StorefrontProductView[] = products.map((product) => {
    const productVariants = groupedVariants.get(product.id) || [];
    const defaultVariant = productVariants.find((variant) => variant.is_default) || productVariants[0] || null;
    return {
      ...product,
      variants: productVariants,
      reviews: groupedReviews.get(product.id) || [],
      defaultVariant
    };
  });

  return { ok: true, data: payload };
};

export const createCheckoutSession = async (args: {
  items: StoreCartItem[];
  promoCode?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Result<{ checkoutUrl: string; checkoutSessionId: string }>> =>
  callStoreFunction("create-store-checkout", args, true);

export const getVariantStockState = (variant: StoreVariant) => {
  if (variant.inventory_mode !== "finite") {
    return { outOfStock: false, lowStock: false, remaining: null as number | null };
  }
  const remaining = Math.max(0, Number(variant.inventory_count || 0));
  return {
    outOfStock: remaining <= 0,
    lowStock: remaining > 0 && remaining <= LOW_STOCK_THRESHOLD,
    remaining
  };
};

export const addWishlistItem = async (productId: string): Promise<Result<{ saved: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to save wishlist items." };

  const { error } = await supabase.from("store_wishlists").upsert({
    user_id: user.id,
    product_id: productId
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { saved: true } };
};

export const removeWishlistItem = async (productId: string): Promise<Result<{ removed: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const { error } = await supabase.from("store_wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { removed: true } };
};

export const loadWishlist = async (): Promise<Result<string[]>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const user = await getCurrentUser();
  if (!user) return { ok: true, data: [] };
  const { data, error } = await supabase.from("store_wishlists").select("product_id").eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []).map((row: any) => String(row.product_id)) };
};

export const submitReview = async (args: {
  productId: string;
  rating: number;
  title: string;
  body: string;
}): Promise<Result<{ submitted: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to submit a review." };

  const { error } = await supabase.from("store_reviews").insert({
    product_id: args.productId,
    user_id: user.id,
    rating: Math.min(5, Math.max(1, Math.round(args.rating))),
    title: args.title.trim(),
    body: args.body.trim(),
    status: "pending"
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { submitted: true } };
};

export const isStoreAdmin = async (): Promise<boolean> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase.from("store_admins").select("role").eq("user_id", user.id).maybeSingle();
  return Boolean(data?.role);
};

export const loadAdminSnapshot = async (): Promise<
  Result<{
    products: StoreProduct[];
    variants: StoreVariant[];
    orders: StoreOrder[];
    orderItems: StoreOrderItem[];
    reviews: StoreReview[];
  }>
> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const [{ data: productRows, error: productError }, { data: variantRows, error: variantError }, { data: orderRows, error: orderError }, { data: reviewRows, error: reviewError }] =
    await Promise.all([
      supabase.from("store_products").select("*").order("updated_at", { ascending: false }),
      supabase.from("store_product_variants").select("*").order("updated_at", { ascending: false }),
      supabase.from("store_orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("store_reviews").select("*").order("created_at", { ascending: false }).limit(200)
    ]);

  if (productError) return { ok: false, error: productError.message };
  if (variantError) return { ok: false, error: variantError.message };
  if (orderError) return { ok: false, error: orderError.message };
  if (reviewError) return { ok: false, error: reviewError.message };

  const orders = (orderRows || []).map(mapOrder);
  const orderIds = orders.map((order) => order.id);
  let orderItems: StoreOrderItem[] = [];
  if (orderIds.length) {
    const { data: itemRows, error: itemError } = await supabase
      .from("store_order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("id", { ascending: false });
    if (itemError) return { ok: false, error: itemError.message };
    orderItems = (itemRows || []).map(mapOrderItem);
  }

  return {
    ok: true,
    data: {
      products: (productRows || []).map(mapProduct),
      variants: (variantRows || []).map(mapVariant),
      orders,
      orderItems,
      reviews: (reviewRows || []).map(mapReview)
    }
  };
};

export const upsertProduct = async (product: Partial<StoreProduct> & { name: string; slug: string; product_type: StoreProductType }): Promise<Result<StoreProduct>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const payload = {
    id: product.id,
    slug: product.slug.trim().toLowerCase(),
    name: product.name.trim(),
    description: product.description || "",
    product_type: product.product_type,
    status: product.status || "draft",
    currency: (product.currency || "usd").toLowerCase(),
    base_price_cents: Math.max(0, Math.round(product.base_price_cents || 0)),
    cover_image: product.cover_image || null,
    gallery: product.gallery || [],
    related_product_ids: product.related_product_ids || [],
    metadata: product.metadata || {}
  };

  const query = product.id
    ? supabase.from("store_products").update(payload).eq("id", product.id).select("*").single()
    : supabase.from("store_products").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapProduct(data) };
};

export const upsertVariant = async (
  variant: Partial<StoreVariant> & { product_id: string; sku: string; title: string; price_cents: number }
): Promise<Result<StoreVariant>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const payload = {
    id: variant.id,
    product_id: variant.product_id,
    sku: variant.sku.trim(),
    title: variant.title.trim(),
    price_cents: Math.max(0, Math.round(variant.price_cents)),
    compare_at_cents: variant.compare_at_cents == null ? null : Math.max(0, Math.round(variant.compare_at_cents)),
    inventory_mode: variant.inventory_mode || "unlimited",
    inventory_count: variant.inventory_count == null ? null : Math.max(0, Math.round(variant.inventory_count)),
    weight_grams: variant.weight_grams == null ? null : Math.max(0, Math.round(variant.weight_grams)),
    attributes: variant.attributes || {},
    digital_delivery_url: variant.digital_delivery_url || null,
    stripe_price_id: variant.stripe_price_id || null,
    is_default: Boolean(variant.is_default),
    is_active: variant.is_active !== false,
    metadata: {}
  };

  const query = variant.id
    ? supabase.from("store_product_variants").update(payload).eq("id", variant.id).select("*").single()
    : supabase.from("store_product_variants").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapVariant(data) };
};

export const updateReviewStatus = async (reviewId: number, status: "approved" | "rejected"): Promise<Result<{ updated: true }>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { error } = await supabase.from("store_reviews").update({ status }).eq("id", reviewId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { updated: true } };
};

export const runAdminOrderAction = async (args: {
  orderId: number;
  action: "refund" | "cancel" | "mark_shipped" | "resend_download_link";
  note?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
}): Promise<Result<{ ok: true }>> => callStoreFunction("store-admin-action", args, true);
