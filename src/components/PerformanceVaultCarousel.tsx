import { useEffect, useMemo, useState } from "react";

export type VaultItem = {
  title: string;
  platform: string;
  embedUrl: string;
  thumbnail: string;
  featured?: boolean;
};

type Props = {
  items: VaultItem[];
  stageActive: boolean;
};

const reelModeGraphic = "/assets/img/Keep-on-playin-red.png";

export default function PerformanceVaultCarousel({ items, stageActive }: Props) {
  const featured = useMemo(() => {
    const pool = items.filter((item) => item.featured);
    return pool.length ? pool : items;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = featured[activeIndex];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="space-y-5" id="performance-vault">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-gold/80">Signature Reels</p>
          <h3 className="mt-2 font-display text-3xl">Live Moments From the Mainstage</h3>
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/60">{featured.length} entries</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-black/70 p-2 transition ${stageActive ? "shadow-[0_0_80px_rgba(242,84,45,0.25)]" : ""}`}
      >
        <div className="relative aspect-video overflow-hidden rounded-[1.6rem] bg-black">
          <img src={current.thumbnail} alt={current.title} className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-95" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),rgba(0,0,0,0.72))]" />
          <div className="absolute left-4 top-4 overflow-hidden rounded-full border border-gold/40 bg-black/35 p-1.5 md:left-6 md:top-6">
            <img
              src={reelModeGraphic}
              alt="Reel Mode"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.src = "/assets/img/012ChipLee_CF2024_4K.jpg";
              }}
              className="record-spin h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
            />
          </div>
          <div className="absolute bottom-6 left-6 text-left">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">{current.platform}</p>
            <h4 className="mt-2 text-2xl font-semibold">{current.title}</h4>
          </div>
        </div>
      </button>

      <div className="grid gap-3 md:grid-cols-3">
        {featured.map((item, index) => (
          <button
            type="button"
            key={`${item.title}-${index}`}
            onClick={() => setActiveIndex(index)}
            className={`rounded-2xl border bg-black/40 p-3 text-left transition ${index === activeIndex ? "border-gold/50" : "border-white/15 hover:border-white/30"}`}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">{item.platform}</p>
            <p className="mt-2 text-sm">{item.title}</p>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-black/90 px-4 py-10"
          onClick={() => setOpen(false)}
          onMouseDown={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Performance reel"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            onMouseDown={(event) => event.stopPropagation()}
            className="fixed right-4 top-[max(0.9rem,env(safe-area-inset-top))] z-[71] rounded-full border border-white/30 bg-black/70 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/80 md:right-6"
          >
            Close Reel
          </button>
          <div className="mx-auto mt-16 max-w-5xl md:mt-20">
            <div
              className="overflow-hidden rounded-[2rem] border border-white/20 bg-black"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="aspect-video">
                <iframe
                  src={current.embedUrl}
                  title={current.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
