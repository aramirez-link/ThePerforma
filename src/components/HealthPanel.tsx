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

export default function HealthPanel({ session, destinations }: Props) {
  const liveCount = destinations.filter((row) => row.status === "LIVE").length;
  const errorCount = destinations.filter((row) => row.status === "ERROR").length;
  return (
    <section className="rounded-2xl border border-white/15 bg-black/45 p-4 md:p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Health</p>
      <h2 className="mt-2 font-display text-xl">Ingest + Destination Telemetry</h2>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ingest Status</p>
          <p className="mt-1">{session.ingest_status}</p>
          <p className="mt-2 text-xs text-white/60">Last webhook: {formatTime(session.last_webhook_at)}</p>
          <p className="mt-1 text-xs text-white/60">Ingest heartbeat: {formatTime(session.ingest_last_heartbeat_at)}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Destinations</p>
          <p className="mt-1">{liveCount} live · {errorCount} errors</p>
          <p className="mt-2 text-xs text-white/60">Enabled: {destinations.filter((row) => row.enabled).length}</p>
          <p className="mt-1 text-xs text-white/60">Total: {destinations.length}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {destinations.map((destination) => (
          <div key={destination.id} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/75">
            <span className="text-white/90">{destination.display_name}</span>
            <span className="mx-2 text-white/35">·</span>
            <span>{destination.status}</span>
            <span className="mx-2 text-white/35">·</span>
            <span>Heartbeat: {formatTime(destination.destination_heartbeat_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

