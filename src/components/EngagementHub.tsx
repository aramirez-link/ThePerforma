import { useEffect, useMemo, useRef, useState } from "react";
import {
  ensureEngagementProfile,
  getCurrentUser,
  getEngagementLeaderboard,
  isCloudVaultEnabled,
  subscribeToEngagementLeaderboard,
  upsertEngagementProfile,
  type EngagementLeaderboardEntry,
  type EngagementState
} from "../lib/fanVault";

type MissionState = EngagementState["missions"];

const STORAGE_KEY = "the-performa-engagement-v1";
const BADGES_KEY = "the-performa-badges-v1";
const TODAY = () => new Date().toISOString().slice(0, 10);
const currentWeekKey = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const defaultState = (): EngagementState => ({
  points: 120,
  streak: 1,
  lastSeenDate: TODAY(),
  dailyClaimDate: "",
  weekKey: currentWeekKey(),
  weeklySignal: 0,
  visitedPaths: [],
  reactions: { fire: 0, bolt: 0, hands: 0 },
  missions: {
    stageMode: false,
    watchAndListen: false,
    innerCircle: false
  }
});

const toDate = (value: string) => new Date(`${value}T00:00:00`);

const daysBetween = (a: string, b: string) => {
  const diff = toDate(b).getTime() - toDate(a).getTime();
  return Math.round(diff / 86_400_000);
};

const loadState = (): EngagementState => {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<EngagementState>;
    return {
      ...defaultState(),
      ...parsed,
      reactions: { ...defaultState().reactions, ...(parsed.reactions ?? {}) },
      missions: { ...defaultState().missions, ...(parsed.missions ?? {}) }
    };
  } catch {
    return defaultState();
  }
};

