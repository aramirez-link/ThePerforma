import { useEffect, useMemo, useState } from "react";
import {
  addWishlistItem,
  createCheckoutSession,
  formatMoney,
  getCurrentUser,
  getVariantStockState,
  loadStorefrontProducts,
  loadWishlist,
  LOW_STOCK_THRESHOLD,
  removeWishlistItem,
  submitReview,
  type StoreCartItem,
  type StorefrontProductView
} from "../lib/storefront";

type Filter = "all" | "physical" | "digital_tool" | "digital_download" | "subscription" | "bundle";

const CART_KEY = "the-performa-store-cart-v1";

const readCart = (): StoreCartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.variantId === "string")
      .map((item) => ({ variantId: item.variantId, quantity: Math.max(1, Number(item.quantity || 1)) }));
  } catch {
    return [];
  }
};

const writeCart = (items: StoreCartItem[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
};

const avgRating = (ratings: number[]) => {
  if (!ratings.length) return 0;
  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
};

const STORAGE_BUCKET = "store-product-media";
const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ORIGIN = SUPABASE_URL ? SUPABASE_URL.replace(/\/+$/, "") : "";
const LOCAL_FILE_PATH_RE = /^[a-zA-Z]:[\\/]/;
const HTML_SNIPPET_RE = /<[^>]+>/;

const safeEncodeUrl = (value: string) => {
  try {
    return encodeURI(value);
  } catch {
    return value;
  }
};

const normalizeImageUrl = (value: string) => {
  const original = String(value || "").trim();
  if (!original) return null;

  // Handle serialized JSON payloads or quoted URL strings.
  let raw = original.replace(/^['"]+|['"]+$/g, "").trim();
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const candidate =
        (typeof parsed.url === "string" && parsed.url) ||
        (typeof parsed.src === "string" && parsed.src) ||
        (typeof parsed.path === "string" && parsed.path) ||
        (typeof parsed.key === "string" && parsed.key) ||
        "";
      raw = String(candidate || "").trim();
    } catch {
      raw = original;
    }
  }
  if (!raw) return null;
  if (LOCAL_FILE_PATH_RE.test(raw)) return null;
  if (HTML_SNIPPET_RE.test(raw)) return null;
  if (/^data:image\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return safeEncodeUrl(raw);
  if (raw.startsWith("//")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return safeEncodeUrl(`${protocol}${raw}`);
  }
  if (raw.startsWith("/storage/") && SUPABASE_ORIGIN) return safeEncodeUrl(`${SUPABASE_ORIGIN}${raw}`);
  if (raw.startsWith("/")) return safeEncodeUrl(raw);
  if (raw.startsWith("storage/v1/object/public/") && SUPABASE_ORIGIN) {
    return safeEncodeUrl(`${SUPABASE_ORIGIN}/${raw}`);
  }
  if (raw.startsWith(`${STORAGE_BUCKET}/`) && SUPABASE_ORIGIN) {
    const path = raw.replace(new RegExp(`^${STORAGE_BUCKET}/`), "");
    return safeEncodeUrl(`${SUPABASE_ORIGIN}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`);
  }

  // Accept bucket/object style values and convert to Supabase public URLs.
  if (SUPABASE_ORIGIN) {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (raw.includes(marker)) {
      const idx = raw.indexOf(marker);
      const path = raw.slice(idx + marker.length).replace(/^\/+/, "");
      if (path) return safeEncodeUrl(`${SUPABASE_ORIGIN}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`);
    }
    if (raw.includes(`${STORAGE_BUCKET}/`)) {
      const idx = raw.indexOf(`${STORAGE_BUCKET}/`);
      const path = raw.slice(idx + `${STORAGE_BUCKET}/`.length).replace(/^\/+/, "");
      if (path.includes("/")) {
        return safeEncodeUrl(`${SUPABASE_ORIGIN}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`);
      }
    }

    const clean = raw
      .replace(new RegExp(`^${STORAGE_BUCKET}/`), "")
      .replace(/^\/+/, "");
    if (clean.includes("/") && !clean.includes(" ")) {
      return safeEncodeUrl(`${SUPABASE_ORIGIN}/storage/v1/object/public/${STORAGE_BUCKET}/${clean}`);
    }
  }
  return null;
};

const productImages = (product: StorefrontProductView) => {
  const all = [product.cover_image, ...(product.gallery || [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => normalizeImageUrl(value))
    .filter(Boolean) as string[];
  return Array.from(new Set(all));
};

export default function Storefront() {
  const [products, setProducts] = useState<StorefrontProductView[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<StoreCartItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewDraft, setReviewDraft] = useState<{ productId: string; rating: number; title: string; body: string }>({
    productId: "",
    rating: 5,
    title: "",
    body: ""
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [productsResult, wishlistResult] = await Promise.all([loadStorefrontProducts(), loadWishlist()]);
      const user = await getCurrentUser();
      setUserEmail(user?.email || "");
      if (productsResult.ok) {
        setProducts(productsResult.data);
        const picks: Record<string, string> = {};
        for (const product of productsResult.data) {
          if (product.defaultVariant) picks[product.id] = product.defaultVariant.id;
        }
        setSelectedVariants(picks);
      } else {
        setNotice(productsResult.error);
      }
      if (wishlistResult.ok) setWishlist(wishlistResult.data);
      setCart(readCart());
      setLoading(false);
    };
    run();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !products.length) return;
    const url = new URL(window.location.href);
    const slug = (url.searchParams.get("product") || "").trim().toLowerCase();
    if (!slug) return;
    const product = products.find((entry) => entry.slug.toLowerCase() === slug);
    if (product) {
      setActiveProductId(product.id);
      setActiveImageIndex(0);
    }
  }, [products]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((product) => product.product_type === filter);
  }, [filter, products]);

  const activeProduct = useMemo(
    () => products.find((entry) => entry.id === activeProductId) || null,
    [products, activeProductId]
  );

  const activeProductGallery = useMemo(
    () => (activeProduct ? productImages(activeProduct) : []),
    [activeProduct]
  );

  const variantById = useMemo(() => {
    const map = new Map<string, { product: StorefrontProductView; variant: StorefrontProductView["variants"][number] }>();
    for (const product of products) {
      for (const variant of product.variants) map.set(variant.id, { product, variant });
    }
    return map;
  }, [products]);

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const entry = variantById.get(line.variantId);
          if (!entry) return null;
          return { ...line, ...entry, lineTotal: entry.variant.price_cents * line.quantity };
        })
        .filter(Boolean) as Array<
        StoreCartItem & {
          lineTotal: number;
          product: StorefrontProductView;
          variant: StorefrontProductView["variants"][number];
        }
      >,
    [cart, variantById]
  );

  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const toggleWishlist = async (productId: string) => {
    const has = wishlist.includes(productId);
    const result = has ? await removeWishlistItem(productId) : await addWishlistItem(productId);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setWishlist((current) => (has ? current.filter((id) => id !== productId) : [productId, ...current]));
    setNotice(has ? "Removed from wishlist." : "Saved to wishlist.");
  };

  const updateSelectedVariant = (productId: string, variantId: string) => {
    setSelectedVariants((current) => ({ ...current, [productId]: variantId }));
  };

  const addToCart = (product: StorefrontProductView) => {
    const variantId = selectedVariants[product.id] || product.defaultVariant?.id;
    if (!variantId) {
      setNotice("No variant available for this product.");
      return;
    }
    const selectedVariant = product.variants.find((item) => item.id === variantId) || null;
    if (!selectedVariant) {
      setNotice("Selected variant is unavailable.");
      return;
    }
    const stock = getVariantStockState(selectedVariant);
    if (stock.outOfStock) {
      setNotice("This variant is currently out of stock.");
      return;
    }
    const next = [...cart];
    const existing = next.find((item) => item.variantId === variantId);
    if (existing) {
      const nextQty = existing.quantity + 1;
      if (stock.remaining != null && nextQty > stock.remaining) {
        setNotice(`Only ${stock.remaining} left in stock.`);
        return;
      }
      existing.quantity = nextQty;
    }
    else next.unshift({ variantId, quantity: 1 });
    setCart(next);
    writeCart(next);
    setNotice("Added to cart.");
  };

  const changeQty = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      const next = cart.filter((item) => item.variantId !== variantId);
      setCart(next);
      writeCart(next);
      return;
    }
    const next = cart.map((item) => (item.variantId === variantId ? { ...item, quantity } : item));
    setCart(next);
    writeCart(next);
  };

  const checkout = async () => {
    if (!cartItems.length) {
      setNotice("Your cart is empty.");
      return;
    }
    if (!userEmail) {
      setNotice("Log in to Fan Vault before checkout.");
      return;
    }
    setCheckingOut(true);
    const origin = window.location.origin;
    const result = await createCheckoutSession({
      items: cartItems.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })),
      promoCode: promoCode.trim() || undefined,
      successUrl: `${origin}/store?checkout=success`,
      cancelUrl: `${origin}/store?checkout=cancelled`
    });
    setCheckingOut(false);

    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    window.location.assign(result.data.checkoutUrl);
  };

  const openProduct = (product: StorefrontProductView) => {
    setActiveProductId(product.id);
    setActiveImageIndex(0);
    const url = new URL(window.location.href);
    url.searchParams.set("product", product.slug);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };

  const closeProduct = () => {
    setActiveProductId(null);
    setActiveImageIndex(0);
    const url = new URL(window.location.href);
    url.searchParams.delete("product");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };

  const orderNow = async (product: StorefrontProductView) => {
    const variantId = selectedVariants[product.id] || product.defaultVariant?.id;
    if (!variantId) {
      setNotice("No variant available for this product.");
      return;
    }
    const selectedVariant = product.variants.find((item) => item.id === variantId) || null;
    if (!selectedVariant) {
      setNotice("Selected variant is unavailable.");
      return;
    }
    const stock = getVariantStockState(selectedVariant);
    if (stock.outOfStock) {
      setNotice("This variant is currently out of stock.");
      return;
    }
    if (!userEmail) {
      setNotice("Log in to Fan Vault before checkout.");
      return;
    }
    setCheckingOut(true);
    const origin = window.location.origin;
    const result = await createCheckoutSession({
      items: [{ variantId: selectedVariant.id, quantity: 1 }],
      promoCode: promoCode.trim() || undefined,
      successUrl: `${origin}/store?checkout=success`,
      cancelUrl: `${origin}/store?checkout=cancelled`
    });
    setCheckingOut(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    window.location.assign(result.data.checkoutUrl);
  };

  const submitProductReview = async (productId: string) => {
    if (!reviewDraft.body.trim() || !reviewDraft.title.trim()) {
      setNotice("Write a title and review body.");
      return;
    }
    const result = await submitReview({
      productId,
      rating: reviewDraft.rating,
      title: reviewDraft.title,
      body: reviewDraft.body
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setReviewDraft({ productId: "", rating: 5, title: "", body: "" });
    setNotice("Review submitted for moderation.");
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="rounded-[2rem] border border-white/15 bg-black/45 p-6 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-gold/80">Performa Store</p>
        <h1 className="mt-2 font-display text-4xl">Merch, DJ Tools, and Digital Drops</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/70">
          Worldwide checkout with Stripe, promo codes, and private digital delivery links for downloads and tool packs.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["all", "physical", "digital_tool", "digital_download", "subscription", "bundle"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.24em] min-h-11 ${
                filter === item ? "border-gold/70 bg-gold/10 text-gold" : "border-white/20 text-white/75"
              }`}
            >
              {item.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          {loading && <p className="text-sm text-white/70">Loading store...</p>}
          {!loading && !visibleProducts.length && (
            <article className="rounded-3xl border border-white/15 bg-black/35 p-6 text-sm text-white/70">
              No products published yet.
            </article>
          )}
          {visibleProducts.map((product) => {
            const currentVariantId = selectedVariants[product.id] || product.defaultVariant?.id || "";
            const currentVariant = product.variants.find((item) => item.id === currentVariantId) || product.defaultVariant;
            const stock = currentVariant ? getVariantStockState(currentVariant) : { outOfStock: false, lowStock: false, remaining: null };
            const ratings = product.reviews.map((item) => item.rating);
            const images = productImages(product);
            const heroImage = images[0] || null;
            const related = product.related_product_ids
              .map((id) => products.find((entry) => entry.id === id))
              .filter(Boolean)
              .slice(0, 2) as StorefrontProductView[];

            return (
              <article key={product.id} className="rounded-3xl border border-white/15 bg-black/35 p-5 backdrop-blur">
                {heroImage && (
                  <img
                    src={heroImage}
                    alt={product.name}
                    className="h-48 w-full rounded-2xl border border-white/10 object-cover"
                    loading="lazy"
                  />
                )}
                <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-gold/80">{product.product_type.replace("_", " ")}</p>
                <h2 className="mt-2 text-2xl font-semibold">{product.name}</h2>
                <p className="mt-2 text-sm text-white/70">{product.description}</p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-sm text-gold">{formatMoney(currentVariant?.price_cents || product.base_price_cents, product.currency)}</p>
                  <p className="text-xs text-white/55">
                    {ratings.length ? `${avgRating(ratings)} / 5 (${ratings.length})` : "No ratings yet"}
                  </p>
                </div>
                {stock.outOfStock && (
                  <p className="mt-2 inline-flex rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-200">
                    Out of stock
                  </p>
                )}
                {!stock.outOfStock && stock.lowStock && (
                  <p className="mt-2 inline-flex rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                    Low stock: {stock.remaining} left
                  </p>
                )}

                {!!product.variants.length && (
                  <select
                    value={currentVariantId}
                    onChange={(event) => updateSelectedVariant(product.id, event.target.value)}
                    className="mt-3 w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm min-h-11"
                  >
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.title} ({formatMoney(variant.price_cents, product.currency)})
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openProduct(product)}
                    className="rounded-full border border-gold/45 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold min-h-11"
                  >
                    View Product
                  </button>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={stock.outOfStock}
                    className="rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-ink min-h-11 disabled:opacity-50"
                  >
                    {stock.outOfStock ? "Sold out" : "Add to cart"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    className="rounded-full border border-white/30 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-white/80 min-h-11"
                  >
                    {wishlist.includes(product.id) ? "Wishlisted" : "Wishlist"}
                  </button>
                </div>

                {!!related.length && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Related</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/75">
                      {related.map((item) => (
                        <span key={item.id} className="rounded-full border border-white/15 px-3 py-1">
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Reviews</p>
                  <div className="mt-2 space-y-2">
                    {product.reviews.slice(0, 2).map((review) => (
                      <article key={review.id} className="rounded-xl border border-white/10 p-2">
                        <p className="text-xs text-gold">{"★".repeat(Math.max(1, review.rating))}</p>
                        <p className="text-xs text-white/85">{review.title}</p>
                        <p className="text-xs text-white/65">{review.body}</p>
                      </article>
                    ))}
                    {!product.reviews.length && <p className="text-xs text-white/55">No approved reviews yet.</p>}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-gold">Write a review</summary>
                    <div className="mt-2 grid gap-2">
                      <input
                        value={reviewDraft.productId === product.id ? reviewDraft.title : ""}
                        onChange={(event) =>
                          setReviewDraft((draft) => ({
                            ...draft,
                            productId: product.id,
                            title: event.target.value
                          }))
                        }
                        className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-xs min-h-11"
                        placeholder="Review title"
                      />
                      <textarea
                        value={reviewDraft.productId === product.id ? reviewDraft.body : ""}
                        onChange={(event) =>
                          setReviewDraft((draft) => ({
                            ...draft,
                            productId: product.id,
                            body: event.target.value
                          }))
                        }
                        rows={3}
                        className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-xs"
                        placeholder="Share your experience"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={reviewDraft.productId === product.id ? reviewDraft.rating : 5}
                          onChange={(event) =>
                            setReviewDraft((draft) => ({
                              ...draft,
                              productId: product.id,
                              rating: Number(event.target.value)
                            }))
                          }
                          className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-xs min-h-11"
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} stars
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => submitProductReview(product.id)}
                          className="rounded-full border border-gold/45 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold min-h-11"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="h-fit rounded-3xl border border-white/15 bg-black/45 p-5 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.28em] text-gold/80">Cart</p>
          {!userEmail && (
            <p className="mt-2 text-[11px] text-white/65">
              Checkout requires Fan Vault login. <a href="/fan-club" className="text-gold underline">Log in here</a>.
            </p>
          )}
          <div className="mt-3 space-y-3">
            {cartItems.map((item) => (
              <article key={item.variant.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-xs text-white/90">{item.product.name}</p>
                <p className="text-[11px] text-white/60">{item.variant.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    max={
                      item.variant.inventory_mode === "finite"
                        ? Math.max(1, Number(item.variant.inventory_count || 0))
                        : undefined
                    }
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (item.variant.inventory_mode === "finite") {
                        const max = Math.max(1, Number(item.variant.inventory_count || 0));
                        changeQty(item.variant.id, Math.min(max, Math.max(1, raw)));
                        return;
                      }
                      changeQty(item.variant.id, Math.max(1, raw));
                    }}
                    className="w-16 rounded-lg border border-white/20 bg-black/35 px-2 py-1 text-xs min-h-11"
                  />
                  <p className="text-xs text-gold">{formatMoney(item.lineTotal, item.product.currency)}</p>
                </div>
                {item.variant.inventory_mode === "finite" && Number(item.variant.inventory_count || 0) <= LOW_STOCK_THRESHOLD && (
                  <p className="mt-1 text-[10px] text-gold">
                    Stock left: {Math.max(0, Number(item.variant.inventory_count || 0))}
                  </p>
                )}
              </article>
            ))}
            {!cartItems.length && <p className="text-sm text-white/55">No items yet.</p>}
          </div>

          <div className="mt-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/55" htmlFor="promo-code">
              Promo code
            </label>
            <input
              id="promo-code"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm min-h-11"
              placeholder="Optional"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-white/70">Subtotal</p>
            <p className="text-sm text-gold">{formatMoney(subtotal)}</p>
          </div>
          <p className="mt-1 text-[11px] text-white/55">Tax and shipping are calculated by Stripe at checkout.</p>

          <button
            type="button"
            onClick={checkout}
            disabled={checkingOut}
            className="mt-4 w-full rounded-full bg-ember px-4 py-3 text-xs uppercase tracking-[0.24em] text-ink min-h-11 disabled:opacity-60"
          >
            {checkingOut ? "Redirecting..." : "Checkout"}
          </button>
        </aside>
      </div>

      {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}

      {activeProduct && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-6xl items-center px-4 py-6 sm:px-6">
            <article className="max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-white/15 bg-black/90 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{activeProduct.product_type.replace("_", " ")}</p>
                  <h2 className="mt-2 text-3xl font-semibold">{activeProduct.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeProduct}
                  className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/80"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  {activeProductGallery.length > 0 ? (
                    <div className="rounded-2xl border border-white/15 bg-black/40 p-3">
                      <div className="relative overflow-hidden rounded-xl border border-white/10">
                        <img
                          src={activeProductGallery[Math.max(0, Math.min(activeImageIndex, activeProductGallery.length - 1))]}
                          alt={activeProduct.name}
                          className="max-h-[30rem] w-full object-cover"
                        />
                        {activeProductGallery.length > 1 && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveImageIndex((current) =>
                                  current <= 0 ? activeProductGallery.length - 1 : current - 1
                                )
                              }
                              className="pointer-events-auto min-h-10 rounded-full border border-white/40 bg-black/50 px-3 py-2 text-xs text-white"
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveImageIndex((current) =>
                                  current >= activeProductGallery.length - 1 ? 0 : current + 1
                                )
                              }
                              className="pointer-events-auto min-h-10 rounded-full border border-white/40 bg-black/50 px-3 py-2 text-xs text-white"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                      {activeProductGallery.length > 1 && (
                        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {activeProductGallery.map((image, idx) => (
                            <button
                              key={`${activeProduct.id}-image-${idx}`}
                              type="button"
                              onClick={() => setActiveImageIndex(idx)}
                              className={`overflow-hidden rounded-lg border ${idx === activeImageIndex ? "border-gold/70" : "border-white/20"}`}
                            >
                              <img src={image} alt="" className="h-16 w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/15 bg-black/35 p-6 text-sm text-white/60">
                      No product images uploaded yet.
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{activeProduct.description || "No description added yet."}</p>

                  {(() => {
                    const currentVariantId = selectedVariants[activeProduct.id] || activeProduct.defaultVariant?.id || "";
                    const currentVariant = activeProduct.variants.find((item) => item.id === currentVariantId) || activeProduct.defaultVariant;
                    const stock = currentVariant ? getVariantStockState(currentVariant) : { outOfStock: false, lowStock: false, remaining: null };
                    const ratings = activeProduct.reviews.map((item) => item.rating);
                    return (
                      <div className="mt-4 rounded-2xl border border-white/15 bg-black/35 p-4">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Pricing</p>
                        <p className="mt-2 text-xl text-gold">{formatMoney(currentVariant?.price_cents || activeProduct.base_price_cents, activeProduct.currency)}</p>
                        <p className="mt-1 text-xs text-white/55">
                          {ratings.length ? `${avgRating(ratings)} / 5 (${ratings.length} reviews)` : "No ratings yet"}
                        </p>

                        {!!activeProduct.variants.length && (
                          <select
                            value={currentVariantId}
                            onChange={(event) => updateSelectedVariant(activeProduct.id, event.target.value)}
                            className="mt-3 w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm min-h-11"
                          >
                            {activeProduct.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.title} ({formatMoney(variant.price_cents, activeProduct.currency)})
                              </option>
                            ))}
                          </select>
                        )}

                        {stock.outOfStock && (
                          <p className="mt-3 inline-flex rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-200">
                            Out of stock
                          </p>
                        )}
                        {!stock.outOfStock && stock.lowStock && (
                          <p className="mt-3 inline-flex rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                            Low stock: {stock.remaining} left
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => orderNow(activeProduct)}
                            disabled={checkingOut || stock.outOfStock}
                            className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-ink disabled:opacity-50"
                          >
                            {checkingOut ? "Redirecting..." : "Order now"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addToCart(activeProduct)}
                            disabled={stock.outOfStock}
                            className="min-h-11 rounded-full border border-white/30 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-white/85 disabled:opacity-50"
                          >
                            Add to cart
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(activeProduct.id)}
                            className="min-h-11 rounded-full border border-gold/45 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold"
                          >
                            {wishlist.includes(activeProduct.id) ? "Wishlisted" : "Wishlist"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
