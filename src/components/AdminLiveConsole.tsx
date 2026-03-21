import { useEffect, useMemo, useState } from "react";
import {
  deleteLiveSession,
  endLiveSession,
  loadAdminLiveSessions,
  type LiveSession
} from "../lib/performaLive";
import {
  getCurrentUser,
  getSupabaseBrowser,
  isStoreAdmin,
  signInWithMagicLink,
  signInWithProvider,
  signOutStore
} from "../lib/storefront";
import PerformaLiveConsole from "./PerformaLiveConsole";

const ADMIN_NAV_KEY = "the-performa-admin-nav";

const statusTone: Record<string, string> = {
  LIVE: "border-emerald-400/45 bg-emerald-500/10 text-emerald-300",
  READY: "border-gold/45 bg-gold/10 text-gold",
  DRAFT: "border-white/20 bg-white/5 text-white/70",
  ENDED: "border-white/15 bg-black/30 text-white/55"
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Not set";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const compactId = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  return raw.length <= 12 ? raw : `${raw.slice(0, 8)}...${raw.slice(-4)}`;
};

const getTimelineLabel = (session: LiveSession) => {
  if (session.status === "LIVE" && session.started_at) return `Live since ${formatDateTime(session.started_at)}`;
  if (session.status === "READY" && session.scheduled_for) return `Scheduled ${formatDateTime(session.scheduled_for)}`;
  if (session.status === "ENDED" && session.ended_at) return `Ended ${formatDateTime(session.ended_at)}`;
  return `Created ${formatDateTime(session.created_at)}`;
};

const getHeartbeatTone = (value: string | null) => {
  if (!value) return "text-white/55";
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "text-white/55";
  if (ageMs <= 90_000) return "text-emerald-300";
  if (ageMs <= 300_000) return "text-gold";
  return "text-rose-300";
};

const statusRank: Record<string, number> = {
  LIVE: 0,
  READY: 1,
  DRAFT: 2,
  ENDED: 3
};

