import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createFeedPost,
  getLiveSessionFeed,
  setFeedPostPinned,
  subscribeToLiveSessionFeed,
  toggleLiveSessionReaction,
  voteFeedPoll,
  type FanFeedPost,
  type LiveSessionReactionSummary,
  type LiveSessionReactionType,
  type VaultUser
} from "../lib/fanVault";
import type { PublicLiveStatus } from "../lib/performaLive";
import DonatePill from "./DonatePill";
import PerformaLivePlayer from "./PerformaLivePlayer";
import UserAvatar from "./UserAvatar";

type Props = {
  session: PublicLiveStatus | null;
  user: VaultUser | null;
  canModerate: boolean;
  fallbackEmbedUrl?: string;
  reminders?: {
    isLoggedIn: boolean;
    saving: boolean;
    emailActive: boolean;
    smsActive: boolean;
    hasSmsPhone: boolean;
    settingsHref?: string;
    onAddToCalendar?: () => void;
    onToggleEmail?: () => void;
    onToggleSms?: () => void;
    onOpenSettings?: () => void;
  };
};

type RailFilter = "all" | "chat" | "prompts" | "polls";
type ComposerMode = "live_chat" | "poll";

const reactionDefs: Array<{ type: LiveSessionReactionType; label: string }> = [
  { type: "fire", label: "Fire" },
  { type: "bolt", label: "Bolt" },
  { type: "hands", label: "Hands" },
  { type: "heart", label: "Heart" }
];

const filterDefs: Array<{ id: RailFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "chat", label: "Chat" },
  { id: "prompts", label: "Prompts" },
  { id: "polls", label: "Polls" }
];

const pollOptionsSeed = ["", "", "", ""];
const feedScrollStepPx = 320;

const createEmptyReactionSummary = (sessionId = ""): LiveSessionReactionSummary => ({
  sessionId,
  totalCount: 0,
  counts: { fire: 0, bolt: 0, hands: 0, heart: 0 },
  viewerReactions: []
});

