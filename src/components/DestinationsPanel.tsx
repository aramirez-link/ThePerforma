import { useMemo, useState } from "react";
import type { DestinationProvider, LiveDestination } from "../lib/performaLive";

type Props = {
  sessionId: string;
  loading?: boolean;
  destinations: LiveDestination[];
  onUpsert: (args: {
    sessionId: string;
    destinationId?: string;
    provider: DestinationProvider;
    displayName: string;
    enabled: boolean;
    rtmpUrl: string;
    streamKey?: string;
  }) => Promise<void>;
};

const defaultForm = {
  provider: "twitch" as DestinationProvider,
  displayName: "Twitch Main",
  rtmpUrl: "rtmp://live.twitch.tv/app",
  streamKey: "",
  enabled: true
};

const providerLabels: Record<DestinationProvider, string> = {
  twitch: "Twitch",
  facebook: "Facebook",
  instagram_manual: "Instagram (Manual RTMP)",
  custom_rtmp: "Custom RTMP"
};

const optionByProvider: Record<DestinationProvider, { displayName: string; rtmpUrl: string }> = {
  twitch: { displayName: "Twitch Main", rtmpUrl: "rtmp://live.twitch.tv/app" },
  facebook: { displayName: "Facebook Main", rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp/" },
  instagram_manual: { displayName: "Instagram Manual", rtmpUrl: "rtmps://live-upload.instagram.com:443/rtmp/" },
  custom_rtmp: { displayName: "Custom Endpoint", rtmpUrl: "rtmp://example.com/live" }
};

export default function DestinationsPanel({ sessionId, loading, destinations, onUpsert }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const sorted = useMemo(() => [...destinations].sort((a, b) => a.created_at.localeCompare(b.created_at)), [destinations]);

  const submit = async () => {
    if (!form.displayName.trim() || !form.rtmpUrl.trim() || !form.streamKey.trim()) {
      setNotice("Display name, RTMP URL, and stream key are required.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await onUpsert({
        sessionId,
        provider: form.provider,
        displayName: form.displayName.trim(),
        enabled: form.enabled,
        rtmpUrl: form.rtmpUrl.trim(),
        streamKey: form.streamKey.trim()
      });
      setForm((current) => ({ ...current, streamKey: "" }));
      setNotice("Destination saved.");
    } finally {
      setBusy(false);
    }
  };

  const updateToggle = async (destination: LiveDestination, enabled: boolean) => {
    setBusy(true);
    try {
      await onUpsert({
        sessionId,
        destinationId: destination.id,
        provider: destination.provider,
        displayName: destination.display_name,
        enabled,
        rtmpUrl: destination.rtmp_url
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-black/45 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Destinations</p>
          <h2 className="mt-2 font-display text-xl">Simulcast Outputs</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-white/75">
          Provider
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
            value={form.provider}
            onChange={(event) => {
              const provider = event.target.value as DestinationProvider;
              const seed = optionByProvider[provider];
              setForm((current) => ({
                ...current,
                provider,
                displayName: seed.displayName,
                rtmpUrl: seed.rtmpUrl
              }));
            }}
          >
            <option value="twitch">Twitch</option>
            <option value="facebook">Facebook</option>
            <option value="instagram_manual">Instagram (Manual RTMP)</option>
            <option value="custom_rtmp">Custom RTMP</option>
          </select>
        </label>
        <label className="text-xs text-white/75">
          Display Name
          <input
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-2 text-xs text-white/75">
          RTMP URL
          <input
            value={form.rtmpUrl}
            onChange={(event) => setForm((current) => ({ ...current, rtmpUrl: event.target.value }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-2 text-xs text-white/75">
          Stream Key
          <input
            value={form.streamKey}
            onChange={(event) => setForm((current) => ({ ...current, streamKey: event.target.value }))}
            placeholder="Paste provider stream key (stored encrypted server-side)"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-white/75">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          className="h-4 w-4 accent-ember"
        />
        Enable destination immediately
      </label>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="mt-3 min-h-11 rounded-full border border-gold/50 bg-gold/10 px-4 text-[10px] uppercase tracking-[0.22em] text-gold disabled:opacity-60"
      >
        {busy ? "Saving..." : "Add Destination"}
      </button>

      <div className="mt-5 space-y-2">
        {loading && <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />}
        {!loading && !sorted.length && <p className="text-sm text-white/65">No destinations yet.</p>}
        {sorted.map((destination) => (
          <article key={destination.id} className="rounded-xl border border-white/15 bg-black/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">{destination.display_name}</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  {providerLabels[destination.provider]} · {destination.status}
                </p>
                {destination.last_error && <p className="mt-1 text-xs text-rose-300">{destination.last_error}</p>}
              </div>
              <button
                type="button"
                onClick={() => void updateToggle(destination, !destination.enabled)}
                disabled={busy}
                className="min-h-10 rounded-full border border-white/25 px-3 text-[10px] uppercase tracking-[0.2em] text-white/75"
              >
                {destination.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {notice && <p role="status" aria-live="polite" className="mt-3 text-xs text-gold">{notice}</p>}
    </section>
  );
}

