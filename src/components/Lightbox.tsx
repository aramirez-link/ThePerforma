import { useEffect, useState } from "react";
import type { MediaItem } from "./MediaGrid";

type Props = {
  items: MediaItem[];
  index: number;
  onClose: () => void;
};

export default function Lightbox({ items, index, onClose }: Props) {
  const [active, setActive] = useState(index);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setActive((prev) => (prev + 1) % items.length);
      if (event.key === "ArrowLeft") setActive((prev) => (prev - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items.length, onClose]);

  const current = items[active];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 text-xs uppercase tracking-[0.3em] text-white/70"
      >
        Close
      </button>
      <button
        type="button"
        onClick={() => setActive((prev) => (prev - 1 + items.length) % items.length)}
        className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-white/60"
        aria-label="Previous"
      >
        ‹
      </button>
      <div className="max-w-4xl">
        <img src={current.image} alt={current.alt} className="max-h-[70vh] w-full object-contain" />
        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{current.tags.join(" · ")}</p>
          {current.credit && <p className="mt-2 text-xs text-white/50">{current.credit}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActive((prev) => (prev + 1) % items.length)}
        className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-white/60"
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
}
