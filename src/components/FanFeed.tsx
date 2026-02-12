import { useEffect, useMemo, useRef, useState } from "react";
import SignalCommandCenter from "./SignalCommandCenter";
import {
  createFeedComment,
  createFeedPost,
  deleteFeedPost,
  getCurrentUser,
  getFanFeed,
  incrementFeedShare,
  reportFeedContent,
  subscribeToFanFeed,
  toggleFeedLike,
  updateFeedPost,
  uploadFeedPhoto,
  voteFeedPoll,
  type FanFeedMediaType,
  type FanFeedPost,
  type VaultUser
} from "../lib/fanVault";

type BlueprintPayload = {
  title: string;
  city: string;
  date: string;
  venueType: string;
  intensity: number;
  tier: string;
  modules: string[];
  estimatedCostRange: string;
  roi: { low: number; expected: number; high: number };
  riskScore: number;
  shareLink: string;
};

type DisplayPost = FanFeedPost & {
  postType: "text" | "media" | "blueprint" | "poll" | "runbun" | "trivia";
  cleanBody: string;
  blueprint: BlueprintPayload | null;
  triviaMeta: TriviaPostMeta | null;
};

type PollOptionDraft = {
  label: string;
  imageUrl: string;
};

type ActivityType = "post" | "comment" | "like" | "share";

type ActivityEvent = {
  type: ActivityType;
  ts: number;
};

type RankDef = { label: string; minXp: number };

type ProfileState = {
  userId: string;
  xp: number;
  likeDay: string;
  likesToday: number;
  dropRewardDay: string;
};

type CitySignal = {
  city: string;
  score: number;
  status: string;
};

type ActiveFan = {
  id: string;
  name: string;
  online: boolean;
};

type TriviaPostMeta = {
  campaignId?: string;
  questionId?: string;
  label?: string;
  accentColor?: string;
  cardTone?: "ember" | "gold" | "cyan" | "neutral";
  createdAt?: string;
};

const PROFILE_KEY = "the-performa-feed-profile-v1";
const ACTIVITY_KEY = "the-performa-feed-activity-v1";
const CITY_KEY = "the-performa-feed-city-signals-v1";
const BLUEPRINT_DRAFT_KEY = "the-performa-blueprint-draft-v1";
const BLUEPRINT_PREFIX = "[[BLUEPRINT]]";
const RUN_BUN_PREFIX = "[[RUN_BUN]]";
const TRIVIA_PREFIX = "[[TRIVIA]]";
const SWIPE_VOTE_DELTA_PX = 60;
const RUN_BUN_MIN_MINUTES = 1;
const RUN_BUN_MAX_MINUTES = 15;
const BOOK_BLUEPRINT_POLL_OPTIONS: PollOptionDraft[] = [
  { label: "Run It", imageUrl: "" },
  { label: "Bun It", imageUrl: "" }
];

const ranks: RankDef[] = [
  { label: "Listener", minXp: 0 },
  { label: "Insider", minXp: 100 },
  { label: "Afterhours Regular", minXp: 250 },
  { label: "Vault Member", minXp: 500 },
  { label: "Mainstage Signal", minXp: 900 },
  { label: "Inner Circle", minXp: 1400 }
];

const prompts = [
  "Drop your best afterhours photo.",
  "Show your Performa fit.",
  "Post your city's nightlife signal.",
  "What track defines your week?",
  "Your cleanest transition moment-link it.",
  "Where should The Performa route next?",
  "A photo that feels like ignition.",
  "Best crowd moment from this week?",
  "Post a promoter blueprint for your city.",
  "Share a clip that matches tonight's pulse.",
  "What set opener should hit first?",
  "Tag your city's afterhours mood.",
  "Pick one track for a mainstage rise.",
  "What venue type are you building next?"
];

const activeFanSeeds = [
  "SignalRunner", "NightArchitect", "VaultPilot", "AfterhoursFox", "PulseWarden", "DeckVision", "CitySpark", "NeonTransit",
  "RouteCaller", "CrowdCurrent", "EchoDriver", "MainstageRay", "RitualWire", "ClubFrame", "SkylineDrop", "TempoScout",
  "HouseSignal", "LiveCompass", "KineticFlux", "AuralShift", "DriftArray", "StageSpark", "MotionDeck", "WireHalo"
];

const baseCitySignals: CitySignal[] = [
  { city: "Atlanta", score: 74, status: "Active" },
  { city: "NYC", score: 62, status: "Rising" },
  { city: "LA", score: 58, status: "Afterhours" },
  { city: "Miami", score: 55, status: "Steady" },
  { city: "Chicago", score: 49, status: "Warming" }
];

const prettyDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

const dayKey = () => new Date().toISOString().slice(0, 10);

const dayOfYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
};

const resolveMediaType = (url: string): FanFeedMediaType => {
  const value = url.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/.test(value)) return "image";
  if (value.includes("youtube.com") || value.includes("youtu.be") || value.includes("vimeo.com")) return "video";
  if (/\.(mp4|webm|mov)(\?|$)/.test(value)) return "video";
  return "link";
};

const sanitizeExternalUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const getEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
};

const mediaTypeFromUrlOrNull = (url: string): FanFeedMediaType | null => {
  if (!url.trim()) return null;
  return resolveMediaType(url);
};

const parseBlueprint = (body: string): { cleanBody: string; blueprint: BlueprintPayload | null } => {
  if (!body.startsWith(BLUEPRINT_PREFIX)) return { cleanBody: body, blueprint: null };
  const payloadRaw = body.slice(BLUEPRINT_PREFIX.length).trim();
  const firstNewline = payloadRaw.indexOf("\n");
  const jsonPart = firstNewline >= 0 ? payloadRaw.slice(0, firstNewline) : payloadRaw;
  const textPart = firstNewline >= 0 ? payloadRaw.slice(firstNewline + 1) : "";
  try {
    const blueprint = JSON.parse(jsonPart) as BlueprintPayload;
    return { cleanBody: textPart, blueprint };
  } catch {
    return { cleanBody: body, blueprint: null };
  }
};

const parseRunBun = (body: string): { cleanBody: string; isRunBun: boolean } => {
  if (!body.startsWith(RUN_BUN_PREFIX)) return { cleanBody: body, isRunBun: false };
  return { cleanBody: body.slice(RUN_BUN_PREFIX.length).replace(/^\s+/, ""), isRunBun: true };
};

const parseTrivia = (body: string): { cleanBody: string; isTrivia: boolean; triviaMeta: TriviaPostMeta | null } => {
  if (!body.startsWith(TRIVIA_PREFIX)) return { cleanBody: body, isTrivia: false, triviaMeta: null };
  const payloadRaw = body.slice(TRIVIA_PREFIX.length).trim();
  const firstNewline = payloadRaw.indexOf("\n");
  const jsonPart = firstNewline >= 0 ? payloadRaw.slice(0, firstNewline) : payloadRaw;
  const textPart = firstNewline >= 0 ? payloadRaw.slice(firstNewline + 1) : "";
  try {
    const triviaMeta = JSON.parse(jsonPart) as TriviaPostMeta;
    return { cleanBody: textPart, isTrivia: true, triviaMeta: triviaMeta || null };
  } catch {
    return { cleanBody: payloadRaw, isTrivia: true, triviaMeta: null };
  }
};

const normalizeVoteLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const sanitizeHexColor = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null;
};

