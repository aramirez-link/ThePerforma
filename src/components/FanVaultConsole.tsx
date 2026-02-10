import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getAllFavorites,
  getCurrentUser,
  getVaultBadges,
  isCloudVaultEnabled,
  loginWithOAuth,
  loginUser,
  logoutUser,
  registerUser,
  syncCloudBadgesFromLocal,
  updateCurrentUserProfile,
  type FavoriteRecord,
  type VaultBadge,
  type VaultUser
} from "../lib/fanVault";
import { defaultProfileBadgeId, profileBadges } from "../lib/profileBadges";

type Mode = "register" | "login";

type EngagementSnapshot = {
  points: number;
  streak: number;
  weeklySignal: number;
};

type DispatchLog = {
  id: string;
  createdAt: string;
  status: "live" | "offline" | "test";
  title: string;
  streamUrl: string;
  platform: "youtube" | "instagram" | "facebook" | "twitch" | "multi";
  emailSent: number;
  smsSent: number;
  opens?: number;
  clicks?: number;
};

const providerMeta: Record<"google" | "apple" | "facebook" | "github", { label: string; icon: string }> = {
  google: { label: "Google", icon: "G" },
  apple: { label: "Apple", icon: "A" },
  facebook: { label: "Facebook", icon: "f" },
  github: { label: "GitHub", icon: "GH" }
};

const ENGAGEMENT_KEY = "the-performa-engagement-v1";
const LIVE_DISPATCH_LOG_KEY = "the-performa-live-dispatch-logs-v1";

