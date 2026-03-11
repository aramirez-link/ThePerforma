import { useEffect, useMemo, useState } from "react";

type Props = {
  playbackId?: string | null;
  title?: string;
  isLive?: boolean;
};

const toCloudflareIframe = (playbackId: string, cacheBust: string) =>
  `https://iframe.videodelivery.net/${encodeURIComponent(playbackId)}?autoplay=true&muted=true&dvrEnabled=false&preload=true&cacheBust=${encodeURIComponent(cacheBust)}`;

export default function PerformaLivePlayer({ playbackId, title = "Performa Live Stream", isLive = false }: Props) {
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setReloadTick(0);
  }, [playbackId]);

  useEffect(() => {
    if (!isLive || !playbackId) return;
    const timer = window.setInterval(() => {
      setReloadTick((tick) => tick + 1);
    }, 120000);
    return () => window.clearInterval(timer);
  }, [isLive, playbackId]);

  const iframeSrc = useMemo(() => {
    if (!playbackId) return "";
    return toCloudflareIframe(playbackId, `${reloadTick}`);
  }, [playbackId, reloadTick]);

  if (!playbackId) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/45 p-4">
        <div className="aspect-video w-full rounded-xl border border-white/10 bg-black/70" />
        <p className="mt-3 text-xs text-white/60">No active live playback detected yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/45">
      <div className="aspect-video w-full">
        <iframe
          className="h-full w-full"
          key={`${playbackId}:${reloadTick}`}
          src={iframeSrc}
          title={title}
          loading="eager"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3">
        <p className="text-xs text-white/65">{title}</p>
        <span
          className={`inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
            isLive ? "border-emerald-400/60 text-emerald-300" : "border-white/20 text-white/65"
          }`}
        >
          {isLive ? "Live" : "Standby"}
        </span>
        <button
          type="button"
          onClick={() => setReloadTick((tick) => tick + 1)}
          className="inline-flex min-h-10 items-center rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 hover:border-gold/45 hover:text-gold"
        >
          Refresh Feed
        </button>
      </div>
    </div>
  );
}