export default function AdminLiveConsole() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LiveSession["status"]>("all");
  const [query, setQuery] = useState("");
  const [actionSessionId, setActionSessionId] = useState("");
  const [actionKind, setActionKind] = useState<"" | "ending" | "deleting">("");

  const refresh = async (preferredSessionId = selectedSessionId) => {
    const result = await loadAdminLiveSessions();
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    const nextSessions = [...result.data].sort((left, right) => {
      const rankDelta = (statusRank[left.status] ?? 99) - (statusRank[right.status] ?? 99);
      if (rankDelta !== 0) return rankDelta;
      const leftTime = Date.parse(left.scheduled_for || left.started_at || left.created_at || "");
      const rightTime = Date.parse(right.scheduled_for || right.started_at || right.created_at || "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });

    setSessions(nextSessions);
    const preferred =
      nextSessions.find((session) => session.id === preferredSessionId)?.id ||
      nextSessions[0]?.id ||
      "";
    setSelectedSessionId(preferred);
  };

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      const user = await getCurrentUser();
      setUserEmail(user?.email || "");
      const admin = await isStoreAdmin();
      setIsAdmin(admin);
      if (typeof window !== "undefined") {
        if (admin) localStorage.setItem(ADMIN_NAV_KEY, "true");
        else localStorage.removeItem(ADMIN_NAV_KEY);
      }
      if (admin) await refresh();
      setLoading(false);
    };

    void boot();

    const supabase = getSupabaseBrowser();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      void boot();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (statusFilter !== "all" && session.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        session.title,
        session.status,
        session.provider,
        session.ingest_type,
        session.creator_id,
        session.id
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, sessions, statusFilter]);

  useEffect(() => {
    if (!visibleSessions.length) return;
    if (!visibleSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(visibleSessions[0].id);
    }
  }, [selectedSessionId, visibleSessions]);

  const selectedSession = visibleSessions.find((session) => session.id === selectedSessionId) || null;

  const liveCount = sessions.filter((session) => session.status === "LIVE").length;
  const readyCount = sessions.filter((session) => session.status === "READY").length;
  const endedCount = sessions.filter((session) => session.status === "ENDED").length;
  const staleCount = sessions.filter((session) => {
    if (!session.ingest_last_heartbeat_at) return false;
    const ageMs = Date.now() - new Date(session.ingest_last_heartbeat_at).getTime();
    return Number.isFinite(ageMs) && ageMs > 300_000 && session.status !== "ENDED";
  }).length;

  const runEndSession = async (session: LiveSession) => {
    setActionSessionId(session.id);
    setActionKind("ending");
    const result = await endLiveSession(session.id);
    setActionSessionId("");
    setActionKind("");
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Ended "${session.title}".`);
    await refresh(session.id);
  };

  const runDeleteSession = async (session: LiveSession) => {
    if (session.status === "LIVE") {
      setNotice("End the live session before deleting it.");
      return;
    }
    const approved = window.confirm(`Delete "${session.title}"? This removes the session record and associated stream resources.`);
    if (!approved) return;

    setActionSessionId(session.id);
    setActionKind("deleting");
    const result = await deleteLiveSession(session.id);
    setActionSessionId("");
    setActionKind("");
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Deleted "${session.title}".`);
    await refresh();
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/70">Loading live admin console...</p>
        </div>
      </section>
    );
  }

  if (!userEmail) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Live Operations</p>
          <h1 className="mt-2 font-display text-3xl">Sign In</h1>
          <p className="mt-2 text-sm text-white/70">Use an admin account to monitor every active and historical Performa stream session.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@theperforma.com"
              className="min-h-11 flex-1 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                void signInWithMagicLink(email, "/admin/live").then((result) => {
                  setBusy(false);
                  setNotice(result.ok ? "Check your email for the magic link." : result.error);
                });
              }}
              disabled={busy}
              className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink"
            >
              {busy ? "Sending..." : "Magic Link"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["google", "github", "facebook", "apple"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => void signInWithProvider(provider, "/admin/live").then((result) => !result.ok && setNotice(result.error))}
                className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75"
              >
                {provider}
              </button>
            ))}
          </div>
          {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Live Operations</p>
          <h1 className="mt-2 font-display text-3xl">Access Restricted</h1>
          <p className="mt-2 text-sm text-white/70">Signed in as {userEmail}, but this account is not listed in `store_admins`.</p>
          <button
            type="button"
            onClick={() => void signOutStore()}
            className="mt-4 min-h-11 rounded-full border border-white/25 px-5 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
          >
            Sign Out
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Live Admin</p>
              <h1 className="mt-2 font-display text-4xl">Stream Session Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/65">
                Monitor every active, queued, and historical stream session, then jump into the full session console to manage ingest,
                schedule, destinations, and playback health.
              </p>
              <p className="mt-3 text-xs text-white/50">{userEmail}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/live/new"
                className="min-h-11 rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold"
              >
                New Session
              </a>
              <button
                type="button"
                onClick={() => void refresh()}
                className="min-h-11 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
              >
                Refresh List
              </button>
              <button
                type="button"
                onClick={() => void signOutStore()}
                className="min-h-11 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Total Sessions" value={String(sessions.length)} detail="Historical + active inventory." />
            <SummaryCard label="Live Now" value={String(liveCount)} detail="Sessions currently on air." tone="live" />
            <SummaryCard label="Ready Queue" value={String(readyCount)} detail="Prepared sessions awaiting go-live." tone="ready" />
            <SummaryCard label="Historical" value={String(endedCount)} detail="Sessions already completed." />
            <SummaryCard label="Stale Signals" value={String(staleCount)} detail="Heartbeat older than five minutes." tone={staleCount ? "stale" : "default"} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["all", "LIVE", "READY", "DRAFT", "ENDED"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`min-h-10 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
                  statusFilter === value ? "border-gold/45 bg-gold/10 text-gold" : "border-white/20 text-white/70"
                }`}
              >
                {value === "all" ? "All Sessions" : value}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, session id, creator id, provider..."
              className="min-h-11 w-full rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-sm text-white/85"
            />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {visibleSessions.length ? (
              visibleSessions.map((session) => {
                const isSelected = session.id === selectedSession?.id;
                const timeline = getTimelineLabel(session);
                const isWorking = actionSessionId === session.id;
                return (
                  <article
                    key={session.id}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected ? "border-gold/45 bg-gold/10" : "border-white/12 bg-black/30 hover:border-white/25"
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedSessionId(session.id)} className="w-full text-left">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-white">{session.title}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/45">{compactId(session.id)}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${statusTone[session.status] || statusTone.DRAFT}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                        <p>Provider: {session.provider.replace(/_/g, " ")}</p>
                        <p>Ingest: {String(session.ingest_type || "rtmp").toUpperCase()}</p>
                        <p>Creator: {compactId(session.creator_id)}</p>
                        <p className={getHeartbeatTone(session.ingest_last_heartbeat_at)}>
                          Heartbeat: {formatDateTime(session.ingest_last_heartbeat_at)}
                        </p>
                      </div>
                      <p className="mt-3 text-sm text-white/75">{timeline}</p>
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <button
                        type="button"
                        onClick={() => void runEndSession(session)}
                        disabled={isWorking || session.status === "ENDED"}
                        className="min-h-10 rounded-full border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-rose-200 disabled:opacity-45"
                      >
                        {isWorking && actionKind === "ending" ? "Ending..." : "End Session"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runDeleteSession(session)}
                        disabled={isWorking || session.status === "LIVE"}
                        className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 disabled:opacity-45"
                      >
                        {isWorking && actionKind === "deleting" ? "Deleting..." : "Delete Session"}
                      </button>
                      <a
                        href={`/live/session?id=${session.id}`}
                        className="min-h-10 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold"
                      >
                        Open Stream Console
                      </a>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/12 bg-black/30 p-5 text-sm text-white/60 lg:col-span-2">
                No sessions matched the current filters.
              </div>
            )}
          </div>

          {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}
        </div>
      </section>

      {selectedSession ? (
        <>
          <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="rounded-2xl border border-white/12 bg-black/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Selected Session</p>
                  <p className="mt-1 text-sm text-white/80">
                    {selectedSession.title} · {compactId(selectedSession.id)}
                  </p>
                </div>
                <a
                  href={`/live/session?id=${selectedSession.id}`}
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75"
                >
                  Open Standalone Console
                </a>
              </div>
            </div>
          </section>
          <PerformaLiveConsole key={selectedSession.id} sessionId={selectedSession.id} />
        </>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "live" | "ready" | "stale";
}) {
  const toneClass =
    tone === "live"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : tone === "ready"
      ? "border-gold/30 bg-gold/10"
      : tone === "stale"
      ? "border-rose-400/30 bg-rose-500/10"
      : "border-white/12 bg-black/30";

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">{label}</p>
      <p className="mt-3 font-display text-3xl text-white">{value}</p>
      <p className="mt-2 text-xs text-white/60">{detail}</p>
    </article>
  );
}
