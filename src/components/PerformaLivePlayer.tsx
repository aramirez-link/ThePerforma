type Props = {
  playbackId?: string | null;
  title?: string;
  isLive?: boolean;
};

const toCloudflareIframe = (playbackId: string) =>
  `https://iframe.videodelivery.net/${encodeURIComponent(playbackId)}?autoplay=true&muted=true&dvrEnabled=false`;

export default function PerformaLivePlayer({ playbackId, title = "Performa Live Stream", isLive = false }: Props) {
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
          src={toCloudflareIframe(playbackId)}
          title={title}
          loading="lazy"
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
      </div>
    </div>
  );
}
