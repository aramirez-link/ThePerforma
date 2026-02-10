import { useEffect, useState } from "react";
import FavoriteButton from "./FavoriteButton";

type WatchItem = {
  title: string;
  platform: string;
  embedUrl: string;
  thumbnail: string;
  featured?: boolean;
};

type Props = {
  items: WatchItem[];
};

export default function WatchPlaylist({ items }: Props) {
  const [active, setActive] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [notice, setNotice] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const RECENT_KEY = "the-performa-recent-watch-v1";

  useEffect(() => {
    if (!autoAdvance) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, 45000);
    return () => window.clearInterval(id);
  }, [autoAdvance, items.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setRecentIds(parsed.filter((value) => typeof value === "string").slice(0, 8));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const id = items[active]?.embedUrl;
    if (!id) return;
    setRecentIds((current) => {
      const next = [id, ...current.filter((value) => value !== id)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, [active, items]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const current = items[active];
  const recentItems = recentIds
    .map((id) => items.find((item) => item.embedUrl === id))
    .filter((item): item is WatchItem => Boolean(item))
    .slice(0, 4);

  const shareClip = async (item: WatchItem) => {
    const shareUrl = `${window.location.origin}/watch?utm_source=fan-share&utm_medium=social&utm_campaign=watch_clip&utm_content=${encodeURIComponent(item.title)}`;
    const payload = {
      title: item.title,
      text: `Watch ${item.title} on The Performa`,
      url: shareUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setNotice("Clip link ready to share.");
    } catch {
      setNotice("Share cancelled.");
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Now Playing</p>
        <label className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
            className="accent-ember"
          />
          Auto-advance
        </label>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/55 p-4 shadow-[0_0_80px_rgba(242,84,45,0.12)]">
        <img src={current.thumbnail} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(0,0,0,0.82))]" />
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
          <iframe
            src={current.embedUrl}
            title={current.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="relative mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">{current.platform}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void shareClip(current)}
                className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:border-gold/45 hover:text-gold"
              >
                Share Clip
              </button>
              <FavoriteButton
                type="watch"
                itemId={current.embedUrl}
                title={current.title}
                href="/watch"
                image={current.thumbnail}
                compact
              />
            </div>
          </div>
          <h3 className="mt-2 text-lg font-semibold">{current.title}</h3>
        </div>
      </div>
      {recentItems.length > 1 && (
        <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Continue Watching</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentItems.map((item) => (
              <button
                key={item.embedUrl}
                type="button"
                onClick={() => setActive(items.findIndex((entry) => entry.embedUrl === item.embedUrl))}
                className="rounded-xl border border-white/15 bg-black/45 p-2 text-left hover:border-gold/35"
              >
                <img src={item.thumbnail} alt={item.title} className="rounded-lg" />
                <p className="mt-2 text-xs text-white/80">{item.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className={`group rounded-2xl border p-3 text-left transition ${
              index === active
                ? "border-ember bg-white/10"
                : "border-white/10 bg-white/5 hover:border-white/30"
            }`}
          >
            <button type="button" onClick={() => setActive(index)} className="w-full text-left">
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img src={item.thumbnail} alt={item.title} className="rounded-xl transition duration-500 group-hover:scale-[1.03]" />
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/60">{item.platform}</p>
              <p className="mt-2 text-sm">{item.title}</p>
            </button>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void shareClip(item)}
                className="mr-2 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-gold/45 hover:text-gold"
              >
                Share
              </button>
              <FavoriteButton
                type="watch"
                itemId={item.embedUrl}
                title={item.title}
                href="/watch"
                image={item.thumbnail}
                compact
              />
            </div>
          </article>
        ))}
      </div>
      {notice && <p className="text-xs text-gold">{notice}</p>}
    </div>
  );
}
