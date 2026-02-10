import { useMemo, useState } from "react";
import Lightbox from "./Lightbox";

export type MediaItem = {
  image: string;
  alt: string;
  tags: string[];
  credit?: string;
};

type Props = {
  items: MediaItem[];
};

export default function MediaGrid({ items }: Props) {
  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.tags.forEach((tag) => set.add(tag)));
    return ["All", ...Array.from(set)];
  }, [items]);

  const [activeTag, setActiveTag] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (activeTag === "All") return items;
    return items.filter((item) => item.tags.includes(activeTag));
  }, [activeTag, items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em]">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(tag)}
            className={`rounded-full border px-4 py-2 transition ${
              activeTag === tag
                ? "border-ember text-white"
                : "border-white/20 text-white/60 hover:border-white/50"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
        {filtered.map((item, index) => (
          <button
            key={`${item.image}-${index}`}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative mb-4 w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/15 bg-black/40 text-left shadow-[0_0_60px_rgba(242,84,45,0.08)]"
          >
            <img src={item.image} alt={item.alt} loading="lazy" className="w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.78)_100%)]" />
            <div className="relative p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">{item.tags.join(" · ")}</p>
              {item.credit && <p className="mt-2 text-xs text-white/50">{item.credit}</p>}
            </div>
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox items={filtered} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
