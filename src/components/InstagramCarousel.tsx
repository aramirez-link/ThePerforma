import { useMemo, useRef } from "react";

type InstagramItem = {
  url?: string;
  embedUrl?: string;
  title?: string;
};

type Props = {
  items: InstagramItem[];
};

const toEmbedUrl = (item: InstagramItem) => {
  if (item.embedUrl) return item.embedUrl;
  if (!item.url) return null;
  const match = item.url.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed/captioned/`;
};

export default function InstagramCarousel({ items }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const slides = useMemo(
    () =>
      items.map((item, index) => ({
        key: `${item.url || item.embedUrl || "instagram"}-${index}`,
        title: item.title || "Instagram Post",
        sourceUrl: item.url || null,
        embedUrl: toEmbedUrl(item)
      })),
    [items]
  );

  const hasSlides = slides.length > 0;

  const scrollByCard = (direction: "prev" | "next") => {
    const container = containerRef.current;
    if (!container) return;
    const offset = container.clientWidth * 0.86;
    container.scrollBy({
      left: direction === "next" ? offset : -offset,
      behavior: "smooth"
    });
  };

  if (!hasSlides) {
    return (
      <div className="rounded-3xl border border-white/15 bg-black/45 p-6 text-sm text-white/70">
        Instagram carousel is ready. Add public Instagram post/reel links to <code>content/instagram.json</code>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByCard("prev")}
          className="rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75 transition hover:border-gold/60 hover:text-gold"
          aria-label="Previous Instagram post"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => scrollByCard("next")}
          className="rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75 transition hover:border-gold/60 hover:text-gold"
          aria-label="Next Instagram post"
        >
          Next
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {slides.map((item) => (
          <article
            key={item.key}
            className="min-w-[min(88vw,420px)] snap-start overflow-hidden rounded-3xl border border-white/15 bg-black/45 shadow-[0_0_60px_rgba(242,84,45,0.08)]"
          >
            {item.embedUrl ? (
              <iframe
                src={item.embedUrl}
                title={item.title}
                className="h-[560px] w-full bg-black"
                loading="lazy"
                allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center px-6 text-center text-sm text-white/70">
                <div>
                  <p className="text-base text-white/85">{item.title}</p>
                  <p className="mt-2">This entry is not a direct Instagram post/reel URL.</p>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-[0.24em] text-gold"
                    >
                      Open on Instagram
                    </a>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

