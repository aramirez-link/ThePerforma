import { useEffect, useState } from "react";
import DonatePill from "./DonatePill";
import FavoriteButton from "./FavoriteButton";
import {
  loadActiveWatchFeaturedReel,
  type WatchFeaturedReel
} from "../lib/watchFeaturedReels";

const formatSchedule = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function FeaturedReelSpotlight() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [reel, setReel] = useState<WatchFeaturedReel | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await loadActiveWatchFeaturedReel();
      if (!result.ok) {
        setNotice(result.error);
        setLoading(false);
        return;
      }
      setReel(result.data);
      setLoading(false);
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const shareReel = async () => {
    if (!reel) return;
    const shareUrl = `${window.location.origin}/watch?featured_reel=${encodeURIComponent(reel.id)}`;
    const payload = {
      title: reel.title,
      text: `Watch ${reel.title} on The Performa`,
      url: shareUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setNotice("Featured reel link ready to share.");
    } catch {
      setNotice("Share cancelled.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/15 bg-black/45 p-5 text-sm text-white/65">
        Loading featured reel...
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="rounded-[1.75rem] border border-white/15 bg-black/45 p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold/80">Featured Reel</p>
        <p className="mt-3 text-sm text-white/68">
          No featured reel is scheduled yet. Add one from the performance admin panel to spotlight a clip here.
        </p>
        {notice && <p className="mt-3 text-xs text-gold">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-[1.9rem] border border-white/15 bg-[linear-gradient(180deg,rgba(10,10,16,0.96),rgba(7,7,11,0.92))] p-4 shadow-[0_0_80px_rgba(242,84,45,0.12)] md:p-5">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/12 bg-black/50 p-4 md:p-5">
        {reel.thumbnailUrl && (
          <>
            <img
              src={reel.thumbnailUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-[0.14]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(0,0,0,0.86))]" />
          </>
        )}
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/82">Now Featured</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{reel.title}</h3>
              <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-white/52">
                {reel.platform} | live since {formatSchedule(reel.goLiveAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void shareReel()}
                className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75 hover:border-gold/45 hover:text-gold"
              >
                Share Reel
              </button>
              <FavoriteButton
                type="watch"
                itemId={reel.sourceUrl || reel.embedUrl}
                title={reel.title}
                href="/watch"
                image={reel.thumbnailUrl || undefined}
                compact
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-white/12 bg-black">
            <div className="pointer-events-none absolute right-8 top-[4.8rem] z-10">
              <div className="pointer-events-auto">
                <DonatePill source={`featured-reel-${reel.id}`} />
              </div>
            </div>
            <div className="relative aspect-video">
              <iframe
                src={reel.embedUrl}
                title={reel.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
      {notice && <p className="mt-3 text-xs text-gold">{notice}</p>}
    </div>
  );
}
