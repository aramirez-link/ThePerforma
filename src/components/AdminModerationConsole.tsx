import { useEffect, useMemo, useState } from "react";
import {
  getFeedModerationEnabled,
  getFeedModerationReports,
  moderateFeedItem,
  setFeedModerationEnabled,
  updateFeedReportStatus,
  type FeedModerationReport,
  type FeedModerationStatus,
  type FeedReportStatus
} from "../lib/fanVault";
import { getCurrentUser, getSupabaseBrowser, isStoreAdmin, signOutStore } from "../lib/storefront";

type TargetPreview = {
  id: string;
  type: "post" | "comment";
  authorId: string;
  body: string;
  mediaUrl: string | null;
  moderationStatus: FeedModerationStatus;
  moderationReason: string | null;
  createdAt: string;
};

const moderationActions: Array<{ label: string; value: FeedModerationStatus }> = [
  { label: "Approve", value: "approved" },
  { label: "Flag", value: "flagged" },
  { label: "Reject", value: "rejected" }
];

const reportStatusActions: Array<{ label: string; value: FeedReportStatus }> = [
  { label: "Reviewed", value: "reviewed" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismiss", value: "dismissed" }
];
const ADMIN_NAV_KEY = "the-performa-admin-nav";

const prettyDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function AdminModerationConsole() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<FeedModerationReport[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetPreview>>({});
  const [statusFilter, setStatusFilter] = useState<FeedReportStatus | "all">("open");
  const [moderationEnabled, setModerationEnabledState] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  const refresh = async () => {
    const [reportResult, moderationResult] = await Promise.all([
      getFeedModerationReports(200),
      getFeedModerationEnabled()
    ]);
    if (!reportResult.ok) {
      setNotice(reportResult.error);
      return;
    }
    if (moderationResult.ok) {
      setModerationEnabledState(moderationResult.enabled);
    }
    setReports(reportResult.reports);

    const postIds = Array.from(new Set(reportResult.reports.filter((r) => r.targetType === "post").map((r) => Number(r.targetId))));
    const commentIds = Array.from(new Set(reportResult.reports.filter((r) => r.targetType === "comment").map((r) => Number(r.targetId))));
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const [{ data: postRows }, { data: commentRows }] = await Promise.all([
      postIds.length
        ? supabase
            .from("fan_feed_posts")
            .select("id,user_id,body,media_url,moderation_status,moderation_reason,created_at")
            .in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      commentIds.length
        ? supabase
            .from("fan_feed_comments")
            .select("id,user_id,body,moderation_status,moderation_reason,created_at")
            .in("id", commentIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const nextTargets: Record<string, TargetPreview> = {};
    (postRows || []).forEach((row: any) => {
      nextTargets[`post:${row.id}`] = {
        id: String(row.id),
        type: "post",
        authorId: row.user_id,
        body: row.body || "",
        mediaUrl: row.media_url || null,
        moderationStatus: (row.moderation_status as FeedModerationStatus) || "approved",
        moderationReason: row.moderation_reason || null,
        createdAt: row.created_at
      };
    });
    (commentRows || []).forEach((row: any) => {
      nextTargets[`comment:${row.id}`] = {
        id: String(row.id),
        type: "comment",
        authorId: row.user_id,
        body: row.body || "",
        mediaUrl: null,
        moderationStatus: (row.moderation_status as FeedModerationStatus) || "approved",
        moderationReason: row.moderation_reason || null,
        createdAt: row.created_at
      };
    });
    setTargets(nextTargets);
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
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleReports = useMemo(
    () => reports.filter((report) => statusFilter === "all" || report.status === statusFilter),
    [reports, statusFilter]
  );

  const sendMagicLink = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/moderation` : undefined
      }
    });
    setBusy(false);
    setNotice(error ? error.message : "Check your email for the magic link.");
  };

  const loginProvider = async (provider: "google" | "github" | "facebook" | "apple") => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/moderation` : undefined
      }
    });
    if (error) setNotice(error.message);
  };

  const onModerate = async (report: FeedModerationReport, status: FeedModerationStatus) => {
    const reason = window.prompt("Moderation reason (optional):", "") || "";
    const result = await moderateFeedItem({
      targetType: report.targetType,
      targetId: report.targetId,
      status,
      reason: reason || null
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    await updateFeedReportStatus({ reportId: report.id, status: "reviewed" });
    setNotice(`Content marked ${status}.`);
    await refresh();
  };

  const onReportStatus = async (reportId: number, status: FeedReportStatus) => {
    const result = await updateFeedReportStatus({ reportId, status });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Report moved to ${status}.`);
    await refresh();
  };

  const onToggleModeration = async () => {
    setToggleBusy(true);
    const next = !moderationEnabled;
    const result = await setFeedModerationEnabled(next);
    setToggleBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setModerationEnabledState(result.enabled);
    setNotice(result.enabled ? "Feed moderation enabled." : "Feed moderation disabled.");
    await refresh();
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/70">Loading moderation console...</p>
        </div>
      </section>
    );
  }

  if (!userEmail) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Admin Moderation</p>
          <h1 className="mt-2 font-display text-3xl">Sign In</h1>
          <p className="mt-2 text-sm text-white/70">Use a magic link or federated login. Access is restricted to users in `store_admins`.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@theperforma.com"
              className="min-h-11 flex-1 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
            />
            <button type="button" onClick={sendMagicLink} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink">
              {busy ? "Sending..." : "Magic Link"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["google", "github", "facebook", "apple"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => loginProvider(provider)}
                className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/80"
              >
                {provider}
              </button>
            ))}
          </div>
          {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/75">
            Signed in as {userEmail}, but this account is not in `store_admins`.
          </p>
          <button
            type="button"
            onClick={async () => {
              localStorage.removeItem(ADMIN_NAV_KEY);
              await signOutStore();
              window.location.reload();
            }}
            className="mt-4 min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white/80"
          >
            Sign out
          </button>
          {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Admin Moderation</p>
            <h1 className="mt-2 font-display text-3xl">Safety Queue</h1>
            <p className="mt-1 text-sm text-white/70">{userEmail}</p>
            <p className="mt-1 text-xs text-white/60">
              Moderation: {moderationEnabled ? "ON (new posts/comments may be queued)" : "OFF (new posts/comments auto-approved)"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleModeration}
              disabled={toggleBusy}
              className="min-h-11 rounded-full border border-gold/45 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-gold disabled:opacity-50"
            >
              {toggleBusy ? "Updating..." : moderationEnabled ? "Turn Moderation Off" : "Turn Moderation On"}
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeedReportStatus | "all")}
              className="min-h-11 rounded-full border border-white/30 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/80"
            >
              <option value="all">all</option>
              <option value="open">open</option>
              <option value="reviewed">reviewed</option>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
            </select>
            <button
              type="button"
            onClick={async () => {
              localStorage.removeItem(ADMIN_NAV_KEY);
              await signOutStore();
              window.location.reload();
            }}
              className="min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white/80"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleReports.map((report) => {
          const target = targets[`${report.targetType}:${report.targetId}`];
          return (
            <article key={report.id} className="rounded-3xl border border-white/15 bg-black/35 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold/80">
                    Report #{report.id} • {report.targetType}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    Reason: {report.reasonCode} • Status: {report.status} • {prettyDate(report.createdAt)}
                  </p>
                  {report.details && <p className="mt-1 text-xs text-white/65">Notes: {report.details}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {reportStatusActions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() => onReportStatus(report.id, action.value)}
                      className="min-h-10 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/12 bg-black/25 p-3">
                {!target ? (
                  <p className="text-xs text-white/55">Target content not found (possibly deleted).</p>
                ) : (
                  <>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
                      Target status: {target.moderationStatus}
                    </p>
                    {target.moderationReason && <p className="mt-1 text-xs text-white/55">Reason: {target.moderationReason}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-white/85">{target.body || "(no text)"}</p>
                    {target.mediaUrl && (
                      <a href={target.mediaUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex text-xs text-gold hover:text-gold/80">
                        Open media URL
                      </a>
                    )}
                  </>
                )}
              </div>

              {target && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {moderationActions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() => onModerate(report, action.value)}
                      className="min-h-10 rounded-full border border-gold/45 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {!visibleReports.length && (
          <div className="rounded-3xl border border-white/15 bg-black/35 p-5 text-sm text-white/65">
            No moderation reports in this filter.
          </div>
        )}
      </div>

      {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}
    </section>
  );
}
