import { useMemo, useState } from "react";

type Props = {
  ingestUrl: string | null;
  streamKeyOneTime?: string | null;
  ingestType?: string | null;
};

const copyText = async (value: string) => {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const obsPreset = [
  "Service: Custom",
  "Encoder: H.264 + AAC",
  "Output: 1920x1080 at 30 fps",
  "Rate control: CBR at 4500-6000 kbps",
  "Keyframe interval: 2 seconds",
  "Audio bitrate: 160-192 kbps"
];

export default function IngestCard({ ingestUrl, streamKeyOneTime, ingestType }: Props) {
  const [revealed, setRevealed] = useState(Boolean(streamKeyOneTime));
  const [copyNotice, setCopyNotice] = useState("");
  const maskedKey = useMemo(() => (streamKeyOneTime ? `${streamKeyOneTime.slice(0, 4)}........` : ""), [streamKeyOneTime]);

  const flashNotice = (message: string) => {
    setCopyNotice(message);
    window.setTimeout(() => setCopyNotice(""), 1600);
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-black/45 p-4 md:p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Ingest</p>
      <h2 className="mt-2 font-display text-xl">OBS Setup</h2>
      <p className="mt-2 text-sm text-white/70">Use this ingest with OBS or Streamlabs Desktop. Start conservative, then scale up once the feed is consistently smooth.</p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-white/15 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Server URL</p>
          <p className="mt-1 break-all text-xs text-white/85">{ingestUrl || "Not ready yet."}</p>
          <button
            type="button"
            onClick={() => ingestUrl && void copyText(ingestUrl).then((ok) => flashNotice(ok ? "Ingest URL copied." : "Clipboard denied."))}
            className="mt-2 min-h-10 rounded-full border border-white/25 px-3 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:border-white/45"
            disabled={!ingestUrl}
          >
            Copy URL
          </button>
        </div>

        <div className="rounded-xl border border-white/15 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Stream Key</p>
          <p className="mt-1 break-all text-xs text-white/85">
            {revealed ? streamKeyOneTime || "Hidden after initial reveal." : maskedKey || "Click reveal if available."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="min-h-10 rounded-full border border-white/25 px-3 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:border-white/45"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={() => streamKeyOneTime && void copyText(streamKeyOneTime).then((ok) => flashNotice(ok ? "Stream key copied." : "Clipboard denied."))}
              className="min-h-10 rounded-full border border-gold/40 px-3 text-[10px] uppercase tracking-[0.2em] text-gold hover:border-gold/60"
              disabled={!streamKeyOneTime}
            >
              Copy Key
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">Recommended Preset</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {obsPreset.map((line) => (
              <p key={line} className="text-xs text-white/78">{line}</p>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-white/55">Use wired ethernet when possible. If frames still freeze, drop bitrate before increasing resolution or fps.</p>
        </div>
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-white/70">
        <li>Open OBS and set Service to Custom.</li>
        <li>Paste ingest URL and stream key.</li>
        <li>Apply the preset above before going live.</li>
        <li>Start streaming, then press "Start Session" in this console.</li>
      </ol>
      <p className="mt-3 text-[11px] text-white/50">Ingest type: {ingestType || "rtmp"}</p>
      {copyNotice && <p role="status" aria-live="polite" className="mt-2 text-xs text-gold">{copyNotice}</p>}
    </section>
  );
}