const saveState = (state: EngagementState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const missionReward = 80;

const missionChecklist = [
  { key: "stageMode" as const, label: "Activate Stage Mode once", reward: missionReward },
  { key: "watchAndListen" as const, label: "Visit Watch + Listen", reward: missionReward },
  { key: "innerCircle" as const, label: "Open Inner Circle Access", reward: missionReward }
];

const fallbackCommunityBoard = [
  { name: "Signal Runner", base: 980 },
  { name: "Night Architect", base: 860 },
  { name: "Vault Operator", base: 740 }
];

type BadgeTier = "core" | "elite" | "legend";

const badgeDefinitions = [
  {
    id: "first-signal",
    label: "First Signal",
    tier: "core" as BadgeTier,
    tip: "Earned by crossing 160 points.",
    rule: (state: EngagementState, missionsCompleted: number) => state.points >= 160
  },
  {
    id: "return-runner",
    label: "Return Runner",
    tier: "elite" as BadgeTier,
    tip: "Earned by maintaining a 3-day streak.",
    rule: (state: EngagementState, missionsCompleted: number) => state.streak >= 3
  },
  {
    id: "mission-control",
    label: "Mission Control",
    tier: "legend" as BadgeTier,
    tip: "Earned by completing all missions.",
    rule: (state: EngagementState, missionsCompleted: number) => missionsCompleted >= 3
  },
  {
    id: "crowd-igniter",
    label: "Crowd Igniter",
    tier: "elite" as BadgeTier,
    tip: "Earned by maxing this week's challenge.",
    rule: (state: EngagementState, missionsCompleted: number) => state.weeklySignal >= 220
  }
];

export default function EngagementHub() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EngagementState>(() => loadState());
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState("ember");
  const [burstTick, setBurstTick] = useState({ fire: 0, bolt: 0, hands: 0 });
  const [leaderboard, setLeaderboard] = useState<EngagementLeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const persistTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef<EngagementState>(state);

  const missionsCompleted = useMemo(
    () => Object.values(state.missions).filter(Boolean).length,
    [state.missions]
  );

  const totalMissionCount = missionChecklist.length;
  const nextRewardAt = Math.ceil((state.points + 1) / 200) * 200;
  const challengeTarget = 220;
  const challengeProgress = Math.min(challengeTarget, state.weeklySignal);
  const challengePct = Math.round((challengeProgress / challengeTarget) * 100);
  const unlockedBadges = useMemo(() => badgeDefinitions.filter((badge) => badge.rule(state, missionsCompleted)), [state, missionsCompleted]);

  const tierClass = (tier: BadgeTier) => {
    if (tier === "legend") return "badge-tier-legend border-amber-300/60 text-amber-200 bg-amber-500/10";
    if (tier === "elite") return "badge-tier-elite border-cyan-300/55 text-cyan-200 bg-cyan-500/10";
    return "badge-tier-core border-gold/40 text-gold bg-black/40";
  };

  const board = useMemo(
    () => {
      if (!leaderboard.length) {
        return [
          ...fallbackCommunityBoard.map((entry) => ({
            name: entry.name,
            score: entry.base + ((state.points * 3 + state.streak * 11) % 140),
            isYou: false
          })),
          { name: "You", score: state.points + state.weeklySignal + state.streak * 17, isYou: true }
        ].sort((a, b) => b.score - a.score);
      }

      return leaderboard.map((entry) => ({
        name: entry.displayName || "Fan",
        score: entry.score,
        isYou: Boolean(currentUserId) && entry.userId === currentUserId
      }));
    },
    [leaderboard, state.points, state.streak, state.weeklySignal, currentUserId]
  );

  const loadLeaderboard = async () => {
    if (!isCloudVaultEnabled) return;
    const next = await getEngagementLeaderboard(8);
    setLeaderboard(next);
  };

  const persistCloudState = (next: EngagementState) => {
    latestStateRef.current = next;
    if (!isCloudVaultEnabled) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(async () => {
      await upsertEngagementProfile(latestStateRef.current);
      await loadLeaderboard();
    }, 320);
  };

  const updateState = (updater: (current: EngagementState) => EngagementState) => {
    setState((current) => {
      const next = updater(current);
      saveState(next);
      persistCloudState(next);
      return next;
    });
  };

  const completeMission = (key: keyof MissionState) => {
    updateState((current) => {
      if (current.missions[key]) return current;
      return {
        ...current,
        points: current.points + missionReward,
        missions: { ...current.missions, [key]: true }
      };
    });
  };

  const registerVisit = (path: string) => {
    updateState((current) => {
      const today = TODAY();
      const daysSince = daysBetween(current.lastSeenDate, today);
      const nextStreak =
        daysSince === 1 ? current.streak + 1 : daysSince > 1 ? 1 : current.streak;
      const visitedPaths = current.visitedPaths.includes(path)
        ? current.visitedPaths
        : [...current.visitedPaths, path];
      const visitedWatch = visitedPaths.some((p) => p.startsWith("/watch"));
      const visitedListen = visitedPaths.some((p) => p.startsWith("/listen"));
      const touchedInnerCircle = visitedPaths.some((p) => p.startsWith("/fan-club"));

      return {
        ...current,
        streak: nextStreak,
        lastSeenDate: today,
        visitedPaths,
        missions: {
          ...current.missions,
          watchAndListen: current.missions.watchAndListen || (visitedWatch && visitedListen),
          innerCircle: current.missions.innerCircle || touchedInnerCircle
        }
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (isCloudVaultEnabled) {
        const [user, cloudState] = await Promise.all([getCurrentUser(), ensureEngagementProfile()]);
        if (!cancelled) {
          setCurrentUserId(user?.id || "");
        }
        if (cloudState && !cancelled) {
          setState((current) => {
            const merged: EngagementState = {
              ...cloudState,
              points: Math.max(current.points, cloudState.points),
              streak: Math.max(current.streak, cloudState.streak),
              weeklySignal: Math.max(current.weeklySignal, cloudState.weeklySignal),
              visitedPaths: Array.from(new Set([...(cloudState.visitedPaths || []), ...(current.visitedPaths || [])])),
              reactions: {
                fire: Math.max(current.reactions.fire, cloudState.reactions.fire),
                bolt: Math.max(current.reactions.bolt, cloudState.reactions.bolt),
                hands: Math.max(current.reactions.hands, cloudState.reactions.hands)
              },
              missions: {
                stageMode: current.missions.stageMode || cloudState.missions.stageMode,
                watchAndListen: current.missions.watchAndListen || cloudState.missions.watchAndListen,
                innerCircle: current.missions.innerCircle || cloudState.missions.innerCircle
              }
            };
            saveState(merged);
            persistCloudState(merged);
            return merged;
          });
          await loadLeaderboard();
        }
      }

      if (!cancelled) {
        registerVisit(window.location.pathname);
      }
    };

    void bootstrap();

    const handleAfterSwap = () => registerVisit(window.location.pathname);
    document.addEventListener("astro:after-swap", handleAfterSwap);

    const handleStageMode = () => {
      if (document.body.dataset.stage === "true") completeMission("stageMode");
    };

    const stageSubscription = (
      window as Window & { __stageMode?: { subscribe?: (cb: () => void) => () => void } }
    ).__stageMode?.subscribe?.(handleStageMode);
    handleStageMode();

    const unsubscribeLeaderboard = subscribeToEngagementLeaderboard(() => {
      void loadLeaderboard();
    });

    return () => {
      cancelled = true;
      document.removeEventListener("astro:after-swap", handleAfterSwap);
      if (stageSubscription) stageSubscription();
      if (unsubscribeLeaderboard) unsubscribeLeaderboard();
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const thisWeek = currentWeekKey();
    if (state.weekKey === thisWeek) return;
    updateState((current) => ({
      ...current,
      weekKey: thisWeek,
      weeklySignal: 0
    }));
  }, [state.weekKey]);

  useEffect(() => {
    if (!state.missions.watchAndListen) return;
    completeMission("watchAndListen");
  }, [state.missions.watchAndListen]);

  useEffect(() => {
    if (!state.missions.innerCircle) return;
    completeMission("innerCircle");
  }, [state.missions.innerCircle]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const payload = JSON.stringify(unlockedBadges);
    localStorage.setItem(BADGES_KEY, payload);
    window.dispatchEvent(
      new CustomEvent("performa:badges-updated", {
        detail: unlockedBadges
      })
    );
  }, [unlockedBadges]);

  useEffect(() => {
    const syncTheme = () => setTheme(document.body.dataset.stageTheme || "ember");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-stage-theme"]
    });
    return () => observer.disconnect();
  }, []);

  const doReaction = (key: "fire" | "bolt" | "hands") => {
    updateState((current) => ({
      ...current,
      points: current.points + 5,
      weeklySignal: current.weeklySignal + 10,
      reactions: {
        ...current.reactions,
        [key]: current.reactions[key] + 1
      }
    }));
    setBurstTick((current) => ({ ...current, [key]: current[key] + 1 }));
    setToast("Reaction sent +5");
  };

  const claimDaily = () => {
    const today = TODAY();
    if (state.dailyClaimDate === today) {
      setToast("Daily already claimed");
      return;
    }
    updateState((current) => ({
      ...current,
      points: current.points + 40,
      weeklySignal: current.weeklySignal + 20,
      dailyClaimDate: today
    }));
    setToast("Daily check-in +40");
  };

  const shareNow = async () => {
    const payload = {
      title: "Chip Lee - The Performa",
      text: "Stage Mode is live. Tap in.",
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
      updateState((current) => ({
        ...current,
        points: current.points + 15,
        weeklySignal: current.weeklySignal + 15
      }));
      setToast("Share pulse +15");
    } catch {
      setToast("Share cancelled");
    }
  };

  return (
    <aside
      id="engagement-hub"
      className="hidden fixed left-4 bottom-4 z-40 w-[min(92vw,360px)] max-h-[calc(100dvh-8rem)] rounded-2xl border bg-black/75 p-3 shadow-[0_12px_42px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:block sm:max-h-[calc(100dvh-7rem)]"
      style={{
        borderColor: "rgba(var(--accent-rgb), 0.45)",
        boxShadow: "0 12px 42px rgba(0,0,0,0.58), 0 0 36px rgba(var(--accent-rgb), 0.2)"
      }}
      data-theme={theme}
      aria-label="Fan engagement hub"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/90">Crowd Pulse - Rate Me</p>
          <p className="mt-1 text-xs text-white/70">Points {state.points} | Streak {state.streak}d</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-white/80 hover:border-gold/60 hover:text-gold"
          aria-expanded={open}
        >
          {open ? "Hide" : "Open"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 overflow-y-auto pr-1 max-h-[calc(100dvh-13rem)] sm:max-h-[calc(100dvh-12rem)]">
          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Crowd Pulse</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => doReaction("fire")}
                className="reaction-btn rounded-full border border-white/20 px-3 py-1 text-sm hover:border-gold/60"
              >
                FIRE {120 + state.reactions.fire}
                {burstTick.fire > 0 && <span key={burstTick.fire} className="reaction-burst reaction-burst-fire" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => doReaction("bolt")}
                className="reaction-btn rounded-full border border-white/20 px-3 py-1 text-sm hover:border-gold/60"
              >
                HYPE {84 + state.reactions.bolt}
                {burstTick.bolt > 0 && <span key={burstTick.bolt} className="reaction-burst reaction-burst-hype" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => doReaction("hands")}
                className="reaction-btn rounded-full border border-white/20 px-3 py-1 text-sm hover:border-gold/60"
              >
                CHEER {57 + state.reactions.hands}
                {burstTick.hands > 0 && <span key={burstTick.hands} className="reaction-burst reaction-burst-cheer" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Daily Ops</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={claimDaily}
                className="rounded-full border border-gold/30 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold hover:bg-gold/10"
              >
                Daily Check-in
              </button>
              <button
                type="button"
                onClick={shareNow}
                className="rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/80 hover:border-white/50 hover:text-white"
              >
                Share Signal
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/55">Next milestone unlock at {nextRewardAt} points.</p>
          </div>

          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Return Missions</p>
            <ul className="mt-2 space-y-2 text-xs text-white/75">
              {missionChecklist.map((mission) => (
                <li key={mission.key} className="flex items-center justify-between gap-3">
                  <span>{mission.label}</span>
                  <span className={state.missions[mission.key] ? "text-gold" : "text-white/45"}>
                    {state.missions[mission.key] ? "Complete" : `+${mission.reward}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-white/55">
              {missionsCompleted}/{totalMissionCount} missions completed
            </p>
          </div>

          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Weekly Challenge</p>
            <p className="mt-2 text-xs text-white/75">Push the crowd meter to 100% this week.</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${challengePct}%`,
                  background: "linear-gradient(90deg, rgba(var(--accent-rgb),0.55), rgba(var(--accent-rgb),1))"
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/55">
              {challengeProgress}/{challengeTarget} signal points
            </p>
            <p className="mt-1 text-[11px] text-white/45">Weekly reset: Monday 12:00 AM local</p>
          </div>

          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Community Heat</p>
            <ul className="mt-2 space-y-2 text-xs text-white/75">
              {board.map((entry, index) => (
                <li key={entry.name} className="flex items-center justify-between gap-3">
                  <span>
                    #{index + 1} {entry.name}
                  </span>
                  <span className={entry.isYou ? "text-gold" : "text-white/60"}>
                    {entry.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/15 bg-black/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/55">Unlocked Badges</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unlockedBadges.length > 0 ? (
                unlockedBadges.map((badge) => (
                  <span
                    key={badge.id}
                    title={`${badge.label} (${badge.tier.toUpperCase()}): ${badge.tip}`}
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${tierClass(badge.tier)}`}
                  >
                    {badge.label} · {badge.tier}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white/50">No badges unlocked yet.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <p className="mt-3 text-xs text-gold">{toast}</p>}
    </aside>
  );
}