const formatCountdown = (remainingMs: number) => {
  const safeMs = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const moderationPill = (status: string) => {
  if (status === "approved") return null;
  if (status === "pending") return "Under review";
  if (status === "flagged") return "Flagged";
  if (status === "rejected") return "Restricted";
  return null;
};

const rankFromXp = (xp: number) => {
  const current = [...ranks].reverse().find((rank) => xp >= rank.minXp) || ranks[0];
  const idx = ranks.findIndex((rank) => rank.label === current.label);
  const next = ranks[Math.min(ranks.length - 1, idx + 1)];
  const span = Math.max(1, next.minXp - current.minXp);
  const progress = next.label === current.label ? 100 : Math.round(((xp - current.minXp) / span) * 100);
  return { current: current.label, progress: Math.max(0, Math.min(100, progress)) };
};

const defaultProfile = (userId: string): ProfileState => ({ userId, xp: 0, likeDay: dayKey(), likesToday: 0, dropRewardDay: "" });

export default function FanFeed() {
  const [viewer, setViewer] = useState<VaultUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [postBody, setPostBody] = useState("");
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postPhotoFile, setPostPhotoFile] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>(defaultProfile("anon"));
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [citySignals, setCitySignals] = useState<CitySignal[]>(baseCitySignals);
  const [activeFans, setActiveFans] = useState<ActiveFan[]>([]);
  const [isPollMode, setIsPollMode] = useState(false);
  const [isRunBunMode, setIsRunBunMode] = useState(false);
  const [runBunMinutes, setRunBunMinutes] = useState(5);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" }
  ]);
  const [pollSelections, setPollSelections] = useState<Record<string, string[]>>({});
  const [bookBlueprintDraft, setBookBlueprintDraft] = useState<BlueprintPayload | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mobileFeedMode, setMobileFeedMode] = useState<"all" | "media" | "polls">("all");
  const prevLikeMapRef = useRef<Record<string, number>>({});
  const swipeStartXRef = useRef<Record<string, number>>({});
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const weeklyPrompt = useMemo(() => prompts[dayOfYear() % prompts.length], []);

  const addXp = (amount: number, reason: string) => {
    if (!viewer) return;
    setProfile((current) => {
      const next = { ...current, xp: current.xp + amount };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      setNotice(`+${amount} XP - ${reason}`);
      return next;
    });
  };

  const logActivity = (type: ActivityType) => {
    const now = Date.now();
    setActivityLog((current) => {
      const next = [...current, { type, ts: now }].filter((item) => now - item.ts <= 40 * 60 * 1000);
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadFeed = async () => {
    const result = await getFanFeed(36);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const mapped: DisplayPost[] = result.posts.map((post) => {
      const triviaParsed = parseTrivia(post.body);
      const runBunParsed = parseRunBun(triviaParsed.cleanBody);
      const parsed = parseBlueprint(runBunParsed.cleanBody);
      return {
        ...post,
        postType: post.poll
          ? runBunParsed.isRunBun
            ? "runbun"
            : triviaParsed.isTrivia
              ? "trivia"
              : "poll"
          : parsed.blueprint
            ? "blueprint"
            : post.mediaUrl
              ? "media"
              : "text",
        cleanBody: parsed.cleanBody,
        blueprint: parsed.blueprint,
        triviaMeta: triviaParsed.triviaMeta
      };
    });
    setPosts(mapped);
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      const user = await getCurrentUser();
      if (!cancelled) {
        setViewer(user);
        if (user) {
          const raw = localStorage.getItem(PROFILE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as ProfileState;
              setProfile({ ...defaultProfile(user.id), ...parsed, userId: user.id });
            } catch {
              setProfile(defaultProfile(user.id));
            }
          } else {
            setProfile(defaultProfile(user.id));
          }
        }
      }
      const rawActivity = localStorage.getItem(ACTIVITY_KEY);
      if (rawActivity) {
        try {
          const parsed = JSON.parse(rawActivity) as ActivityEvent[];
          setActivityLog(Array.isArray(parsed) ? parsed : []);
        } catch {
          setActivityLog([]);
        }
      }
      const rawCities = localStorage.getItem(CITY_KEY);
      if (rawCities) {
        try {
          const parsed = JSON.parse(rawCities) as CitySignal[];
          if (Array.isArray(parsed) && parsed.length) setCitySignals(parsed);
        } catch {
          // ignore
        }
      }
      await loadFeed();
      if (!cancelled) setLoading(false);
    };

    void boot();

    const unsubscribe = subscribeToFanFeed(() => {
      void loadFeed();
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const likeMap: Record<string, number> = {};
    let receivedLikes = 0;
    posts.forEach((post) => {
      likeMap[post.id] = post.likeCount;
      if (post.userId !== viewer.id) return;
      const prev = prevLikeMapRef.current[post.id] ?? post.likeCount;
      if (post.likeCount > prev) receivedLikes += post.likeCount - prev;
    });
    prevLikeMapRef.current = likeMap;
    if (receivedLikes > 0) addXp(receivedLikes * 5, "Received likes");
  }, [posts, viewer]);

  useEffect(() => {
    const updateFans = () => {
      const minuteSeed = Math.floor(Date.now() / 60000);
      const list = activeFanSeeds.map((name, index) => ({
        id: `fan-${index}`,
        name,
        online: ((index * 13 + minuteSeed) % 5) <= 1
      }));
      setActiveFans(list);
    };
    updateFans();
    const timer = window.setInterval(updateFans, 45000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCitySignals((current) => {
        const next = current.map((city, index) => {
          const jitter = ((Date.now() / 1000 + index * 7) % 3) - 1;
          const score = Math.max(20, Math.min(95, Math.round(city.score + jitter)));
          const status = score >= 70 ? "Active" : score >= 58 ? "Rising" : score >= 46 ? "Steady" : "Afterhours";
          return { ...city, score, status };
        });
        localStorage.setItem(CITY_KEY, JSON.stringify(next));
        return next;
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!posts.length) return;
    setCitySignals((current) => {
      const boosts = new Map<string, number>();
      posts.slice(0, 24).forEach((post) => {
        const city = post.blueprint?.city?.trim();
        if (!city) return;
        boosts.set(city, (boosts.get(city) || 0) + 3);
      });
      if (!boosts.size) return current;
      const next = current.map((entry) => {
        const boost = boosts.get(entry.city) || boosts.get(entry.city.toLowerCase()) || 0;
        if (!boost) return entry;
        const score = Math.min(98, entry.score + boost);
        const status = score >= 70 ? "Active" : score >= 58 ? "Rising" : score >= 46 ? "Steady" : "Afterhours";
        return { ...entry, score, status };
      });
      localStorage.setItem(CITY_KEY, JSON.stringify(next));
      return next;
    });
  }, [posts]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get("draft");
    if (!draftId) return;
    const raw = localStorage.getItem(BLUEPRINT_DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { id: string; payload: BlueprintPayload };
      if (parsed.id !== draftId) return;
      setIsPollMode(false);
      setIsRunBunMode(false);
      setBookBlueprintDraft(parsed.payload);
      setIsPollMode(true);
      setPollQuestion(`Run this blueprint: ${parsed.payload.title}?`);
      setPollAllowMultiple(false);
      setPollOptions(BOOK_BLUEPRINT_POLL_OPTIONS);
      setPostBody(`Promoter share: ${parsed.payload.title}`);
      setNotice("Blueprint poll draft loaded.");
      params.delete("draft");
      window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setPollSelections((current) => {
      const next = { ...current };
      posts.forEach((post) => {
        if (!post.poll) return;
        const voted = post.poll.options.filter((option) => option.viewerVoted).map((option) => option.id);
        if (voted.length) next[post.id] = voted;
      });
      return next;
    });
  }, [posts]);

  const energyMetrics = useMemo(() => {
    const now = Date.now();
    const inWindow = (start: number, end: number) => activityLog.filter((a) => now - a.ts <= end && now - a.ts > start);
    const score = (events: ActivityEvent[]) => {
      const postsCount = events.filter((e) => e.type === "post").length;
      const commentsCount = events.filter((e) => e.type === "comment").length;
      const likesCount = events.filter((e) => e.type === "like").length;
      const sharesCount = events.filter((e) => e.type === "share").length;
      return postsCount * 5 + commentsCount * 2 + likesCount + sharesCount * 2;
    };
    const recent = score(inWindow(0, 10 * 60 * 1000));
    const previous = score(inWindow(10 * 60 * 1000, 20 * 60 * 1000));
    const pct = Math.max(8, Math.min(98, Math.round(20 + recent * 3.8)));
    const trend = recent > previous + 2 ? "Rising" : recent + 2 < previous ? "Cooling" : "Steady";
    return { pct, trend: trend as "Rising" | "Steady" | "Cooling" };
  }, [activityLog]);

  const rank = useMemo(() => rankFromXp(profile.xp), [profile.xp]);
  const activeOnlineCount = useMemo(
    () => activeFans.reduce((count, fan) => count + (fan.online ? 1 : 0), 0),
    [activeFans]
  );
  const visiblePosts = useMemo(() => {
    if (mobileFeedMode === "media") return posts.filter((post) => Boolean(post.mediaUrl));
    if (mobileFeedMode === "polls") return posts.filter((post) => Boolean(post.poll));
    return posts;
  }, [mobileFeedMode, posts]);

  const canPublish = useMemo(() => {
    if (isRunBunMode) {
      return Boolean(postPhotoFile || postMediaUrl.trim());
    }
    if (isPollMode) {
      if (bookBlueprintDraft) return Boolean(pollQuestion.trim());
      const filledOptions = pollOptions.filter((option) => option.label.trim().length > 0);
      return Boolean(pollQuestion.trim()) && filledOptions.length >= 2;
    }
    return postBody.trim().length > 0 || postMediaUrl.trim().length > 0 || Boolean(postPhotoFile);
  }, [postBody, postMediaUrl, postPhotoFile, isPollMode, isRunBunMode, pollQuestion, pollOptions, bookBlueprintDraft]);

  const submitPost = async () => {
    if (busy) return;
    if (!viewer) {
      setNotice("Log in to Fan Vault to publish posts.");
      return;
    }
    if (!canPublish) {
      if (isRunBunMode) {
        setNotice("Add a photo or image URL for Run It / Bun It.");
      } else if (isPollMode) {
        setNotice("Add a poll question and at least two options.");
      } else {
        setNotice("Add text, a media link, or a photo before publishing.");
      }
      return;
    }

    setBusy(true);
    try {
      let mediaUrl = postMediaUrl.trim();
      let mediaType: FanFeedMediaType | null = mediaUrl ? resolveMediaType(mediaUrl) : null;

      if (mediaUrl) {
        const safe = sanitizeExternalUrl(mediaUrl);
        if (!safe) {
          setNotice("Media URL must start with http:// or https://.");
          return;
        }
        mediaUrl = safe;
        if (isRunBunMode && resolveMediaType(mediaUrl) !== "image") {
          setNotice("Run It / Bun It requires an image URL.");
          return;
        }
      }

      if (postPhotoFile) {
        const upload = await uploadFeedPhoto(postPhotoFile);
        if (!upload.ok) {
          setNotice(upload.error);
          return;
        }
        mediaUrl = upload.url;
        mediaType = "image";
      }

      const payloadBody = bookBlueprintDraft
        ? `${BLUEPRINT_PREFIX}${JSON.stringify(bookBlueprintDraft)}\n${postBody.trim()}`
        : isRunBunMode
          ? `${RUN_BUN_PREFIX}\n${postBody.trim()}`
        : postBody.trim();

      const pollPayload = isRunBunMode
        ? {
            question: "Run It or Bun It?",
            allowMultiple: false,
            expiresAt: new Date(
              Date.now() +
                Math.max(RUN_BUN_MIN_MINUTES, Math.min(RUN_BUN_MAX_MINUTES, runBunMinutes)) * 60 * 1000
            ).toISOString(),
            options: [
              { label: "Run It", imageUrl: "" },
              { label: "Bun It", imageUrl: "" }
            ]
          }
        : isPollMode
        ? {
            question: pollQuestion.trim(),
            allowMultiple: pollAllowMultiple,
            options: (bookBlueprintDraft ? BOOK_BLUEPRINT_POLL_OPTIONS : pollOptions)
              .map((option) => ({ label: option.label.trim(), imageUrl: option.imageUrl.trim() }))
              .filter((option) => option.label.length > 0)
          }
        : undefined;

      const result = await createFeedPost({
        body: payloadBody,
        mediaUrl: mediaUrl || null,
        mediaType,
        poll: pollPayload
      });

      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      setPostBody("");
      setPostMediaUrl("");
      setPostPhotoFile(null);
      setIsPollMode(false);
      setIsRunBunMode(false);
      setBookBlueprintDraft(null);
      setPollQuestion("");
      setPollAllowMultiple(false);
      setRunBunMinutes(5);
      setPollOptions([
        { label: "", imageUrl: "" },
        { label: "", imageUrl: "" }
      ]);
      logActivity("post");
      addXp(25, "Post published");
      setNotice("Post published.");
      await loadFeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish post.";
      setNotice(message);
    } finally {
      setBusy(false);
    }
  };

  const onLike = async (postId: string) => {
    if (!viewer) {
      setNotice("Log in to Fan Vault to like posts.");
      return;
    }
    const result = await toggleFeedLike(postId);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    logActivity("like");
    setProfile((current) => {
      const today = dayKey();
      const likesToday = current.likeDay === today ? current.likesToday : 0;
      if (likesToday >= 20) return { ...current, likeDay: today, likesToday };
      const next = { ...current, likeDay: today, likesToday: likesToday + 1, xp: current.xp + 2 };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      return next;
    });
    await loadFeed();
  };

  const onVotePoll = async (post: DisplayPost, optionIds: string[]) => {
    if (!viewer) {
      setNotice("Log in to Fan Vault to vote.");
      return;
    }
    if (!post.poll) return;
    if (!optionIds.length) {
      setNotice("Pick at least one option.");
      return;
    }
    const result = await voteFeedPoll({ postId: post.id, optionIds });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setPollSelections((current) => ({ ...current, [post.id]: optionIds }));
    addXp(6, "Crowd Beacon vote");
    setNotice("Vote submitted.");
    await loadFeed();
  };

  const onComment = async (postId: string) => {
    if (!viewer) {
      setNotice("Log in to Fan Vault to comment.");
      return;
    }
    const body = (commentDrafts[postId] || "").trim();
    if (!body) return;
    const result = await createFeedComment(postId, body);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    if (activeCommentPostId === postId) setActiveCommentPostId(null);
    logActivity("comment");
    addXp(10, "Comment");
    await loadFeed();
  };

  const onShare = async (post: DisplayPost) => {
    const postUrl = `${window.location.origin}/feed#post-${post.id}`;
    const url = post.blueprint?.shareLink || postUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Performa Link Up", text: "Tap into this signal post.", url: postUrl });
      } else {
        await navigator.clipboard.writeText(postUrl);
      }
      await incrementFeedShare(post.id);
      logActivity("share");
      addXp(15, "Shared signal");
      setNotice(`Post shared${url && url !== postUrl ? ` (${url})` : ""}.`);
      await loadFeed();
    } catch {
      setNotice("Share cancelled.");
    }
  };

  const onReportPost = async (postId: string) => {
    const reason = window.prompt("Report reason (hate, sexual, harassment, violence, spam, other):", "other");
    if (!reason) return;
    const result = await reportFeedContent({
      targetType: "post",
      targetId: postId,
      reasonCode: reason
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Report submitted. Thank you.");
  };

  const onEditPost = async (post: DisplayPost) => {
    if (!viewer || post.userId !== viewer.id) return;

    const currentText = post.cleanBody || "";
    const nextText = window.prompt("Edit your post text:", currentText);
    if (nextText === null) return;

    const currentMedia = post.mediaUrl || "";
    const nextMediaRaw = window.prompt("Edit media URL (leave blank for none):", currentMedia);
    if (nextMediaRaw === null) return;

    const nextMedia = nextMediaRaw.trim();
    let nextBody = nextText.trim();
    if (post.postType === "blueprint" && post.blueprint) {
      nextBody = `${BLUEPRINT_PREFIX}${JSON.stringify(post.blueprint)}\n${nextBody}`;
    } else if (post.postType === "trivia" && post.triviaMeta) {
      nextBody = `${TRIVIA_PREFIX}${JSON.stringify(post.triviaMeta)}\n${nextBody}`;
    } else if (post.postType === "runbun") {
      if (nextMedia && mediaTypeFromUrlOrNull(nextMedia) !== "image") {
        setNotice("Run It / Bun It posts require an image URL.");
        return;
      }
      nextBody = `${RUN_BUN_PREFIX}\n${nextBody}`;
    }

    const result = await updateFeedPost({
      postId: post.id,
      body: nextBody,
      mediaUrl: nextMedia || null,
      mediaType: mediaTypeFromUrlOrNull(nextMedia || "")
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Post updated.");
    await loadFeed();
  };

  const onDeletePost = async (post: DisplayPost) => {
    if (!viewer || post.userId !== viewer.id) return;
    const confirmed = window.confirm("Delete this post? This cannot be undone.");
    if (!confirmed) return;

    const result = await deleteFeedPost(post.id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Post deleted.");
    await loadFeed();
  };

  const onReportComment = async (commentId: string) => {
    const reason = window.prompt("Report reason (hate, sexual, harassment, violence, spam, other):", "other");
    if (!reason) return;
    const result = await reportFeedContent({
      targetType: "comment",
      targetId: commentId,
      reasonCode: reason
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice("Report submitted. Thank you.");
  };

  const focusComposer = () => {
    const section = document.getElementById("link-up-composer");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => composerRef.current?.focus(), 140);
  };

  const onPromptPrefill = () => {
    setPostBody(weeklyPrompt);
    setIsPollMode(false);
    setIsRunBunMode(false);
    setBookBlueprintDraft(null);
    focusComposer();
  };

  const openCommentComposer = (postId: string) => {
    setActiveCommentPostId(postId);
    const node = document.getElementById(`post-${postId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "end" });
    window.setTimeout(() => commentInputRefs.current[postId]?.focus(), 140);
  };

  const onDropAttend = () => {
    setProfile((current) => {
      const today = dayKey();
      if (current.dropRewardDay === today) return current;
      const next = { ...current, dropRewardDay: today, xp: current.xp + 20 };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      setNotice("+20 XP - Drop attendance");
      return next;
    });
  };

  return (
    <div className="grid items-start gap-4 md:gap-5 xl:min-h-[58rem]">
      <div className="sticky top-[5.2rem] z-30 -mx-1 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/15 bg-black/70 px-2 py-2 backdrop-blur-xl sm:hidden">
        <button
          type="button"
          onClick={focusComposer}
          className="min-h-10 whitespace-nowrap rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold"
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => setMobileFeedMode("all")}
          className={`min-h-10 whitespace-nowrap rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${mobileFeedMode === "all" ? "border-white/45 bg-white/10 text-white" : "border-white/25 bg-black/35 text-white/80"}`}
        >
          For You
        </button>
        <button
          type="button"
          onClick={() => setMobileFeedMode("media")}
          className={`min-h-10 whitespace-nowrap rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${mobileFeedMode === "media" ? "border-white/45 bg-white/10 text-white" : "border-white/25 bg-black/35 text-white/80"}`}
        >
          Media
        </button>
        <button
          type="button"
          onClick={() => setMobileFeedMode("polls")}
          className={`min-h-10 whitespace-nowrap rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${mobileFeedMode === "polls" ? "border-white/45 bg-white/10 text-white" : "border-white/25 bg-black/35 text-white/80"}`}
        >
          Polls
        </button>
        <span className="whitespace-nowrap rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
          Pulse {energyMetrics.pct}%
        </span>
        <span className="whitespace-nowrap rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
          {activeOnlineCount} online
        </span>
      </div>
      <aside className="order-1 xl:fixed xl:top-24 xl:left-[max(1rem,calc((100vw-1700px)/2+1rem))] xl:z-30 xl:w-[340px] 2xl:w-[380px] xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto">
        <article id="link-up-composer" className="rounded-[2rem] border border-white/15 bg-black/55 p-5 backdrop-blur-md md:p-6">
          <p className="text-xs uppercase tracking-[0.34em] text-gold/85">Link Up</p>
          <h3 className="mt-2 font-display text-3xl">Community Signal Wall</h3>
          <p className="mt-3 text-sm text-white/70">Drop moments, media links, and comments in a shared feed with other fans.</p>
          <p className="mt-2 text-xs text-white/50">
            Community safety: hate speech, harassment, and sexual exploitation content are blocked and can be reported.
          </p>

          {!viewer && (
            <p className="mt-3 rounded-xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/75">
              Sign in on <a className="text-gold hover:text-gold/80" href="/fan-club">Fan Vault</a> to post, comment, and like.
            </p>
          )}

          <div className="mt-4">
            <label className="text-xs text-white/70">Post type:</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsPollMode(false);
                  setIsRunBunMode(false);
                  setBookBlueprintDraft(null);
                }}
                className={`min-h-11 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${!isPollMode && !isRunBunMode ? "border-gold/55 text-gold" : "border-white/20 text-white/70"}`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPollMode(true);
                  setIsRunBunMode(false);
                  setBookBlueprintDraft(null);
                  setPostMediaUrl("");
                  setPostPhotoFile(null);
                }}
                className={`min-h-11 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${isPollMode && !isRunBunMode ? "border-gold/55 text-gold" : "border-white/20 text-white/70"}`}
              >
                Crowd Beacon Poll
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRunBunMode(true);
                  setIsPollMode(false);
                  setBookBlueprintDraft(null);
                  setPollQuestion("");
                  setPollAllowMultiple(false);
                  setRunBunMinutes(5);
                  setPollOptions([
                    { label: "", imageUrl: "" },
                    { label: "", imageUrl: "" }
                  ]);
                }}
                className={`min-h-11 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${isRunBunMode ? "border-gold/55 text-gold" : "border-white/20 text-white/70"}`}
              >
                RUN IT or BUN IT
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {isRunBunMode ? (
              <>
                <textarea
                  ref={composerRef}
                  value={postBody}
                  onChange={(event) => setPostBody(event.target.value)}
                  rows={2}
                  placeholder="Optional caption"
                  className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40"
                />
                <input
                  value={postMediaUrl}
                  onChange={(event) => setPostMediaUrl(event.target.value)}
                  placeholder="Image URL (optional if uploading)"
                  className="min-h-11 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40"
                />
                <label className="grid gap-2 rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-xs text-white/75">
                  <span className="uppercase tracking-[0.18em] text-white/55">Timer (minutes)</span>
                  <input
                    type="range"
                    min={RUN_BUN_MIN_MINUTES}
                    max={RUN_BUN_MAX_MINUTES}
                    step={1}
                    value={runBunMinutes}
                    onChange={(event) =>
                      setRunBunMinutes(
                        Math.max(
                          RUN_BUN_MIN_MINUTES,
                          Math.min(RUN_BUN_MAX_MINUTES, Number(event.target.value) || RUN_BUN_MIN_MINUTES)
                        )
                      )
                    }
                    className="w-full accent-amber-400"
                  />
                  <span className="text-gold">{runBunMinutes} minute{runBunMinutes === 1 ? "" : "s"}</span>
                </label>
                <div className="rounded-2xl border border-white/20 bg-black/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Run It / Bun It Image</p>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setPostPhotoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-white/75 file:mr-4 file:min-h-10 file:rounded-full file:border file:border-white/25 file:bg-black/40 file:px-4 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.22em] file:text-white/85" />
                  {postPhotoFile && <p className="mt-2 text-[11px] text-white/55">Selected: {postPhotoFile.name} ({(postPhotoFile.size / (1024 * 1024)).toFixed(2)} MB)</p>}
                </div>
              </>
            ) : isPollMode ? (
              <>
                <input
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  placeholder="Poll question (Crowd Beacon)"
                  className="min-h-11 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40"
                />
                <textarea
                  ref={composerRef}
                  value={postBody}
                  onChange={(event) => setPostBody(event.target.value)}
                  rows={2}
                  placeholder="Optional caption for this poll"
                  className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40"
                />
                <label className="inline-flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={pollAllowMultiple}
                    onChange={(event) => setPollAllowMultiple(event.target.checked)}
                    disabled={Boolean(bookBlueprintDraft)}
                    className="h-4 w-4 rounded border-white/30 bg-black/40"
                  />
                  Allow multiple selections
                </label>
                <div className="grid gap-2">
                  {(bookBlueprintDraft ? BOOK_BLUEPRINT_POLL_OPTIONS : pollOptions).map((option, index) => (
                    <div key={`poll-option-${index}`} className="rounded-2xl border border-white/20 bg-black/35 p-3">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/55">Option {index + 1}</p>
                      <div className="grid gap-2">
                        <input
                          value={option.label}
                          onChange={(event) =>
                            setPollOptions((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, label: event.target.value } : entry
                              )
                            )
                          }
                          disabled={Boolean(bookBlueprintDraft)}
                          placeholder="Option label"
                          className="min-h-11 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40"
                        />
                        <input
                          value={option.imageUrl}
                          onChange={(event) =>
                            setPollOptions((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, imageUrl: event.target.value } : entry
                              )
                            )
                          }
                          disabled={Boolean(bookBlueprintDraft)}
                          placeholder="Optional option image URL"
                          className="min-h-11 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40"
                        />
                      </div>
                    </div>
                  ))}
                  {!bookBlueprintDraft && (
                    <div className="flex flex-wrap gap-2">
                      {pollOptions.length < 6 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((current) => [...current, { label: "", imageUrl: "" }])}
                          className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70"
                        >
                          Add Option
                        </button>
                      )}
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((current) => current.slice(0, -1))}
                          className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70"
                        >
                          Remove Option
                        </button>
                      )}
                    </div>
                  )}
                  {bookBlueprintDraft && (
                    <p className="text-xs text-white/55">Promoter blueprint polls use fixed options: <span className="text-gold/90">Run It</span> and <span className="text-gold/90">Bun It</span>.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <textarea ref={composerRef} value={postBody} onChange={(event) => setPostBody(event.target.value)} rows={3} placeholder="What is the energy tonight?" className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" />
                <input value={postMediaUrl} onChange={(event) => setPostMediaUrl(event.target.value)} placeholder="Optional video/link URL (YouTube, Vimeo, etc.)" className="min-h-11 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" />
                <div className="rounded-2xl border border-white/20 bg-black/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Photo Upload</p>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setPostPhotoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-white/75 file:mr-4 file:min-h-10 file:rounded-full file:border file:border-white/25 file:bg-black/40 file:px-4 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.22em] file:text-white/85" />
                  {postPhotoFile && <p className="mt-2 text-[11px] text-white/55">Selected: {postPhotoFile.name} ({(postPhotoFile.size / (1024 * 1024)).toFixed(2)} MB)</p>}
                </div>
              </>
            )}
            <div className="hidden items-center justify-between gap-3 sm:flex">
              <p className="text-xs text-white/45">
                {isRunBunMode ? "Run It / Bun It is image-only and tracks swipe vote totals." : isPollMode ? "Crowd Beacon polls support text options and optional image URLs." : "Upload photos directly. Videos are URL link based."}
              </p>
              <button type="button" onClick={submitPost} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-xs uppercase tracking-[0.28em] text-ink disabled:opacity-50">{busy ? "Posting..." : "Publish"}</button>
            </div>
            <p className="text-xs text-white/45 sm:hidden">
              {isRunBunMode ? "Run It / Bun It is image-only and tracks swipe vote totals." : isPollMode ? "Crowd Beacon polls support text options and optional image URLs." : "Upload photos directly. Videos are URL link based."}
            </p>
            {notice && (
              <p className="text-xs text-gold" role="status" aria-live="polite">
                {notice}
              </p>
            )}
          </div>
        </article>
      </aside>

      <div className="order-2 space-y-4 pb-28 xl:order-2 xl:ml-[360px] xl:mr-[360px] xl:pb-0 2xl:ml-[400px] 2xl:mr-[380px]">
        <div className="space-y-4 md:space-y-4 max-sm:max-h-[calc(100dvh-16.5rem)] max-sm:overflow-y-auto max-sm:snap-y max-sm:snap-mandatory max-sm:pr-1">
          {loading && <div className="rounded-2xl border border-white/15 bg-black/50 p-5 text-sm text-white/70">Loading feed...</div>}
          {!loading && visiblePosts.length === 0 && (
            <div className="rounded-2xl border border-white/15 bg-black/50 p-5 text-sm text-white/70">
              {mobileFeedMode === "all" ? "No posts yet. Be first to publish." : "No posts in this view yet."}
            </div>
          )}

          {visiblePosts.map((post) => {
            const isImmersiveMediaPost = post.postType === "media" && post.mediaType !== "link" && Boolean(post.mediaUrl);
            return (
            <article
              id={`post-${post.id}`}
              key={post.id}
              className={`relative snap-start overflow-hidden rounded-[1.55rem] border border-white/15 bg-gradient-to-b from-black/60 to-black/40 p-4 shadow-[0_0_60px_rgba(242,84,45,0.08)] max-sm:min-h-[calc(100dvh-18rem)] sm:rounded-3xl sm:p-5 ${
                isImmersiveMediaPost ? "max-sm:pb-2" : ""
              }`}
            >
              <div className={`flex items-start justify-between gap-3 ${isImmersiveMediaPost ? "max-sm:hidden" : ""}`}>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold/85">{post.authorName || "Fan"}</p>
                  {viewer && post.userId === viewer.id && <p className="mt-1 inline-flex rounded-full border border-gold/35 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gold/90">{rank.current}</p>}
                  <p className="mt-1 text-[11px] text-white/50">{prettyDate(post.createdAt)}</p>
                  {moderationPill(post.moderationStatus) && (
                    <p className="mt-1 inline-flex rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100/90">
                      {moderationPill(post.moderationStatus)}
                    </p>
                  )}
                  {post.moderationReason && post.moderationStatus !== "approved" && (
                    <p className="mt-1 text-[11px] text-white/45">{post.moderationReason}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {viewer && post.userId === viewer.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditPost(post)}
                        className="min-h-10 rounded-full border border-gold/35 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-gold/85"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePost(post)}
                        className="min-h-10 rounded-full border border-rose-400/35 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-rose-200/90"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onReportPost(post.id)}
                    className="min-h-10 rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/65"
                  >
                    Report
                  </button>
                </div>
              </div>

              {post.cleanBody && post.postType !== "media" && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-white/85">{post.cleanBody}</p>
              )}

              {post.postType === "blueprint" && post.blueprint && (
                <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gold/90">Promoter Blueprint</p>
                  <h4 className="mt-2 text-lg text-white">{post.blueprint.title}</h4>
                  <div className="mt-3 grid gap-2 text-xs text-white/75 sm:grid-cols-2">
                    <p><span className="text-white/50">Stage Mode:</span> {post.blueprint.venueType}</p>
                    <p><span className="text-white/50">City/Date:</span> {post.blueprint.city || "TBD"} {post.blueprint.date || ""}</p>
                    <p><span className="text-white/50">Cost:</span> {post.blueprint.estimatedCostRange}</p>
                    <p><span className="text-white/50">ROI:</span> low {post.blueprint.roi.low}% / exp {post.blueprint.roi.expected}% / high {post.blueprint.roi.high}%</p>
                    <p><span className="text-white/50">Risk Score:</span> {post.blueprint.riskScore}</p>
                  </div>
                  <a href={post.blueprint.shareLink} className="mt-3 inline-flex rounded-full border border-gold/45 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold">View Blueprint</a>
                </div>
              )}

              {post.postType === "trivia" && post.poll && (
                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    post.triviaMeta?.cardTone === "cyan"
                      ? "border-cyan-400/30 bg-cyan-500/5"
                      : post.triviaMeta?.cardTone === "ember"
                        ? "border-amber-300/35 bg-amber-500/5"
                        : post.triviaMeta?.cardTone === "neutral"
                          ? "border-white/20 bg-white/5"
                          : "border-gold/30 bg-gold/5"
                  }`}
                >
                  {(() => {
                    const accent = sanitizeHexColor(post.triviaMeta?.accentColor || "") || "#f9b233";
                    return (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>
                          {post.triviaMeta?.label?.trim() || "Trivia Beacon"}
                        </p>
                        <h4 className="mt-2 text-lg text-white">{post.poll.question}</h4>
                        <p className="mt-1 text-xs text-white/55">
                          {post.poll.allowMultiple ? "Multiple choice enabled" : "Single choice"} · {post.poll.totalVotes} vote{post.poll.totalVotes === 1 ? "" : "s"}
                          {post.poll.expiresAt ? ` · Ends ${prettyDate(post.poll.expiresAt)}` : ""}
                        </p>
                        <div className="mt-3 space-y-2">
                          {post.poll.options.map((option) => {
                            const pct = post.poll!.totalVotes > 0 ? Math.round((option.voteCount / post.poll!.totalVotes) * 100) : 0;
                            const selected = option.viewerVoted || (pollSelections[post.id] || []).includes(option.id);
                            const safeOptionImageUrl = option.imageUrl ? sanitizeExternalUrl(option.imageUrl) : null;
                            const optionButtonBase = "w-full rounded-xl border px-3 py-2 text-left text-sm transition";
                            const optionButtonTone = selected
                              ? "bg-black/40 text-white border-white/45"
                              : "border-white/20 bg-black/30 text-white/80 hover:border-white/45";
                            return (
                              <div key={option.id} className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!post.poll) return;
                                    if (post.poll.allowMultiple) {
                                      setPollSelections((current) => {
                                        const existing = current[post.id] || post.poll!.options.filter((entry) => entry.viewerVoted).map((entry) => entry.id);
                                        const has = existing.includes(option.id);
                                        const next = has ? existing.filter((id) => id !== option.id) : [...existing, option.id];
                                        return { ...current, [post.id]: next };
                                      });
                                      return;
                                    }
                                    void onVotePoll(post, [option.id]);
                                  }}
                                  className={`${optionButtonBase} ${optionButtonTone}`}
                                  style={selected ? { borderColor: accent } : undefined}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span>{option.label}</span>
                                    <span className="text-xs text-white/55">{option.voteCount} · {pct}%</span>
                                  </div>
                                  {safeOptionImageUrl && (
                                    <img src={safeOptionImageUrl} alt="" loading="lazy" className="mt-2 max-h-44 w-full rounded-lg object-cover" />
                                  )}
                                </button>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {post.poll.allowMultiple && (
                          <div className="mt-3 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => void onVotePoll(post, pollSelections[post.id] || [])}
                              className="min-h-10 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white"
                              style={{ borderColor: accent, color: accent }}
                            >
                              Cast Vote
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {post.postType === "poll" && post.poll && (
                <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/90">Crowd Beacon</p>
                  <h4 className="mt-2 text-lg text-white">{post.poll.question}</h4>
                  <p className="mt-1 text-xs text-white/55">
                    {post.poll.allowMultiple ? "Multiple choice enabled" : "Single choice"} · {post.poll.totalVotes} vote{post.poll.totalVotes === 1 ? "" : "s"}
                    {post.poll.expiresAt ? ` · Ends ${prettyDate(post.poll.expiresAt)}` : ""}
                  </p>
                  <div className="mt-3 space-y-2">
                    {post.poll.options.map((option) => {
                      const pct = post.poll!.totalVotes > 0 ? Math.round((option.voteCount / post.poll!.totalVotes) * 100) : 0;
                      const selected = option.viewerVoted || (pollSelections[post.id] || []).includes(option.id);
                      const safeOptionImageUrl = option.imageUrl ? sanitizeExternalUrl(option.imageUrl) : null;
                      const optionButtonBase = "w-full rounded-xl border px-3 py-2 text-left text-sm transition";
                      const optionButtonTone = selected
                        ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100"
                        : "border-white/20 bg-black/30 text-white/80 hover:border-white/45";
                      return (
                        <div key={option.id} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!post.poll) return;
                              if (post.poll.allowMultiple) {
                                setPollSelections((current) => {
                                  const existing = current[post.id] || post.poll!.options.filter((entry) => entry.viewerVoted).map((entry) => entry.id);
                                  const has = existing.includes(option.id);
                                  const next = has ? existing.filter((id) => id !== option.id) : [...existing, option.id];
                                  return { ...current, [post.id]: next };
                                });
                                return;
                              }
                              void onVotePoll(post, [option.id]);
                            }}
                            className={`${optionButtonBase} ${optionButtonTone}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{option.label}</span>
                              <span className="text-xs text-white/55">{option.voteCount} · {pct}%</span>
                            </div>
                            {safeOptionImageUrl && (
                              <img src={safeOptionImageUrl} alt="" loading="lazy" className="mt-2 max-h-44 w-full rounded-lg object-cover" />
                            )}
                          </button>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full bg-cyan-300/70" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {post.poll.allowMultiple && (
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => void onVotePoll(post, pollSelections[post.id] || [])}
                        className="min-h-10 rounded-full border border-cyan-300/50 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-cyan-100"
                      >
                        Cast Vote
                      </button>
                    </div>
                  )}
                </div>
              )}

              {post.postType === "runbun" && post.poll && (
                <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
                  {(() => {
                    const runOption = post.poll.options.find((option) => normalizeVoteLabel(option.label) === "run it");
                    const bunOption = post.poll.options.find((option) => normalizeVoteLabel(option.label) === "bun it");
                    const runVotes = runOption?.voteCount || 0;
                    const bunVotes = bunOption?.voteCount || 0;
                    const total = Math.max(1, runVotes + bunVotes);
                    const runPct = Math.round((runVotes / total) * 100);
                    const bunPct = Math.round((bunVotes / total) * 100);
                    const safeImageUrl = post.mediaUrl ? sanitizeExternalUrl(post.mediaUrl) : null;
                    const expiresAtMs = post.poll?.expiresAt ? Date.parse(post.poll.expiresAt) : NaN;
                    const hasExpiry = Number.isFinite(expiresAtMs);
                    const remainingMs = hasExpiry ? Math.max(0, expiresAtMs - nowMs) : 0;
                    const isExpired = hasExpiry ? remainingMs <= 0 : false;

                    const onSwipeVote = (deltaX: number) => {
                      if (isExpired) return;
                      if (Math.abs(deltaX) < SWIPE_VOTE_DELTA_PX) return;
                      if (deltaX > 0 && runOption) {
                        void onVotePoll(post, [runOption.id]);
                        return;
                      }
                      if (deltaX < 0 && bunOption) {
                        void onVotePoll(post, [bunOption.id]);
                      }
                    };

                    return (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gold/90">Run It / Bun It</p>
                        <p className="mt-1 text-xs text-white/60">
                          {isExpired ? "Voting closed." : "Swipe right to Run It. Swipe left to Bun It."}
                          {post.poll?.expiresAt ? ` Ends ${prettyDate(post.poll.expiresAt)}.` : ""}
                        </p>
                        <div className="mt-2 inline-flex items-center rounded-full border border-gold/35 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold/90">
                          {hasExpiry ? `Countdown ${formatCountdown(remainingMs)}` : "No timer"}
                        </div>
                        <div
                          className="relative mt-3 overflow-hidden rounded-2xl border border-white/15 bg-black/35"
                          onTouchStart={(event) => {
                            swipeStartXRef.current[post.id] = event.changedTouches[0]?.clientX || 0;
                          }}
                          onTouchEnd={(event) => {
                            const startX = swipeStartXRef.current[post.id] || 0;
                            const endX = event.changedTouches[0]?.clientX || startX;
                            onSwipeVote(endX - startX);
                          }}
                          onMouseDown={(event) => {
                            swipeStartXRef.current[post.id] = event.clientX;
                          }}
                          onMouseUp={(event) => {
                            const startX = swipeStartXRef.current[post.id] || event.clientX;
                            onSwipeVote(event.clientX - startX);
                          }}
                        >
                          {safeImageUrl ? (
                            <img src={safeImageUrl} alt="" loading="lazy" className="max-h-[34rem] w-full object-cover" />
                          ) : (
                            <p className="px-4 py-3 text-sm text-white/55">Run It / Bun It requires a safe image URL.</p>
                          )}
                          {isExpired && (
                            <div className="pointer-events-none absolute inset-0">
                              <div className="absolute inset-0 bg-gradient-to-t from-orange-700/70 via-amber-500/35 to-transparent animate-pulse" />
                              <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-[radial-gradient(circle_at_10%_100%,rgba(255,120,0,0.85),transparent_40%),radial-gradient(circle_at_35%_100%,rgba(255,180,0,0.8),transparent_45%),radial-gradient(circle_at_60%_100%,rgba(255,90,0,0.8),transparent_42%),radial-gradient(circle_at_85%_100%,rgba(255,170,0,0.75),transparent_44%)] opacity-90 animate-pulse" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="rounded-2xl border border-amber-300/60 bg-black/65 px-8 py-4 text-3xl font-semibold uppercase tracking-[0.24em] text-amber-200 shadow-[0_0_30px_rgba(255,140,0,0.55)]">
                                  BUN UP!
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-3 text-[10px] uppercase tracking-[0.2em]">
                            <span className="rounded-full border border-gold/40 bg-black/55 px-3 py-1 text-gold">Run It →</span>
                            <span className="rounded-full border border-rose-300/35 bg-black/55 px-3 py-1 text-rose-200">← Bun It</span>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={!runOption || isExpired}
                            onClick={() => runOption && void onVotePoll(post, [runOption.id])}
                            className="min-h-11 rounded-xl border border-gold/40 bg-black/35 px-4 py-2 text-left text-sm text-gold disabled:opacity-50"
                          >
                            Run It · {runVotes} ({runPct}%)
                          </button>
                          <button
                            type="button"
                            disabled={!bunOption || isExpired}
                            onClick={() => bunOption && void onVotePoll(post, [bunOption.id])}
                            className="min-h-11 rounded-xl border border-rose-300/35 bg-black/35 px-4 py-2 text-left text-sm text-rose-200 disabled:opacity-50"
                          >
                            Bun It · {bunVotes} ({bunPct}%)
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {post.mediaUrl && post.postType !== "runbun" && (
                <div
                  className={`relative mt-4 overflow-hidden rounded-2xl border bg-black/40 ${
                    post.postType === "media" ? "border-gold/30 shadow-[0_0_32px_rgba(243,211,139,0.12)]" : "border-white/15"
                  } ${
                    isImmersiveMediaPost ? "max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0" : ""
                  }`}
                >
                  {post.mediaType === "image" && (
                    (() => {
                      const safe = sanitizeExternalUrl(post.mediaUrl || "");
                      if (!safe) return <p className="px-4 py-3 text-sm text-white/55">Blocked unsafe image URL.</p>;
                      return (
                        <img
                          src={safe}
                          alt=""
                          loading="lazy"
                          className={`w-full object-cover ${
                            post.postType === "media" ? "max-h-[72dvh] max-sm:h-[72dvh]" : "max-h-[34rem]"
                          }`}
                        />
                      );
                    })()
                  )}
                  {post.mediaType === "video" && (
                    (() => {
                      const safe = sanitizeExternalUrl(post.mediaUrl || "");
                      if (!safe) return <p className="px-4 py-3 text-sm text-white/55">Blocked unsafe video URL.</p>;
                      const embed = getEmbedUrl(safe);
                      if (embed) {
                        return (
                          <iframe
                            src={embed}
                            title="Shared fan video"
                            className={`w-full ${isImmersiveMediaPost ? "max-sm:h-[72dvh]" : "aspect-video"}`}
                            allow="autoplay; encrypted-media; picture-in-picture; web-share"
                            loading="lazy"
                          />
                        );
                      }
                      return <a href={safe} target="_blank" rel="noreferrer noopener" className="block px-4 py-3 text-sm text-gold hover:text-gold/80">Open video link</a>;
                    })()
                  )}
                  {post.mediaType === "link" && (
                    (() => {
                      const safe = sanitizeExternalUrl(post.mediaUrl || "");
                      if (!safe) return <p className="px-4 py-3 text-sm text-white/55">Blocked unsafe link URL.</p>;
                      return <a href={safe} target="_blank" rel="noreferrer noopener" className="block px-4 py-3 text-sm text-gold hover:text-gold/80">Open shared link</a>;
                    })()
                  )}
                  {isImmersiveMediaPost && (
                    <>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/65 to-transparent sm:hidden" />
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3 sm:hidden">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-white/75 animate-pulse">
                          <span>Swipe</span>
                          <span className="text-white/45">|</span>
                          <span>Next Drop</span>
                        </div>
                        <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-gold/90">{post.authorName || "Fan"}</p>
                        <p className="mt-1 text-[11px] text-white/55">{prettyDate(post.createdAt)}</p>
                        {post.cleanBody && (
                          <p className="mt-2 max-w-[95%] text-sm leading-5 text-white/92">{post.cleanBody}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="absolute right-3 top-[4.2rem] z-20 flex flex-col gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => onLike(post.id)}
                  className={`min-h-11 min-w-11 rounded-full border bg-black/70 px-2 text-[11px] font-medium backdrop-blur-lg ${post.viewerHasLiked ? "border-gold/70 text-gold" : "border-white/30 text-white/85"}`}
                >
                  {post.likeCount}
                </button>
                <button
                  type="button"
                  onClick={() => openCommentComposer(post.id)}
                  className="min-h-11 min-w-11 rounded-full border border-white/30 bg-black/70 px-2 text-[11px] font-medium text-white/85 backdrop-blur-lg"
                >
                  {post.comments.length}
                </button>
                <button
                  type="button"
                  onClick={() => onShare(post)}
                  className="min-h-11 min-w-11 rounded-full border border-white/30 bg-black/70 px-2 text-[10px] uppercase tracking-[0.15em] text-white/85 backdrop-blur-lg"
                >
                  Share
                </button>
              </div>

              {post.cleanBody && post.postType === "media" && !isImmersiveMediaPost && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-white/90">{post.cleanBody}</p>
              )}

              <div className="mt-4 hidden grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.19em] sm:flex sm:flex-wrap sm:items-center sm:text-xs sm:tracking-[0.22em]">
                <button type="button" onClick={() => onLike(post.id)} className={`min-h-11 rounded-full border px-4 py-2 transition ${post.viewerHasLiked ? "border-gold/60 text-gold" : "border-white/20 text-white/70 hover:border-white/45 hover:text-white"}`}>Like {post.likeCount}</button>
                <button type="button" onClick={() => onShare(post)} className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-white/70 transition hover:border-white/45 hover:text-white">Share {post.shareCount}</button>
                <button
                  type="button"
                  onClick={() => openCommentComposer(post.id)}
                  className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-white/70 transition hover:border-white/45 hover:text-white"
                >
                  Comments {post.comments.length}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {(expandedComments[post.id] ? post.comments : post.comments.slice(0, 2)).map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-white/12 bg-black/35 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{comment.authorName || "Fan"}</p>
                        {moderationPill(comment.moderationStatus) && (
                          <p className="mt-1 inline-flex rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100/90">
                            {moderationPill(comment.moderationStatus)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onReportComment(comment.id)}
                        className="min-h-9 rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65"
                      >
                        Report
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-white/80">{comment.body}</p>
                    {comment.moderationReason && comment.moderationStatus !== "approved" && (
                      <p className="mt-1 text-[11px] text-white/45">{comment.moderationReason}</p>
                    )}
                    <p className="mt-1 text-[11px] text-white/40">{prettyDate(comment.createdAt)}</p>
                  </div>
                ))}
                {post.comments.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !current[post.id] }))}
                    className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70"
                  >
                    {expandedComments[post.id] ? "Show fewer comments" : `View all ${post.comments.length} comments`}
                  </button>
                )}
              </div>

              <div className="mt-4 hidden items-center gap-2 sm:flex">
                <input
                  ref={(node) => {
                    commentInputRefs.current[post.id] = node;
                  }}
                  value={commentDrafts[post.id] || ""}
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                  placeholder="Write a comment..."
                  className="min-h-11 flex-1 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm text-white placeholder:text-white/40"
                />
                <button type="button" onClick={() => onComment(post.id)} className="min-h-11 rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold hover:bg-gold/10">Send</button>
              </div>
            </article>
            );
          })}
        </div>
        {notice && <p className="text-xs text-gold">{notice}</p>}
      </div>

      <aside className="order-3 xl:fixed xl:top-24 xl:right-[max(1rem,calc((100vw-1700px)/2+1rem))] xl:z-30 xl:w-[340px] 2xl:w-[360px] xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto">
        <SignalCommandCenter
        energy={energyMetrics.pct}
        trend={energyMetrics.trend}
        activeFans={activeFans}
        citySignals={citySignals}
        weeklyPrompt={weeklyPrompt}
        rankLabel={rank.current}
        xp={profile.xp}
        progressPct={rank.progress}
        onUsePrompt={onPromptPrefill}
        onDropAttend={onDropAttend}
        inline
        />
      </aside>

      {!activeCommentPostId && (
        <button
          type="button"
          onClick={focusComposer}
          className="fixed bottom-[6.25rem] right-4 z-40 min-h-11 rounded-full border border-gold/40 bg-black/85 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold backdrop-blur-xl sm:hidden"
        >
          Jump to Composer
        </button>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <div className="rounded-2xl border border-white/20 bg-black/80 px-4 py-3 backdrop-blur-xl">
          {activeCommentPostId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Comment Mode</p>
                <button
                  type="button"
                  onClick={() => setActiveCommentPostId(null)}
                  className="min-h-9 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70"
                >
                  Close
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={(node) => {
                    if (activeCommentPostId) commentInputRefs.current[activeCommentPostId] = node;
                  }}
                  value={commentDrafts[activeCommentPostId] || ""}
                  onChange={(event) =>
                    setCommentDrafts((current) => ({ ...current, [activeCommentPostId]: event.target.value }))
                  }
                  placeholder="Write a comment..."
                  className="min-h-11 flex-1 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm text-white placeholder:text-white/40"
                />
                <button
                  type="button"
                  onClick={() => onComment(activeCommentPostId)}
                  className="min-h-11 rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">
                  {isRunBunMode ? "Run It / Bun It" : isPollMode ? "Crowd Beacon Poll" : "Standard Post"}
                </p>
                <p className="text-xs text-white/75">
                  {canPublish ? "Ready to publish" : isRunBunMode ? "Add a photo or image URL" : isPollMode ? "Add question + 2 options" : "Add text, photo, or link"}
                </p>
              </div>
              <button
                type="button"
                onClick={submitPost}
                disabled={busy}
                className="min-h-11 rounded-full bg-ember px-5 py-2 text-xs uppercase tracking-[0.26em] text-ink disabled:opacity-50"
              >
                {busy ? "Posting..." : "Publish"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