const formatTimestamp = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatScheduleDate = (value?: string | null) => {
  if (!value) return "Date pending";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatScheduleTime = (value?: string | null) => {
  if (!value) return "Time pending";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const kindLabel = (post: FanFeedPost) => {
  if (post.poll) return "Crowd Poll";
  if (post.postKind === "host_prompt") return "Host Prompt";
  if (post.postKind === "announcement") return "Announcement";
  if (post.postKind === "live_chat") return "Live Chat";
  return "Link Up";
};

const filterForComposerMode = (mode: ComposerMode): RailFilter => {
  if (mode === "live_chat") return "chat";
  if (mode === "poll") return "polls";
  return "chat";
};

const isCompactChatBubble = (post: FanFeedPost) => post.postKind === "live_chat" && !post.poll && !post.mediaUrl;

export default function LiveCompanion({ session, user, canModerate, fallbackEmbedUrl, reminders }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<RailFilter>("all");
  const [posts, setPosts] = useState<FanFeedPost[]>([]);
  const [reactions, setReactions] = useState<LiveSessionReactionSummary>(createEmptyReactionSummary(session?.sessionId || ""));
  const [composerMode, setComposerMode] = useState<ComposerMode>("live_chat");
  const [body, setBody] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(pollOptionsSeed);
  const [pinOnPublish, setPinOnPublish] = useState(false);
  const [selectedPollOptions, setSelectedPollOptions] = useState<Record<string, string[]>>({});
  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollFeedToTop = (behavior: ScrollBehavior = "smooth") => {
    feedScrollRef.current?.scrollTo({ top: 0, behavior });
  };

  const scrollFeedBy = (delta: number) => {
    feedScrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  useEffect(() => {
    if (!canModerate && composerMode !== "live_chat") {
      setComposerMode("live_chat");
      setPinOnPublish(false);
    }
  }, [canModerate, composerMode]);

  useEffect(() => {
    setReactions(createEmptyReactionSummary(session?.sessionId || ""));
    setPosts([]);
    setError("");
    setFilter("all");
    setSelectedPollOptions({});
    scrollFeedToTop("auto");
  }, [session?.sessionId]);

  useEffect(() => {
    scrollFeedToTop("auto");
  }, [filter]);

  useEffect(() => {
    if (!user || !session?.sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      const result = await getLiveSessionFeed(session.sessionId, 48);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setPosts(result.posts);
      setReactions(result.reactions);
      setError("");
      setLoading(false);
    };

    void load();
    const unsubscribe = subscribeToLiveSessionFeed(session.sessionId, () => void load(true));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [session?.sessionId, user?.id]);

  const pinnedPost = useMemo(
    () => posts.find((post) => post.isPinned) || posts.find((post) => post.postKind === "host_prompt") || null,
    [posts]
  );

  const viewerReactions = useMemo(() => new Set(reactions.viewerReactions), [reactions.viewerReactions]);

  const filteredPosts = useMemo(() => {
    const withoutPinned = posts.filter((post) => !post.isPinned || post.id !== pinnedPost?.id);
    return withoutPinned.filter((post) => {
      if (filter === "chat") return post.postKind === "live_chat";
      if (filter === "prompts") return post.postKind === "host_prompt" || post.postKind === "announcement";
      if (filter === "polls") return Boolean(post.poll);
      return true;
    });
  }, [filter, pinnedPost?.id, posts]);

  const showStandbyOverlay = !session?.isLive;
  const sessionDateLabel = formatScheduleDate(session?.scheduledFor);
  const sessionTimeLabel = formatScheduleTime(session?.scheduledFor);

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.sessionId) return;

    setSubmitting(true);
    setError("");

    const result = await createFeedPost({
      body,
      liveSessionId: session.sessionId,
      postKind: composerMode,
      isPinned: canModerate ? pinOnPublish : false,
      poll:
        composerMode === "poll"
          ? {
              question: pollQuestion,
              allowMultiple: false,
              options: pollOptions.filter((value) => value.trim()).map((label) => ({ label }))
            }
          : undefined
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBody("");
    setPollQuestion("");
    setPollOptions([...pollOptionsSeed]);
    setPinOnPublish(false);
    setFilter(filterForComposerMode(composerMode));
    scrollFeedToTop();
  };

  const handleReaction = async (reactionType: LiveSessionReactionType) => {
    if (!session?.sessionId || !user) return;
    setActionBusy(`reaction:${reactionType}`);
    const result = await toggleLiveSessionReaction(session.sessionId, reactionType);
    setActionBusy("");
    if (!result.ok) setError(result.error);
  };

  const handlePinToggle = async (postId: string, nextPinned: boolean) => {
    setActionBusy(`pin:${postId}`);
    const result = await setFeedPostPinned(postId, nextPinned);
    setActionBusy("");
    if (!result.ok) setError(result.error);
  };

  const handlePollChoice = async (post: FanFeedPost, optionId: string) => {
    if (!user || !post.poll) return;
    if (post.poll.allowMultiple) {
      setSelectedPollOptions((current) => {
        const next = new Set(current[post.id] || []);
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
        return { ...current, [post.id]: Array.from(next) };
      });
      return;
    }

    setActionBusy(`poll:${post.id}`);
    const result = await voteFeedPoll({ postId: post.id, optionIds: [optionId] });
    setActionBusy("");
    if (!result.ok) setError(result.error);
  };

  const submitMultiPoll = async (post: FanFeedPost) => {
    const optionIds = selectedPollOptions[post.id] || [];
    if (!optionIds.length) {
      setError("Pick at least one poll option.");
      return;
    }
    setActionBusy(`poll:${post.id}`);
    const result = await voteFeedPoll({ postId: post.id, optionIds });
    setActionBusy("");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedPollOptions((current) => ({ ...current, [post.id]: [] }));
  };

  const publishPanel = (
    <aside className="flex flex-col rounded-[1.8rem] border border-white/15 bg-[linear-gradient(180deg,rgba(11,10,15,0.96),rgba(7,6,11,0.92))] p-4 shadow-[0_0_60px_rgba(242,84,45,0.12)] md:p-5 xl:min-h-[52rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/85">Session Controls</p>
          <h4 className="mt-2 font-display text-2xl">Publish In Session</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session?.isLive && (
            <span className="rounded-full border border-emerald-400/55 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
              Live Now
            </span>
          )}
          <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
            {session?.sessionId ? session.sessionId.slice(0, 8) : "No Session"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-white/68">
        Publish chats and polls from the left side. The session chat stays isolated in its own scrollable window on the right.
      </p>

      {error && <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {!session?.sessionId && (
        <div className="mt-5 rounded-2xl border border-white/12 bg-black/25 p-4 text-sm text-white/70">
          No active live session is published yet. Start or switch a live session from the operator console to activate publishing.
        </div>
      )}

      {session?.sessionId && !user && (
        <div className="mt-5 rounded-2xl border border-white/12 bg-black/25 p-4">
          <p className="text-sm text-white/78">Log in to Fan Vault to publish into the session and interact with the live room.</p>
          <a
            href="/fan-club"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-gold px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-ink"
          >
            Open Fan Vault
          </a>
        </div>
      )}

      {session?.sessionId && user && (
        <form onSubmit={submitPost} className="mt-4 flex flex-1 flex-col rounded-2xl border border-white/12 bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Composer</p>
              <p className="mt-1 text-[11px] text-white/45">
                {canModerate ? "Chats and polls publish into the right-side feed." : "Messages publish into the right-side chat feed."}
              </p>
            </div>
            {canModerate && (
              <div className="flex flex-wrap gap-2">
                {(["live_chat", "poll"] as ComposerMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setComposerMode(mode)}
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      composerMode === mode ? "border-gold/60 text-gold" : "border-white/15 text-white/60"
                    }`}
                  >
                    {mode === "live_chat" ? "Chat" : "Poll"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              {reactionDefs.map((reaction) => {
                const active = viewerReactions.has(reaction.type);
                return (
                  <button
                    key={reaction.type}
                    type="button"
                    onClick={() => void handleReaction(reaction.type)}
                    disabled={actionBusy === `reaction:${reaction.type}`}
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-gold/60 bg-gold/10 text-gold"
                        : "border-white/12 bg-black/30 text-white/78 hover:border-gold/40 hover:text-gold"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em]">{reaction.label}</span>
                      <span className="text-sm">{reactions.counts[reaction.type]}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50">
              {composerMode === "live_chat" ? "Message" : "Optional intro"}
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={composerMode === "live_chat" ? 4 : 5}
                placeholder={
                  composerMode === "live_chat"
                    ? "Jump into the room..."
                    : "Optional context for the poll..."
                }
                className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/88 placeholder:text-white/30"
              />
            </label>

            {composerMode === "poll" && (
              <div className="space-y-3">
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50">
                  Poll Question
                  <input
                    value={pollQuestion}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    placeholder="What should happen next?"
                    className="mt-2 min-h-11 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/88 placeholder:text-white/30"
                  />
                </label>
                <div className="grid gap-2">
                  {pollOptions.map((option, index) => (
                    <label key={index} className="block text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Option {index + 1}
                      <input
                        value={option}
                        onChange={(event) =>
                          setPollOptions((current) => current.map((value, valueIndex) => (valueIndex === index ? event.target.value : value)))
                        }
                        placeholder={`Choice ${index + 1}`}
                        className="mt-2 min-h-11 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/88 placeholder:text-white/30"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {canModerate && composerMode !== "live_chat" && (
              <label className="flex items-center gap-2 text-xs text-white/78">
                <input
                  type="checkbox"
                  checked={pinOnPublish}
                  onChange={(event) => setPinOnPublish(event.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                Pin this post at the top of the session chat
              </label>
            )}
          </div>

          <div className="mt-auto pt-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.name} seed={user.id} imageUrl={user.avatarUrl} size="sm" />
              <p className="text-[11px] text-white/45">Signed in as {user.name}. New posts appear at the top of the chat window.</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-ink disabled:opacity-60"
            >
              {submitting ? "Sending..." : composerMode === "poll" ? "Publish Poll" : "Send To Session"}
            </button>
          </div>
        </form>
      )}
    </aside>
  );

  const playerPanel = (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[1.8rem] border border-white/15 bg-black/45">
        {showStandbyOverlay ? (
          <div className="relative aspect-video w-full overflow-hidden">
            <img src="/assets/img/134NewChip_4K.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(242,84,45,0.18),transparent_42%),linear-gradient(145deg,rgba(8,8,12,0.94),rgba(6,8,14,0.98))]" />
            <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-gold/15 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
            <div className="absolute -right-10 bottom-4 h-44 w-44 rounded-full bg-ember/20 blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute right-3 top-3 z-10">
              <div className="pointer-events-auto">
                <DonatePill source="live-companion-standby" />
              </div>
            </div>
            <div className="relative flex h-full flex-col justify-between p-5 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/65">
                  {session?.scheduledFor ? "Next Session" : "Standby Mode"}
                </span>
                {reminders?.settingsHref && (
                  <a
                    href={reminders.settingsHref}
                    onClick={() => reminders.onOpenSettings?.()}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 hover:border-gold/45 hover:text-gold"
                  >
                    Reminder Settings
                  </a>
                )}
              </div>

              <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="absolute inset-[-18px] rounded-full border border-gold/25 animate-[spin_22s_linear_infinite]" />
                  <div className="absolute inset-[-34px] rounded-full border border-white/10 animate-[spin_30s_linear_infinite_reverse]" />
                  <div className="relative rounded-full border border-white/15 bg-white/5 p-5 shadow-[0_0_60px_rgba(243,211,139,0.16)] backdrop-blur">
                    <img src="/assets/img/CHIPLEE_LOGO_Clear.png" alt="The Performa logo" className="h-20 w-20 object-contain animate-[pulse_6s_ease-in-out_infinite] md:h-24 md:w-24" />
                  </div>
                </div>

                <p className="mt-8 text-[10px] uppercase tracking-[0.34em] text-gold/85">
                  {session?.scheduledFor ? "Scheduled Broadcast" : "Next Session Programming"}
                </p>
                <h4 className="mt-3 font-display text-3xl leading-tight text-white md:text-5xl">
                  {session?.title || "The next Performa live session is being programmed"}
                </h4>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <span className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/78">
                    {sessionDateLabel}
                  </span>
                  <span className="rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-gold">
                    {sessionTimeLabel}
                  </span>
                </div>
                <p className="mt-5 max-w-xl text-sm text-white/72 md:text-base">
                  {session?.scheduledFor
                    ? "No stream is live right now. The player will switch automatically when the next session starts. Set a reminder now so you do not miss the drop."
                    : "No stream is live right now. As soon as the next session is scheduled, this standby deck will show the start window and reminder actions."}
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {session?.scheduledFor && reminders?.onAddToCalendar && (
                    <button
                      type="button"
                      onClick={reminders.onAddToCalendar}
                      className="inline-flex min-h-11 items-center rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-gold"
                    >
                      Add To Calendar
                    </button>
                  )}
                  {reminders?.isLoggedIn ? (
                    <>
                      <button
                        type="button"
                        onClick={reminders.onToggleEmail}
                        disabled={reminders.saving}
                        className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.24em] ${
                          reminders.emailActive ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-300" : "border-white/20 text-white/75"
                        }`}
                      >
                        {reminders.emailActive ? "Email Reminder On" : "Email Reminder"}
                      </button>
                      {reminders.hasSmsPhone ? (
                        <button
                          type="button"
                          onClick={reminders.onToggleSms}
                          disabled={reminders.saving}
                          className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.24em] ${
                            reminders.smsActive ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-300" : "border-white/20 text-white/75"
                          }`}
                        >
                          {reminders.smsActive ? "Text Reminder On" : "Text Reminder"}
                        </button>
                      ) : reminders.settingsHref ? (
                        <a
                          href={reminders.settingsHref}
                          onClick={() => reminders.onOpenSettings?.()}
                          className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/75"
                        >
                          Add SMS Number
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <a
                      href="/fan-club"
                      className="inline-flex min-h-11 items-center rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-ink"
                    >
                      Open Fan Vault
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
                <span>{session?.sessionId ? `Session ${session.sessionId.slice(0, 8)}` : "Next session slot pending"}</span>
                {reminders?.saving ? <span>Saving reminder settings...</span> : <span>Reminder controls stay synced with Fan Vault.</span>}
              </div>
            </div>
          </div>
        ) : session?.playbackId ? (
          <PerformaLivePlayer
            playbackId={session.playbackId}
            title={session.title || "Performa Live Stream"}
            isLive={Boolean(session.isLive)}
            ingestType={session.ingestType}
            latencyMode={session.latencyMode}
            health={session.health}
            ingestHeartbeatAt={session.ingestHeartbeatAt}
          />
        ) : fallbackEmbedUrl ? (
          <div className="relative aspect-video w-full">
            <div className="pointer-events-none absolute right-3 top-3 z-10">
              <div className="pointer-events-auto">
                <DonatePill source="live-companion-fallback-video" />
              </div>
            </div>
            <iframe
              className="h-full w-full"
              src={fallbackEmbedUrl}
              title="Performa Live Fallback Stream"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <PerformaLivePlayer />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Session</p>
          <p className="mt-2 text-sm text-white/88">{session?.title || "Waiting for the next live session"}</p>
          <p className="mt-2 text-[11px] text-white/55">
            {session?.isLive
              ? "The Performa is live now."
              : session?.scheduledFor
              ? `Scheduled ${sessionDateLabel} at ${sessionTimeLabel}.`
              : "Standby mode. The player will switch when the next session starts."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Room Pulse</p>
          <p className="mt-2 text-2xl font-display">{reactions.totalCount}</p>
          <p className="mt-2 text-[11px] text-white/55">Total live reactions across this session.</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Live Rail</p>
          <p className="mt-2 text-sm text-white/88">{filteredPosts.length} items currently in view</p>
          <p className="mt-2 text-[11px] text-white/55">Publishing stays left, the chat window stays right.</p>
        </div>
      </div>
    </section>
  );

  const chatPanel = (
    <aside className="flex flex-col rounded-[1.8rem] border border-white/15 bg-[linear-gradient(180deg,rgba(9,11,18,0.96),rgba(6,7,12,0.92))] p-4 shadow-[0_0_60px_rgba(242,84,45,0.14)] md:p-5 xl:h-[52rem] xl:min-h-[52rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/85">Link Up Live</p>
          <h4 className="mt-2 font-display text-2xl">Session Chat</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session?.isLive && (
            <span className="rounded-full border border-emerald-400/55 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
              Live Now
            </span>
          )}
          <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
            {session?.sessionId ? session.sessionId.slice(0, 8) : "No Session"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-white/68">
        The chat window has its own scroll controls, so longer sessions do not force the full page to move.
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/45">{filteredPosts.length} items in view</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollFeedToTop()}
            className="rounded-full border border-white/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70 hover:border-gold/45 hover:text-gold"
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => scrollFeedBy(feedScrollStepPx)}
            className="rounded-full border border-white/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70 hover:border-gold/45 hover:text-gold"
          >
            Older
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filterDefs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
              filter === item.id ? "border-gold/60 text-gold" : "border-white/12 text-white/58"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div ref={feedScrollRef} className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/12 bg-black/25 px-3 py-3">
        <div className="space-y-3">
          {pinnedPost && (
            <div className="rounded-2xl border border-gold/35 bg-gold/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <UserAvatar name={pinnedPost.authorName} seed={pinnedPost.authorAvatarSeed} imageUrl={pinnedPost.authorAvatarUrl} size="sm" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-gold/90">Pinned On Air</p>
                    <p className="mt-2 text-sm font-semibold text-white">{kindLabel(pinnedPost)}</p>
                  </div>
                </div>
                {canModerate && (
                  <button
                    type="button"
                    onClick={() => void handlePinToggle(pinnedPost.id, false)}
                    disabled={actionBusy === `pin:${pinnedPost.id}`}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 hover:border-gold/45 hover:text-gold"
                  >
                    Unpin
                  </button>
                )}
              </div>
              <p className="mt-3 text-sm text-white/85">{pinnedPost.body || "Pinned live post"}</p>
              <p className="mt-3 text-[11px] text-white/45">
                {pinnedPost.authorName} | {formatTimestamp(pinnedPost.createdAt)}
              </p>
            </div>
          )}

          {!session?.sessionId && (
            <p className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/68">
              No active session chat yet. Start a live session to populate this feed.
            </p>
          )}
          {session?.sessionId && !user && (
            <p className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/68">
              Sign in to Fan Vault to unlock live chat and session activity.
            </p>
          )}
          {loading && <p className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/68">Loading session chat...</p>}
          {!loading && session?.sessionId && user && !filteredPosts.length && (
            <p className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/68">
              No posts match this filter yet. The next message, prompt, or poll will appear here at the top of the chat window.
            </p>
          )}
          {filteredPosts.map((post) => {
            const pendingSelection = selectedPollOptions[post.id] || [];
            const compactBubble = isCompactChatBubble(post);
            return (
              <article
                key={post.id}
                className={`rounded-2xl border ${
                  compactBubble ? "border-white/10 bg-black/35 px-3 py-3" : "border-white/12 bg-black/25 p-4"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={post.authorName} seed={post.authorAvatarSeed} imageUrl={post.authorAvatarUrl} size="sm" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{kindLabel(post)}</p>
                      <p className="mt-2 text-sm text-white/90">{post.authorName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/45">{formatTimestamp(post.createdAt)}</p>
                    {canModerate && (
                      <button
                        type="button"
                        onClick={() => void handlePinToggle(post.id, !post.isPinned)}
                        disabled={actionBusy === `pin:${post.id}`}
                        className="mt-2 rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65 hover:border-gold/45 hover:text-gold"
                      >
                        {post.isPinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                  </div>
                </div>

                {post.body && <p className="mt-3 text-sm leading-6 text-white/82">{post.body}</p>}

                {post.poll && (
                  <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/10 p-3">
                    <p className="text-sm font-semibold text-white">{post.poll.question}</p>
                    <div className="mt-3 space-y-2">
                      {post.poll.options.map((option) => {
                        const totalVotes = Math.max(1, post.poll?.totalVotes || 0);
                        const width = `${Math.round((option.voteCount / totalVotes) * 100)}%`;
                        const active = option.viewerVoted || pendingSelection.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => void handlePollChoice(post, option.id)}
                            disabled={post.poll?.viewerHasVoted && !post.poll.allowMultiple}
                            className={`w-full overflow-hidden rounded-2xl border text-left ${
                              active ? "border-gold/60 bg-gold/10 text-gold" : "border-white/12 bg-black/25 text-white/82"
                            }`}
                          >
                            <div className="relative px-3 py-3">
                              <div className="absolute inset-y-0 left-0 bg-gold/10" style={{ width }} />
                              <div className="relative flex items-center justify-between gap-3">
                                <span>{option.label}</span>
                                <span className="text-[11px] text-white/55">{option.voteCount}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {post.poll.allowMultiple && !post.poll.viewerHasVoted && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void submitMultiPoll(post)}
                          disabled={actionBusy === `poll:${post.id}`}
                          className="rounded-full border border-gold/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold"
                        >
                          Submit Vote
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.72fr)_minmax(360px,1.02fr)] xl:items-start">
      <div className="order-2 xl:order-none">{publishPanel}</div>
      <div className="order-1 xl:order-none">{playerPanel}</div>
      <div className="order-3 xl:order-none">{chatPanel}</div>
    </div>
  );
}
