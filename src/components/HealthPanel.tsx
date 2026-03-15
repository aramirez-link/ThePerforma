import type { LiveDestination, LiveSession } from "../lib/performaLive";

type Props = {
  session: LiveSession;
  destinations: LiveDestination[];
};

const formatTime = (value: string | null) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const ageLabel = (value: string | null) => {
  if (!value) return "No signal";
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "No signal";
  if (ageMs < 15_000) return "Fresh";
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  return `${Math.round(ageMs / 60_000)}m ago`;
};

const healthTone = (value: string | null) => {
  if (!value) return "text-rose-300";
  const ageMs = Date.now() - new Date(value).getTime();
  if (ageMs <= 15_000) return "text-emerald-300";
  if (ageMs <= 90_000) return "text-gold";
  return "text-rose-300";
};

export default function HealthPanel({ session, destinations }: Props) {
  const liveCount = destinations.filter((row) => row.status === "LIVE").length;
  const errorCount = destinations.filter((row) => row.status === "ERROR").length;
  const enabledCount = destinations.filter((row) => row.enabled).length;
  const ingestTone = healthTone(session.ingest_last_heartbeat_at);

  return (
    <section className="rounded-2xl border border-white/15 bg-black/45 p-4 md:p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Health</p>
      <h2 className="mt-2 font-display text-xl">Ingest + Destination Telemetry</h2>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Origin</p>
          <p className="mt-1 text-white/90">
            {session.ingest_type?.toUpperCase() || "RTMP"} ingest
            <span className="mx-2 text-white/35">|</span>
            <span className={ingestTone}>{ageLabel(session.ingest_last_heartbeat_at)}</span>
          </p>
          <p className="mt-2 text-xs text-white/60">Session status: {session.status}</p>
          <p className="mt-1 text-xs text-white/60">Ingest status: {session.ingest_status}</p>
          <p className="mt-1 text-xs text-white/60">Last webhook: {formatTime(session.last_webhook_at)}</p>
          <p className="mt-1 text-xs text-white/60">Ingest heartbeat: {formatTime(session.ingest_last_heartbeat_at)}</p>
        </div>

        <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Destinations</p>
          <p className="mt-1 text-white/90">
            {liveCount} live
            <span className="mx-2 text-white/35">|</span>
            <span className={errorCount ? "text-rose-300" : "text-emerald-300"}>{errorCount} errors</span>
          </p>
          <p className="mt-2 text-xs text-white/60">Enabled outputs: {enabledCount}</p>
          <p className="mt-1 text-xs text-white/60">Configured outputs: {destinations.length}</p>
          <p className="mt-1 text-xs text-white/60">Playback mode: {session.ingest_type === "rtmp" ? "LL-HLS preferred" : "Realtime path"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {destinations.length ? (
          destinations.map((destination) => (
            <div key={destination.id} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/75">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/90">{destination.display_name}</span>
                <span className="text-white/35">|</span>
                <span className={destination.status === "ERROR" ? "text-rose-300" : destination.status === "LIVE" ? "text-emerald-300" : "text-white/75"}>
                  {destination.status}
                </span>
                <span className="text-white/35">|</span>
                <span className={healthTone(destination.destination_heartbeat_at)}>
                  Heartbeat {ageLabel(destination.destination_heartbeat_at)}
                </span>
              </div>
              {destination.last_error && <p className="mt-1 text-[11px] text-rose-300">{destination.last_error}</p>}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-xs text-white/60">
            No simulcast destinations configured yet.
          </div>
        )}
      </div>
    </section>
  );
}
