import { useEffect, useMemo, useState } from "react";
import { createFeedPost } from "../lib/fanVault";
import {
  adminForceDeleteLiveSession,
  adminForceEndLiveSession,
  deleteLiveSession,
  endLiveSession,
  loadAdminLivePresence,
  loadAdminLiveSessions,
  type LiveSession,
  type LiveSessionPresence
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
const ACTIVE_VIEWER_WINDOW_MS = 90_000;

const statusTone: Record<string, string> = {
  LIVE: "border-emerald-400/45 bg-emerald-500/10 text-emerald-300",
  READY: "border-gold/45 bg-gold/10 text-gold",
  DRAFT: "border-white/20 bg-white/5 text-white/70",
  ENDED: "border-white/15 bg-black/30 text-white/55"
};

const statusRank: Record<string, number> = {
  LIVE: 0,
  READY: 1,
  DRAFT: 2,
  ENDED: 3
};

const emptyPresenceStats = {
  trackedCount: 0,
  activeCount: 0,
  mobileCount: 0,
  tabletCount: 0,
  desktopCount: 0,
  lastSeenAt: null as string | null
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

const isPresenceActive = (presence: LiveSessionPresence) => {
  const ageMs = Date.now() - new Date(presence.last_seen_at).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= ACTIVE_VIEWER_WINDOW_MS;
};

const formatPresenceAge = (value: string | null) => {
  if (!value) return "never";
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "just now";

  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const getViewerInitials = (value: string) => {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return "FV";
  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("");
};

export default function AdminLiveConsole() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [presence, setPresence] = useState<LiveSessionPresence[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LiveSession["status"]>("all");
  const [query, setQuery] = useState("");
  const [actionSessionId, setActionSessionId] = useState("");
  const [actionKind, setActionKind] = useState<"" | "ending" | "deleting">("");
  const [messageTarget, setMessageTarget] = useState<LiveSessionPresence | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);

  const refresh = async (preferredSessionId = selectedSessionId) => {
    const [sessionsResult, presenceResult] = await Promise.all([loadAdminLiveSessions(), loadAdminLivePresence()]);
    if (!sessionsResult.ok) {
      setNotice(sessionsResult.error);
      return;
    }
    if (!presenceResult.ok) {
      setNotice(presenceResult.error);
    } else {
      setPresence(presenceResult.data);
    }

    const nextSessions = [...sessionsResult.data].sort((left, right) => {
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
    if (!isAdmin) return;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [isAdmin, selectedSessionId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (statusFilter !== "all" && session.status !== statusFilter) return false;
      if (!needle) return true;
      return [session.title, session.status, session.provider, session.ingest_type, session.creator_id, session.id]
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
  const presenceBySession = useMemo(() => {
    const next = new Map<string, typeof emptyPresenceStats>();

    for (const row of presence) {
      const current = next.get(row.session_id) || { ...emptyPresenceStats };
      current.trackedCount += 1;
      if (isPresenceActive(row)) current.activeCount += 1;
      if (row.device_kind === "mobile_web") current.mobileCount += 1;
      else if (row.device_kind === "tablet_web") current.tabletCount += 1;
      else current.desktopCount += 1;
      if (!current.lastSeenAt || new Date(row.last_seen_at).getTime() > new Date(current.lastSeenAt).getTime()) {
        current.lastSeenAt = row.last_seen_at;
      }
      next.set(row.session_id, current);
    }

    return next;
  }, [presence]);
  const selectedPresence = useMemo(
    () =>
      presence
        .filter((entry) => entry.session_id === selectedSessionId)
        .sort((left, right) => new Date(right.last_seen_at).getTime() - new Date(left.last_seen_at).getTime()),
    [presence, selectedSessionId]
  );
  const selectedPresenceStats = selectedSession ? presenceBySession.get(selectedSession.id) || { ...emptyPresenceStats } : { ...emptyPresenceStats };

  const liveCount = sessions.filter((session) => session.status === "LIVE").length;
  const readyCount = sessions.filter((session) => session.status === "READY").length;
  const endedCount = sessions.filter((session) => session.status === "ENDED").length;
  const staleCount = sessions.filter((session) => {
    if (!session.ingest_last_heartbeat_at) return false;
    const ageMs = Date.now() - new Date(session.ingest_last_heartbeat_at).getTime();
    return Number.isFinite(ageMs) && ageMs > 300_000 && session.status !== "ENDED";
  }).length;
  const activeViewerCount = presence.filter(isPresenceActive).length;
  const observedViewerCount = new Set(presence.map((entry) => entry.user_id)).size;

  useEffect(() => {
    if (messageTarget && messageTarget.session_id !== selectedSessionId) {
      setMessageTarget(null);
      setMessageBody("");
    }
  }, [messageTarget, selectedSessionId]);

  const runEndSession = async (session: LiveSession) => {
    setActionSessionId(session.id);
    setActionKind("ending");
    try {
      let result;
      try {
        result = await endLiveSession(session.id);
      } catch (error) {
        result = {
          ok: false as const,
          error: error instanceof Error ? error.message : "Edge Function end failed."
        };
      }

      if (!result.ok) {
        const fallback = await adminForceEndLiveSession(session.id);
        if (!fallback.ok) {
          setNotice(fallback.error || result.error);
          return;
        }
        setNotice(`Ended "${session.title}" via direct admin fallback.`);
        await refresh(session.id);
        return;
      }

      setNotice(`Ended "${session.title}".`);
      await refresh(session.id);
    } finally {
      setActionSessionId("");
      setActionKind("");
    }
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
    try {
      let result;
      try {
        result = await deleteLiveSession(session.id);
      } catch (error) {
        result = {
          ok: false as const,
          error: error instanceof Error ? error.message : "Edge Function delete failed."
        };
      }

      if (!result.ok) {
        const fallback = await adminForceDeleteLiveSession(session.id);
        if (!fallback.ok) {
          setNotice(fallback.error || result.error);
          return;
        }
        setNotice(`Deleted "${session.title}" via direct admin fallback.`);
        await refresh();
        return;
      }

      setNotice(`Deleted "${session.title}".`);
      await refresh();
    } finally {
      setActionSessionId("");
      setActionKind("");
    }
  };

  const runSendViewerMessage = async () => {
    if (!selectedSession) {
      setNotice("Select a session before sending a chat note.");
      return;
    }
    if (selectedSession.status === "ENDED") {
      setNotice("This session has ended. Select an active or ready session to message viewers.");
      return;
    }
    if (!messageTarget) {
      setNotice("Choose a viewer from the observability list first.");
      return;
    }

    const cleanMessage = messageBody.trim();
    if (!cleanMessage) {
      setNotice("Write a short message before sending.");
      return;
    }

    setMessageSending(true);
    try {
      const result = await createFeedPost({
        body: `Host note for @${messageTarget.display_name}: ${cleanMessage}`,
        liveSessionId: selectedSession.id,
        postKind: "announcement"
      });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(`Sent a host message for ${messageTarget.display_name} into the session chat.`);
      setMessageBody("");
    } finally {
      setMessageSending(false);
    }
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
                Monitor every active, queued, and historical stream session, see signed-in viewer presence across those sessions, and push host notes directly into the live chat feed.
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
            <SummaryCard
              label="Active Viewers"
              value={String(activeViewerCount)}
              detail="Signed-in viewers active in the last 90 seconds."
              tone={activeViewerCount ? "live" : "default"}
            />
            <SummaryCard label="Observed Profiles" value={String(observedViewerCount)} detail="Unique signed-in viewers tracked across sessions." />
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
                const sessionPresence = presenceBySession.get(session.id) || { ...emptyPresenceStats };

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
                        <p>Viewers: {sessionPresence.activeCount} active · {sessionPresence.trackedCount} tracked</p>
                        <p>Mobile: {sessionPresence.mobileCount} · Desktop: {sessionPresence.desktopCount + sessionPresence.tabletCount}</p>
                      </div>
                      <p className="mt-3 text-sm text-white/75">{timeline}</p>
                      {sessionPresence.lastSeenAt ? (
                        <p className="mt-2 text-xs text-white/45">Observed last viewer {formatPresenceAge(sessionPresence.lastSeenAt)}</p>
                      ) : null}
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
            <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
              <div className="rounded-2xl border border-white/12 bg-black/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Selected Session</p>
                    <p className="mt-1 text-sm text-white/80">
                      {selectedSession.title} · {compactId(selectedSession.id)}
                    </p>
                    <p className="mt-2 text-xs text-white/50">{getTimelineLabel(selectedSession)}</p>
                  </div>
                  <a
                    href={`/live/session?id=${selectedSession.id}`}
                    className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75"
                  >
                    Open Standalone Console
                  </a>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SummaryCard
                    label="Active Now"
                    value={String(selectedPresenceStats.activeCount)}
                    detail="Viewer heartbeat inside 90 seconds."
                    tone={selectedPresenceStats.activeCount ? "live" : "default"}
                  />
                  <SummaryCard
                    label="Tracked Viewers"
                    value={String(selectedPresenceStats.trackedCount)}
                    detail="Signed-in profiles observed in this session."
                  />
                  <SummaryCard label="Mobile Web" value={String(selectedPresenceStats.mobileCount)} detail="Tracked mobile footprints on this session." />
                  <SummaryCard
                    label="Last Seen"
                    value={selectedPresenceStats.lastSeenAt ? formatPresenceAge(selectedPresenceStats.lastSeenAt) : "None"}
                    detail="Most recent viewer heartbeat on this session."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/12 bg-black/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gold/80">Live Observability</p>
                    <h2 className="mt-2 font-display text-2xl">Viewer Presence + Targeted Chat</h2>
                    <p className="mt-2 max-w-2xl text-sm text-white/65">
                      This roster tracks signed-in viewers who opened the live stream surface. Pick one and send a visible host note into the session chat feed.
                    </p>
                  </div>
                  <p className="text-xs text-white/45">Auto-refresh every 15s</p>
                </div>

                <div className="mt-4 rounded-2xl border border-white/12 bg-black/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Targeted Stream Message</p>
                  <p className="mt-2 text-sm text-white/70">
                    {messageTarget
                      ? `Send a host announcement into chat for ${messageTarget.display_name}. Everyone in the session will see it.`
                      : "Choose a viewer below to target the next host note."}
                  </p>
                  <textarea
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    placeholder={messageTarget ? `Message for ${messageTarget.display_name}...` : "Select a viewer first..."}
                    rows={3}
                    className="mt-3 min-h-24 w-full rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-white/85 placeholder:text-white/30"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void runSendViewerMessage()}
                      disabled={messageSending || !messageTarget || !messageBody.trim() || selectedSession.status === "ENDED"}
                      className="min-h-10 rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold disabled:opacity-45"
                    >
                      {messageSending ? "Sending..." : "Send Into Chat"}
                    </button>
                    {messageTarget ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMessageTarget(null);
                          setMessageBody("");
                        }}
                        className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70"
                      >
                        Clear Target
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedPresence.length ? (
                    selectedPresence.map((viewer) => {
                      const activeNow = isPresenceActive(viewer);
                      const isTargeted = messageTarget?.session_id === viewer.session_id && messageTarget.user_id === viewer.user_id;

                      return (
                        <article key={`${viewer.session_id}:${viewer.user_id}`} className="rounded-2xl border border-white/12 bg-black/30 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {viewer.avatar_url ? (
                                <img src={viewer.avatar_url} alt={viewer.display_name} className="h-12 w-12 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-gold/10 text-sm font-semibold text-gold">
                                  {getViewerInitials(viewer.display_name)}
                                </div>
                              )}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm text-white">{viewer.display_name}</p>
                                  <span
                                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                                      activeNow
                                        ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300"
                                        : "border-white/15 bg-white/5 text-white/55"
                                    }`}
                                  >
                                    {activeNow ? "Active Now" : "Idle"}
                                  </span>
                                  {isTargeted ? (
                                    <span className="rounded-full border border-gold/45 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gold">
                                      Targeted
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-white/55">{viewer.user_email || compactId(viewer.user_id)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMessageTarget(viewer)}
                              className={`min-h-10 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
                                isTargeted ? "border-gold/45 bg-gold/10 text-gold" : "border-white/20 text-white/70"
                              }`}
                            >
                              {isTargeted ? "Target Selected" : "Message in Chat"}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-2 text-xs text-white/60 md:grid-cols-2">
                            <p>Joined: {formatDateTime(viewer.joined_at)}</p>
                            <p>
                              Last seen: {formatDateTime(viewer.last_seen_at)} · {formatPresenceAge(viewer.last_seen_at)}
                            </p>
                            <p>Device: {viewer.device_kind.replace(/_/g, " ")}</p>
                            <p>Path: {viewer.last_path || "/watch"}</p>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/12 bg-black/30 p-4 text-sm text-white/60">
                      No signed-in viewers have been tracked on this session yet.
                    </div>
                  )}
                </div>
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
