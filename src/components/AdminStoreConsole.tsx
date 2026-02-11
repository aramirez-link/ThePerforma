import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getCurrentUser,
  getVariantStockState,
  getSupabaseBrowser,
  isStoreAdmin,
  LOW_STOCK_THRESHOLD,
  loadAdminSnapshot,
  runAdminOrderAction,
  signInWithMagicLink,
  signInWithProvider,
  signOutStore,
  updateReviewStatus,
  upsertProduct,
  upsertVariant,
  type StoreOrderItem,
  type StoreProduct,
  type StoreProductType,
  type StoreReview,
  type StoreVariant
} from "../lib/storefront";

type Snapshot = {
  products: StoreProduct[];
  variants: StoreVariant[];
  orders: any[];
  orderItems: StoreOrderItem[];
  reviews: StoreReview[];
};

const blankProduct = {
  name: "",
  slug: "",
  description: "",
  product_type: "physical" as StoreProductType,
  status: "draft",
  base_price_cents: 0,
  currency: "usd",
  cover_image: ""
};
const ADMIN_NAV_KEY = "the-performa-admin-nav";

export default function AdminStoreConsole() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>({
    products: [],
    variants: [],
    orders: [],
    orderItems: [],
    reviews: []
  });
  const [productForm, setProductForm] = useState(blankProduct);
  const [variantForm, setVariantForm] = useState({
    product_id: "",
    sku: "",
    title: "",
    price_cents: 0,
    inventory_mode: "unlimited" as "finite" | "unlimited",
    inventory_count: 0,
    digital_delivery_url: "",
    is_default: false
  });
  const [selectedProductId, setSelectedProductId] = useState("");

  const refresh = async () => {
    const result = await loadAdminSnapshot();
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setSnapshot(result.data);
  };

  useEffect(() => {
    const run = async () => {
      const user = await getCurrentUser();
      setUserEmail(user?.email || "");
      const admin = await isStoreAdmin();
      setIsAdmin(admin);
      if (typeof window !== "undefined") {
        if (admin) localStorage.setItem(ADMIN_NAV_KEY, "true");
        else localStorage.removeItem(ADMIN_NAV_KEY);
      }
      if (admin) await refresh();
      setLoading(false);
    };
    run();

    const supabase = getSupabaseBrowser();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      void run();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const productsById = useMemo(() => {
    const map = new Map<string, StoreProduct>();
    snapshot.products.forEach((product) => map.set(product.id, product));
    return map;
  }, [snapshot.products]);

  const variantsForSelected = snapshot.variants.filter((variant) => variant.product_id === selectedProductId);

  const orderItemsByOrder = useMemo(() => {
    const map = new Map<number, StoreOrderItem[]>();
    for (const item of snapshot.orderItems) {
      const bucket = map.get(item.order_id) || [];
      bucket.push(item);
      map.set(item.order_id, bucket);
    }
    return map;
  }, [snapshot.orderItems]);

  const lowStockAlerts = useMemo(
    () =>
      snapshot.variants
        .map((variant) => {
          const stock = getVariantStockState(variant);
          return { variant, stock, product: productsById.get(variant.product_id) || null };
        })
        .filter((entry) => entry.variant.inventory_mode === "finite" && (entry.stock.outOfStock || entry.stock.lowStock))
        .sort((a, b) => (a.stock.remaining ?? 9999) - (b.stock.remaining ?? 9999)),
    [productsById, snapshot.variants]
  );

  const sendMagicLink = async () => {
    setBusy(true);
    const result = await signInWithMagicLink(email);
    setBusy(false);
    setNotice(result.ok ? "Check your email for the magic link." : result.error);
  };

  const loginProvider = async (provider: "google" | "github" | "facebook" | "apple") => {
    const result = await signInWithProvider(provider);
    if (!result.ok) setNotice(result.error);
  };

  const createProduct = async () => {
    if (!productForm.name || !productForm.slug) {
      setNotice("Name and slug are required.");
      return;
    }
    setBusy(true);
    const result = await upsertProduct({
      name: productForm.name,
      slug: productForm.slug,
      description: productForm.description,
      product_type: productForm.product_type,
      status: productForm.status as any,
      base_price_cents: Number(productForm.base_price_cents || 0),
      currency: productForm.currency,
      cover_image: productForm.cover_image || null
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Product saved.");
    setProductForm(blankProduct);
    await refresh();
  };

  const createVariant = async () => {
    if (!variantForm.product_id || !variantForm.sku || !variantForm.title) {
      setNotice("Pick product + add SKU and title.");
      return;
    }
    setBusy(true);
    const result = await upsertVariant({
      product_id: variantForm.product_id,
      sku: variantForm.sku,
      title: variantForm.title,
      price_cents: Number(variantForm.price_cents || 0),
      inventory_mode: variantForm.inventory_mode,
      inventory_count: variantForm.inventory_mode === "finite" ? Number(variantForm.inventory_count || 0) : null,
      digital_delivery_url: variantForm.digital_delivery_url || null,
      is_default: variantForm.is_default
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Variant saved.");
    setVariantForm({
      product_id: variantForm.product_id,
      sku: "",
      title: "",
      price_cents: 0,
      inventory_mode: "unlimited",
      inventory_count: 0,
      digital_delivery_url: "",
      is_default: false
    });
    await refresh();
  };

  const orderAction = async (orderId: number, action: "refund" | "cancel" | "mark_shipped" | "resend_download_link") => {
    const tracking = action === "mark_shipped" ? window.prompt("Tracking number (optional):", "") || "" : "";
    const result = await runAdminOrderAction({
      orderId,
      action,
      trackingNumber: tracking || undefined
    });
    setNotice(result.ok ? `Order ${action.replace("_", " ")} complete.` : result.error);
    if (result.ok) await refresh();
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/70">Loading admin console...</p>
        </div>
      </section>
    );
  }

  if (!userEmail) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Store Admin</p>
          <h1 className="mt-2 font-display text-3xl">Sign In</h1>
          <p className="mt-2 text-sm text-white/70">Use a magic link or federated login. Access is restricted to users in `store_admins`.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@theperforma.com"
              className="min-h-11 flex-1 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
            />
            <button type="button" onClick={sendMagicLink} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink">
              {busy ? "Sending..." : "Magic Link"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["google", "github", "facebook", "apple"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => loginProvider(provider)}
                className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/80"
              >
                {provider}
              </button>
            ))}
          </div>
          {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/75">
            Signed in as {userEmail}, but this account is not in `store_admins`.
          </p>
          <button
            type="button"
            onClick={async () => {
              localStorage.removeItem(ADMIN_NAV_KEY);
              await signOutStore();
              window.location.reload();
            }}
            className="mt-4 min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white/80"
          >
            Sign out
          </button>
          {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Store Admin</p>
            <h1 className="mt-2 font-display text-3xl">Commerce Control</h1>
            <p className="mt-1 text-sm text-white/70">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              localStorage.removeItem(ADMIN_NAV_KEY);
              await signOutStore();
              window.location.reload();
            }}
            className="min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white/80"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/15 bg-black/35 p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Inventory Alerts</p>
          <p className="mt-1 text-xs text-white/55">Low stock threshold: {LOW_STOCK_THRESHOLD}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {lowStockAlerts.slice(0, 12).map((entry) => (
              <div key={entry.variant.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-white/90">{entry.product?.name || "Unknown product"}</p>
                <p className="text-xs text-white/65">{entry.variant.title} ({entry.variant.sku})</p>
                <p className={`mt-1 text-xs ${entry.stock.outOfStock ? "text-rose-300" : "text-gold"}`}>
                  {entry.stock.outOfStock ? "Out of stock" : `Low stock: ${entry.stock.remaining} left`}
                </p>
              </div>
            ))}
            {!lowStockAlerts.length && <p className="text-sm text-white/60">No low-stock or out-of-stock alerts.</p>}
          </div>
        </article>

        <article className="rounded-3xl border border-white/15 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Create Product</p>
          <div className="mt-3 grid gap-2">
            <input value={productForm.name} onChange={(e) => setProductForm((draft) => ({ ...draft, name: e.target.value }))} placeholder="Name" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <input value={productForm.slug} onChange={(e) => setProductForm((draft) => ({ ...draft, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="slug" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <textarea value={productForm.description} onChange={(e) => setProductForm((draft) => ({ ...draft, description: e.target.value }))} rows={3} placeholder="Description" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={productForm.product_type} onChange={(e) => setProductForm((draft) => ({ ...draft, product_type: e.target.value as StoreProductType }))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                {(["physical", "digital_tool", "digital_download", "subscription", "bundle"] as const).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select value={productForm.status} onChange={(e) => setProductForm((draft) => ({ ...draft, status: e.target.value }))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                {(["draft", "active", "archived"] as const).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input type="number" min={0} value={productForm.base_price_cents} onChange={(e) => setProductForm((draft) => ({ ...draft, base_price_cents: Number(e.target.value) }))} placeholder="Base price (cents)" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input value={productForm.currency} onChange={(e) => setProductForm((draft) => ({ ...draft, currency: e.target.value }))} placeholder="Currency (usd)" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            </div>
            <input value={productForm.cover_image} onChange={(e) => setProductForm((draft) => ({ ...draft, cover_image: e.target.value }))} placeholder="Cover image URL" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <button type="button" onClick={createProduct} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink">
              Save Product
            </button>
          </div>
        </article>

        <article className="rounded-3xl border border-white/15 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Create Variant</p>
          <div className="mt-3 grid gap-2">
            <select value={variantForm.product_id} onChange={(e) => setVariantForm((draft) => ({ ...draft, product_id: e.target.value }))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
              <option value="">Select product</option>
              {snapshot.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input value={variantForm.sku} onChange={(e) => setVariantForm((draft) => ({ ...draft, sku: e.target.value }))} placeholder="SKU" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <input value={variantForm.title} onChange={(e) => setVariantForm((draft) => ({ ...draft, title: e.target.value }))} placeholder="Variant title" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <input type="number" min={0} value={variantForm.price_cents} onChange={(e) => setVariantForm((draft) => ({ ...draft, price_cents: Number(e.target.value) }))} placeholder="Price (cents)" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <select value={variantForm.inventory_mode} onChange={(e) => setVariantForm((draft) => ({ ...draft, inventory_mode: e.target.value as "finite" | "unlimited" }))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
              <option value="unlimited">unlimited</option>
              <option value="finite">finite</option>
            </select>
            {variantForm.inventory_mode === "finite" && (
              <input type="number" min={0} value={variantForm.inventory_count} onChange={(e) => setVariantForm((draft) => ({ ...draft, inventory_count: Number(e.target.value) }))} placeholder="Inventory count" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            )}
            <input value={variantForm.digital_delivery_url} onChange={(e) => setVariantForm((draft) => ({ ...draft, digital_delivery_url: e.target.value }))} placeholder="Private digital link (optional)" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <label className="flex min-h-11 items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={variantForm.is_default} onChange={(e) => setVariantForm((draft) => ({ ...draft, is_default: e.target.checked }))} />
              Default variant
            </label>
            <button type="button" onClick={createVariant} disabled={busy} className="min-h-11 rounded-full border border-gold/45 px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-gold">
              Save Variant
            </button>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/15 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Catalog</p>
          <div className="mt-3 space-y-2">
            {snapshot.products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProductId(product.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedProductId === product.id ? "border-gold/60 bg-gold/10" : "border-white/15 bg-black/25"}`}
              >
                <p>{product.name}</p>
                <p className="text-xs text-white/55">
                  {product.status} | {product.product_type} | {formatMoney(product.base_price_cents, product.currency)}
                </p>
              </button>
            ))}
          </div>
          {!!selectedProductId && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">Variants for {productsById.get(selectedProductId)?.name}</p>
              <ul className="mt-2 space-y-2">
                {variantsForSelected.map((variant) => (
                  <li key={variant.id} className="rounded-lg border border-white/10 p-2 text-xs text-white/75">
                    {variant.title} ({variant.sku}) | {formatMoney(variant.price_cents)} | {variant.inventory_mode}
                    {variant.inventory_mode === "finite" ? `:${variant.inventory_count ?? 0}` : ""}
                  </li>
                ))}
                {!variantsForSelected.length && <li className="text-xs text-white/50">No variants for this product.</li>}
              </ul>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-white/15 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Reviews Moderation</p>
          <div className="mt-3 space-y-2">
            {snapshot.reviews.slice(0, 30).map((review) => (
              <div key={review.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-gold">{review.rating} / 5</p>
                <p className="text-sm text-white/90">{review.title}</p>
                <p className="mt-1 text-xs text-white/65">{review.body}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={async () => { const result = await updateReviewStatus(review.id, "approved"); setNotice(result.ok ? "Review approved." : result.error); if (result.ok) await refresh(); }} className="min-h-10 rounded-full border border-gold/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                    Approve
                  </button>
                  <button type="button" onClick={async () => { const result = await updateReviewStatus(review.id, "rejected"); setNotice(result.ok ? "Review rejected." : result.error); if (result.ok) await refresh(); }} className="min-h-10 rounded-full border border-white/35 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                    Reject
                  </button>
                  <span className="text-[11px] text-white/55">{review.status}</span>
                </div>
              </div>
            ))}
            {!snapshot.reviews.length && <p className="text-sm text-white/60">No reviews yet.</p>}
          </div>
        </article>
      </div>

      <article className="mt-5 rounded-3xl border border-white/15 bg-black/35 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-white/55">Orders</p>
        <div className="mt-3 space-y-3">
          {snapshot.orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/90">
                  Order #{order.id} | {order.status}
                </p>
                <p className="text-sm text-gold">{formatMoney(order.total_cents, order.currency)}</p>
              </div>
              <p className="text-xs text-white/55">{order.stripe_customer_email || "No email"} | {new Date(order.created_at).toLocaleString()}</p>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                {(orderItemsByOrder.get(order.id) || []).map((item) => (
                  <li key={item.id}>
                    {item.title} {item.variant_title ? `(${item.variant_title})` : ""} x{item.quantity}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => orderAction(order.id, "refund")} className="min-h-10 rounded-full border border-gold/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                  Refund
                </button>
                <button type="button" onClick={() => orderAction(order.id, "cancel")} className="min-h-10 rounded-full border border-white/35 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                  Cancel
                </button>
                <button type="button" onClick={() => orderAction(order.id, "mark_shipped")} className="min-h-10 rounded-full border border-white/35 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                  Mark shipped
                </button>
                <button type="button" onClick={() => orderAction(order.id, "resend_download_link")} className="min-h-10 rounded-full border border-white/35 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                  Resend link
                </button>
              </div>
            </div>
          ))}
          {!snapshot.orders.length && <p className="text-sm text-white/60">No orders synced yet. Configure webhook and run a checkout.</p>}
        </div>
      </article>

      {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}
    </section>
  );
}
