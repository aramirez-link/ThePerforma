import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!autoAdvance) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, 45000);
    return () => window.clearInterval(id);
  }, [autoAdvance, items.length]);

  const current = items[active];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
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
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{current.platform}</p>
          <h3 className="mt-2 text-lg font-semibold">{current.title}</h3>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className={`group rounded-2xl border p-3 text-left transition ${
              index === active
                ? "border-ember bg-white/10"
                : "border-white/10 bg-white/5 hover:border-white/30"
            }`}
          >
            <div className="overflow-hidden rounded-xl border border-white/10">
              <img src={item.thumbnail} alt={item.title} className="rounded-xl transition duration-500 group-hover:scale-[1.03]" />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/60">{item.platform}</p>
            <p className="mt-2 text-sm">{item.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