export default function FanVaultConsole() {
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [badgeDraft, setBadgeDraft] = useState(defaultProfileBadgeId);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [oauthWorking, setOauthWorking] = useState<"" | "google" | "github" | "facebook" | "apple">("");
  const [editOpen, setEditOpen] = useState(false);
  const [user, setUser] = useState<VaultUser | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [badges, setBadges] = useState<VaultBadge[]>([]);
  const [quickBadgeId, setQuickBadgeId] = useState(defaultProfileBadgeId);
  const [engagement, setEngagement] = useState<EngagementSnapshot>({ points: 0, streak: 0, weeklySignal: 0 });
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([]);
  const [opsNotice, setOpsNotice] = useState("");
  const operatorAllowlist = useMemo(
    () =>
      String(import.meta.env.PUBLIC_OPERATOR_EMAILS || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const sync = async () => {
    const nextUser = await getCurrentUser();
    setUser(nextUser);
    if (!nextUser) {
      setFavorites([]);
      setBadges([]);
      setBioDraft("");
      setBadgeDraft(defaultProfileBadgeId);
      return;
    }
    if (isCloudVaultEnabled) {
      await syncCloudBadgesFromLocal(nextUser.id);
    }
    const [nextFavorites, nextBadges] = await Promise.all([getAllFavorites(), getVaultBadges()]);
    setFavorites(nextFavorites);
    setBadges(nextBadges);
    setBioDraft(nextUser.bio || "");
    setBadgeDraft(nextUser.profileBadgeId || defaultProfileBadgeId);
    setQuickBadgeId(nextUser.profileBadgeId || defaultProfileBadgeId);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await sync();
      setLoading(false);
    };
    run();

    const onChanged = () => {
      void sync();
    };

    const onBadges = () => {
      if (isCloudVaultEnabled) {
        void syncCloudBadgesFromLocal().then(() => sync());
        return;
      }
      void sync();
    };

    window.addEventListener("fanvault:changed", onChanged);
    window.addEventListener("performa:badges-updated", onBadges);
    return () => {
      window.removeEventListener("fanvault:changed", onChanged);
      window.removeEventListener("performa:badges-updated", onBadges);
    };
  }, []);

  const isOperator = Boolean(user?.email && operatorAllowlist.includes(user.email.toLowerCase()));

  useEffect(() => {
    const syncExternal = async () => {
      try {
        const engagementRaw = JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || "{}");
        setEngagement({
          points: Number(engagementRaw.points || 0),
          streak: Number(engagementRaw.streak || 0),
          weeklySignal: Number(engagementRaw.weeklySignal || 0)
        });
      } catch {
        setEngagement({ points: 0, streak: 0, weeklySignal: 0 });
      }

      try {
        const token = localStorage.getItem("the-performa-operator-token-v1") || "";
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
        const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
        if (token && projectRef && isOperator) {
          const response = await fetch(`https://${projectRef}.functions.supabase.co/go-live-blast`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const payload = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(payload.rows)) {
            setDispatchLogs(
              payload.rows.map((row: any) => ({
                id: String(row.id),
                createdAt: row.created_at,
                status: row.status,
                title: row.title,
                streamUrl: row.stream_url,
                platform: row.platform,
                emailSent: Number(row.email_count || 0),
                smsSent: Number(row.sms_count || 0),
                opens: Number(row.opens || 0),
                clicks: Number(row.clicks || 0)
              }))
            );
            setOpsNotice("");
            return;
          }
          setOpsNotice(payload?.error ? String(payload.error) : "Unable to load cloud dispatch metrics.");
        }
      } catch {
        setOpsNotice("Unable to load cloud dispatch metrics.");
      }

      try {
        const logs = JSON.parse(localStorage.getItem(LIVE_DISPATCH_LOG_KEY) || "[]");
        if (Array.isArray(logs)) setDispatchLogs(logs.slice(0, 20));
        else setDispatchLogs([]);
      } catch {
        setDispatchLogs([]);
      }
    };

    void syncExternal();
    window.addEventListener("performa:dispatch-log", syncExternal);
    window.addEventListener("storage", syncExternal);
    window.addEventListener("astro:after-swap", syncExternal);
    return () => {
      window.removeEventListener("performa:dispatch-log", syncExternal);
      window.removeEventListener("storage", syncExternal);
      window.removeEventListener("astro:after-swap", syncExternal);
    };
  }, [isOperator]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const grouped = useMemo(
    () => ({
      gallery: favorites.filter((item) => item.type === "gallery"),
      watch: favorites.filter((item) => item.type === "watch"),
      listen: favorites.filter((item) => item.type === "listen")
    }),
    [favorites]
  );
  const selectedBadge = useMemo(
    () => profileBadges.find((item) => item.id === (user?.profileBadgeId || defaultProfileBadgeId)) || profileBadges[0],
    [user]
  );

  const onboarding = useMemo(() => {
    const profileReady = Boolean((user?.bio || "").trim().length >= 20);
    const favoritesReady = favorites.length > 0;
    const badgeReady = Boolean(user?.profileBadgeId && user.profileBadgeId !== defaultProfileBadgeId);
    const completed = [profileReady, favoritesReady, badgeReady].filter(Boolean).length;
    return {
      completed,
      total: 3,
      steps: [
        { label: "Add a profile bio (20+ chars)", done: profileReady },
        { label: "Save at least one favorite", done: favoritesReady },
        { label: "Pick a custom profile badge", done: badgeReady }
      ]
    };
  }, [favorites.length, user?.bio, user?.profileBadgeId]);

  const leaderboard = useMemo(() => {
    const seeded = [
      { name: "Signal Runner", score: 1140 },
      { name: "Night Architect", score: 980 },
      { name: "Vault Operator", score: 865 }
    ];
    const youScore = engagement.points + engagement.weeklySignal + engagement.streak * 14;
    return [...seeded, { name: user?.name || "You", score: youScore }].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [engagement.points, engagement.streak, engagement.weeklySignal, user?.name]);

  const blastTotals = useMemo(() => {
    const email = dispatchLogs.reduce((sum, item) => sum + Number(item.emailSent || 0), 0);
    const sms = dispatchLogs.reduce((sum, item) => sum + Number(item.smsSent || 0), 0);
    const opens = dispatchLogs.reduce((sum, item) => sum + Number(item.opens || 0), 0);
    const clicks = dispatchLogs.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
    return { email, sms, opens, clicks, count: dispatchLogs.length };
  }, [dispatchLogs]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    const result = mode === "register" ? await registerUser(name, email, password) : await loginUser(email, password);
    setWorking(false);

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    if ("requiresConfirm" in result && result.requiresConfirm) {
      setNotice("Account created. Check your email to confirm, then log in.");
      setMode("login");
    } else {
      setNotice(mode === "register" ? "Fan Vault created." : "Welcome back.");
    }

    setName("");
    setEmail("");
    setPassword("");
    await sync();
  };

  const startOAuth = async (provider: "google" | "github" | "facebook" | "apple") => {
    setOauthWorking(provider);
    const result = await loginWithOAuth(provider);
    if (!result.ok) {
      setNotice(result.error);
      setOauthWorking("");
      return;
    }
    setNotice(`Redirecting to ${provider}...`);
  };

  const saveProfile = async () => {
    setWorking(true);
    const next = await updateCurrentUserProfile({ bio: bioDraft, profileBadgeId: badgeDraft });
    setWorking(false);
    if (!next) {
      setNotice("Please log in first.");
      return;
    }
    setNotice("Profile updated.");
    setEditOpen(false);
    await sync();
  };

  const quickSaveBadge = async () => {
    setQuickSaving(true);
    const next = await updateCurrentUserProfile({ profileBadgeId: quickBadgeId });
    setQuickSaving(false);
    if (!next) {
      setNotice("Unable to update badge.");
      return;
    }
    setNotice("Badge updated.");
    await sync();
  };

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-white/15 bg-black/55 p-6 backdrop-blur-md">
        <p className="text-sm text-white/70">Loading Fan Vault...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-[2rem] border border-white/15 bg-black/55 p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-gold/85">Fan Vault</p>
            <h3 className="mt-2 font-display text-2xl">Register or Log In</h3>
            <p className="mt-2 text-sm text-white/70">
              {isCloudVaultEnabled
                ? "Create a cloud profile to sync favorites and badges across devices."
                : "Create a local profile on this device. Add Supabase keys to enable cloud sync."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] ${mode === "register" ? "border-gold/60 text-gold" : "border-white/20 text-white/70"}`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] ${mode === "login" ? "border-gold/60 text-gold" : "border-white/20 text-white/70"}`}
            >
              Log In
            </button>
          </div>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3"
              placeholder="Display Name"
              required
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3"
            placeholder="Email"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3"
            placeholder="Password"
            type="password"
            required
          />
          <button type="submit" disabled={working} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.3em] text-ink disabled:opacity-60">
            {working ? "Working..." : mode === "register" ? "Create Fan Vault" : "Enter Vault"}
          </button>
        </form>
        {isCloudVaultEnabled && (
          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Or continue with</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(["google", "apple", "facebook", "github"] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => startOAuth(provider)}
                  disabled={Boolean(oauthWorking)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/80 hover:border-gold/50 hover:text-gold disabled:opacity-60"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[9px] leading-none">
                    {providerMeta[provider].icon}
                  </span>
                  <span>{oauthWorking === provider ? "Working..." : providerMeta[provider].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {notice && <p className="mt-3 text-xs text-gold">{notice}</p>}
        <p className="mt-3 text-xs text-white/45">
          Mode: {isCloudVaultEnabled ? "Cloud Sync (Supabase)" : "Local Device Only"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/15 bg-black/55 p-6 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-11 w-11 rounded-xl border border-gold/40 bg-black/40 p-2 text-gold">
            <span dangerouslySetInnerHTML={{ __html: selectedBadge.svg }} />
          </div>
          <div>
          <p className="text-xs uppercase tracking-[0.34em] text-gold/85">Fan Vault Profile</p>
          <h3 className="mt-2 font-display text-3xl">{user.name}</h3>
          <p className="mt-2 text-sm text-white/70">{user.email}</p>
          <p className="mt-1 text-xs text-white/45">Mode: {isCloudVaultEnabled ? "Cloud Sync" : "Local Device"}</p>
          <p className="mt-1 text-xs text-gold/80">
            Badge: {selectedBadge.label}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={quickBadgeId}
              onChange={(e) => setQuickBadgeId(e.target.value)}
              className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/80"
              style={{ color: "#f5f5f7", backgroundColor: "#111318" }}
            >
              {profileBadges.map((badge) => (
                <option key={badge.id} value={badge.id} style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                  {badge.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={quickSaveBadge}
              disabled={quickSaving}
              className="rounded-full border border-gold/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold disabled:opacity-60"
            >
              {quickSaving ? "Saving" : "Apply"}
            </button>
          </div>
        </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen((value) => !value)}
            className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-[0.25em] text-gold"
          >
            {editOpen ? "Close Edit" : "Edit Profile"}
          </button>
        <button
          type="button"
          onClick={async () => {
            await logoutUser();
            setNotice("Signed out.");
            await sync();
          }}
          className="rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.25em] text-white/75"
        >
          Sign Out
        </button>
        </div>
      </div>

      {editOpen && (
        <div className="mt-6 rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Edit Profile Configuration</p>
          <textarea
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3"
            placeholder="Add a short fan bio..."
          />
          <p className="mt-4 text-xs uppercase tracking-[0.28em] text-white/55">Profile Badge</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profileBadges.map((badge) => {
              const selected = badgeDraft === badge.id;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setBadgeDraft(badge.id)}
                  className={`rounded-2xl border p-3 text-left transition ${selected ? "border-gold/60 bg-gold/10" : "border-white/15 bg-black/40 hover:border-gold/35"}`}
                >
                  <div className="mb-2 h-10 w-10 text-gold" dangerouslySetInnerHTML={{ __html: badge.svg }} />
                  <p className="text-xs uppercase tracking-[0.22em] text-white/80">{badge.label}</p>
                  <p className="mt-1 text-[11px] text-white/55">{badge.description}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-gold/85">{badge.tier}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={working}
              onClick={saveProfile}
              className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-[0.25em] text-gold disabled:opacity-60"
            >
              {working ? "Saving..." : "Save Profile"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBioDraft(user.bio || "");
                setBadgeDraft(user.profileBadgeId || defaultProfileBadgeId);
                setEditOpen(false);
              }}
              className="rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.25em] text-white/75"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Collected Badges</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.length ? (
              badges.map((badge) => (
                <span key={badge.id} className="rounded-full border border-gold/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                  {badge.label}
                </span>
              ))
            ) : (
              <p className="text-sm text-white/55">No badges yet.</p>
            )}
          </div>
        </article>
        <article className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Saved Favorites</p>
          <p className="mt-3 text-sm text-white/70">
            Gallery {grouped.gallery.length} | Watch {grouped.watch.length} | Listen {grouped.listen.length}
          </p>
        </article>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Onboarding Missions</p>
          <p className="mt-2 text-sm text-white/70">{onboarding.completed}/{onboarding.total} complete</p>
          <ul className="mt-3 space-y-2 text-xs text-white/75">
            {onboarding.steps.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-2">
                <span>{step.label}</span>
                <span className={step.done ? "text-gold" : "text-white/45"}>{step.done ? "Done" : "Pending"}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Weekly Leaderboard</p>
          <ul className="mt-3 space-y-2 text-xs text-white/75">
            {leaderboard.map((entry, index) => (
              <li key={`${entry.name}-${index}`} className="flex items-center justify-between gap-2">
                <span>#{index + 1} {entry.name}</span>
                <span className={entry.name === (user?.name || "You") ? "text-gold" : "text-white/60"}>{entry.score}</span>
              </li>
            ))}
          </ul>
        </article>

        {isOperator && (
          <article className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Performance Health</p>
          <p className="mt-2 text-xs text-white/70">Dispatches: {blastTotals.count}</p>
          <p className="mt-1 text-xs text-white/70">Emails sent: {blastTotals.email}</p>
          <p className="mt-1 text-xs text-white/70">SMS sent: {blastTotals.sms}</p>
          <p className="mt-1 text-xs text-white/70">Opens tracked: {blastTotals.opens}</p>
          <p className="mt-1 text-xs text-white/70">Clicks tracked: {blastTotals.clicks}</p>
          {opsNotice && <p className="mt-2 text-[11px] text-gold">{opsNotice}</p>}
        </article>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(["gallery", "watch", "listen"] as const).map((type) => (
          <article key={type} className="rounded-2xl border border-white/15 bg-black/45 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-white/55">{type} Favorites</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              {grouped[type].slice(0, 5).map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <a href={item.href} className="hover:text-gold">
                    {item.title}
                  </a>
                </li>
              ))}
              {!grouped[type].length && <li className="text-white/45">None saved yet.</li>}
            </ul>
          </article>
        ))}
      </div>
      {notice && <p className="mt-4 text-xs text-gold">{notice}</p>}
    </div>
  );
}
