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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((product) => product.product_type === filter);
  }, [filter, products]);

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
            const related = product.related_product_ids
              .map((id) => products.find((entry) => entry.id === id))
              .filter(Boolean)
              .slice(0, 2) as StorefrontProductView[];

            return (
              <article key={product.id} className="rounded-3xl border border-white/15 bg-black/35 p-5 backdrop-blur">
                {product.cover_image && (
                  <img
                    src={product.cover_image}
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
    </section>
  );
}
