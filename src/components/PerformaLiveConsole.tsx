import { useEffect, useState } from "react";
import DestinationsPanel from "./DestinationsPanel";
import HealthPanel from "./HealthPanel";
import IngestCard from "./IngestCard";
import LiveSessionHeader from "./LiveSessionHeader";
import {
  endLiveSession,
  loadLiveDestinations,
  loadLiveSessionById,
  syncLiveSession,
  startLiveSession,
  upsertLiveDestination,
  type LiveDestination,
  type LiveSession
} from "../lib/performaLive";
import PerformaLivePlayer from "./PerformaLivePlayer";

type Props = {
  sessionId?: string;
};

const getSessionIdFromPath = () => {
  if (typeof window === "undefined") return "";
  const fromQuery = new URLSearchParams(window.location.search).get("id");
  if (fromQuery) return fromQuery;
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

export default function PerformaLiveConsole({ sessionId }: Props) {
  const effectiveSessionId = sessionId || getSessionIdFromPath();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [destinations, setDestinations] = useState<LiveDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");

  const refresh = async () => {
    if (!effectiveSessionId) {
      setLoading(false);
      setNotice("Missing session id.");
      return;
    }
    setLoading(true);
    // Poll provider ingest state (fallback when webhooks are delayed/misconfigured).
    await syncLiveSession(effectiveSessionId);
    const [sessionResult, destinationsResult] = await Promise.all([
      loadLiveSessionById(effectiveSessionId),
      loadLiveDestinations(effectiveSessionId)
    ]);
    if (sessionResult.ok) setSession(sessionResult.data);
    else setNotice(sessionResult.error);
    if (destinationsResult.ok) setDestinations(destinationsResult.data);
    else setNotice(destinationsResult.error);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [effectiveSessionId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runStart = async () => {
    if (!session) return;
    setBusy(true);
    const response = await startLiveSession(session.id);
    setBusy(false);
    if (!response.ok) {
      setToast(response.error);
      return;
    }
    setToast("Session start requested.");
    await refresh();
  };

  const runEnd = async () => {
    if (!session) return;
    setBusy(true);
    const response = await endLiveSession(session.id);
    setBusy(false);
    if (!response.ok) {
      setToast(response.error);
      return;
    }
    setToast("Session ended.");
    await refresh();
  };

  if (loading) {
    return (
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </section>
    );
  }

  if (!session) {
    return (
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-white/15 bg-black/45 p-5">
          <p className="text-sm text-rose-300">{notice || "Session not found."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-6xl space-y-4 px-4 sm:px-6">
      <LiveSessionHeader session={session} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runStart()}
          disabled={busy || session.status === "LIVE" || session.status === "ENDED"}
          className="min-h-11 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 text-[10px] uppercase tracking-[0.22em] text-emerald-300 disabled:opacity-55"
        >
          Start Session
        </button>
        <button
          type="button"
          onClick={() => void runEnd()}
          disabled={busy || session.status === "ENDED"}
          className="min-h-11 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 text-[10px] uppercase tracking-[0.22em] text-rose-300 disabled:opacity-55"
        >
          End Session
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="min-h-11 rounded-full border border-white/25 px-4 text-[10px] uppercase tracking-[0.22em] text-white/75"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <IngestCard ingestUrl={session.ingest_url} ingestType={session.ingest_type} />
        <HealthPanel session={session} destinations={destinations} />
      </div>

      <PerformaLivePlayer
        playbackId={session.provider_playback_id}
        title={session.title}
        isLive={session.status === "LIVE" || String(session.ingest_status || "").toUpperCase() === "LIVE"}
        ingestType={session.ingest_type}
        latencyMode={session.ingest_type === "rtmp" ? "ll-hls" : "standard"}
        health={
          !session.ingest_last_heartbeat_at
            ? "starting"
            : Date.now() - new Date(session.ingest_last_heartbeat_at).getTime() <= 90_000
            ? "healthy"
            : "stale"
        }
        ingestHeartbeatAt={session.ingest_last_heartbeat_at}
      />

      <DestinationsPanel
        sessionId={session.id}
        loading={loading}
        destinations={destinations}
        onUpsert={async (args) => {
          const response = await upsertLiveDestination(args);
          if (!response.ok) {
            setToast(response.error);
            return;
          }
          setToast("Destination updated.");
          await refresh();
        }}
      />

      {(notice || toast) && (
        <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-20 rounded-xl border border-white/20 bg-black/80 px-4 py-3 text-xs text-gold shadow-lg">
          {toast || notice}
        </div>
      )}
    </section>
  );
}
