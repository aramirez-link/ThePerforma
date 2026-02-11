import { useEffect, useMemo, useRef, useState } from "react";
import SignalCommandCenter from "./SignalCommandCenter";
import {
  createFeedComment,
  createFeedPost,
  getCurrentUser,
  getFanFeed,
  incrementFeedShare,
  reportFeedContent,
  subscribeToFanFeed,
  toggleFeedLike,
  uploadFeedPhoto,
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
  postType: "text" | "media" | "blueprint";
  cleanBody: string;
  blueprint: BlueprintPayload | null;
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

const PROFILE_KEY = "the-performa-feed-profile-v1";
const ACTIVITY_KEY = "the-performa-feed-activity-v1";
const CITY_KEY = "the-performa-feed-city-signals-v1";
const BLUEPRINT_DRAFT_KEY = "the-performa-blueprint-draft-v1";
const BLUEPRINT_PREFIX = "[[BLUEPRINT]]";

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
  const [isBlueprintMode, setIsBlueprintMode] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintPayload>({
    title: "",
    city: "",
    date: "",
    venueType: "Warehouse",
    intensity: 75,
    tier: "Enhanced",
    modules: [],
    estimatedCostRange: "$45k-$90k",
    roi: { low: 8, expected: 21, high: 35 },
    riskScore: 32,
    shareLink: "/book"
  });
  const prevLikeMapRef = useRef<Record<string, number>>({});
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
      const parsed = parseBlueprint(post.body);
      return {
        ...post,
        postType: parsed.blueprint ? "blueprint" : post.mediaUrl ? "media" : "text",
        cleanBody: parsed.cleanBody,
        blueprint: parsed.blueprint
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
      setIsBlueprintMode(true);
      setBlueprint(parsed.payload);
      setPostBody(`Promoter share: ${parsed.payload.title}`);
      setNotice("Blueprint draft loaded.");
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

  const canPublish = useMemo(() => {
    if (isBlueprintMode) return Boolean(blueprint.title.trim());
    return postBody.trim().length > 0 || postMediaUrl.trim().length > 0 || Boolean(postPhotoFile);
  }, [postBody, postMediaUrl, postPhotoFile, isBlueprintMode, blueprint.title]);

  const submitPost = async () => {
    if (!viewer) {
      setNotice("Log in to Fan Vault to publish posts.");
      return;
    }
    if (!canPublish) return;

    setBusy(true);

    let mediaUrl = postMediaUrl.trim();
    let mediaType: FanFeedMediaType | null = mediaUrl ? resolveMediaType(mediaUrl) : null;

    if (mediaUrl) {
      const safe = sanitizeExternalUrl(mediaUrl);
      if (!safe) {
        setBusy(false);
        setNotice("Media URL must start with http:// or https://.");
        return;
      }
      mediaUrl = safe;
    }

    if (postPhotoFile) {
      const upload = await uploadFeedPhoto(postPhotoFile);
      if (!upload.ok) {
        setBusy(false);
        setNotice(upload.error);
        return;
      }
      mediaUrl = upload.url;
      mediaType = "image";
    }

    const payloadBody = isBlueprintMode
      ? `${BLUEPRINT_PREFIX}${JSON.stringify(blueprint)}\n${postBody.trim()}`
      : postBody.trim();

    const result = await createFeedPost({
      body: payloadBody,
      mediaUrl: mediaUrl || null,
      mediaType
    });

    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setPostBody("");
    setPostMediaUrl("");
    setPostPhotoFile(null);
    setIsBlueprintMode(false);
    setBlueprint((current) => ({ ...current, title: "", city: "", date: "" }));
    logActivity("post");
    addXp(25, "Post published");
    setNotice("Post published.");
    await loadFeed();
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
    setIsBlueprintMode(false);
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 space-y-6 pb-28 lg:order-1 lg:pb-0">
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
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <button type="button" onClick={() => setIsBlueprintMode(false)} className={`min-h-11 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${!isBlueprintMode ? "border-gold/55 text-gold" : "border-white/20 text-white/70"}`}>Standard</button>
              <button type="button" onClick={() => setIsBlueprintMode(true)} className={`min-h-11 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${isBlueprintMode ? "border-gold/55 text-gold" : "border-white/20 text-white/70"}`}>Post a Blueprint</button>
            </div>
          </div>

          {isBlueprintMode && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={blueprint.title} onChange={(e) => setBlueprint((c) => ({ ...c, title: e.target.value }))} placeholder="Blueprint title" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input value={blueprint.city} onChange={(e) => setBlueprint((c) => ({ ...c, city: e.target.value }))} placeholder="City" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input type="date" value={blueprint.date} onChange={(e) => setBlueprint((c) => ({ ...c, date: e.target.value }))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input value={blueprint.estimatedCostRange} onChange={(e) => setBlueprint((c) => ({ ...c, estimatedCostRange: e.target.value }))} placeholder="Cost range" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input value={blueprint.shareLink} onChange={(e) => setBlueprint((c) => ({ ...c, shareLink: e.target.value }))} placeholder="/book?p=..." className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm sm:col-span-2" />
            </div>
          )}

          <div className="mt-4 grid gap-3">
            <textarea ref={composerRef} value={postBody} onChange={(event) => setPostBody(event.target.value)} rows={3} placeholder="What is the energy tonight?" className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" />
            <input value={postMediaUrl} onChange={(event) => setPostMediaUrl(event.target.value)} placeholder="Optional video/link URL (YouTube, Vimeo, etc.)" className="min-h-11 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" />
            <div className="rounded-2xl border border-white/20 bg-black/35 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Photo Upload</p>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setPostPhotoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-white/75 file:mr-4 file:min-h-10 file:rounded-full file:border file:border-white/25 file:bg-black/40 file:px-4 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.22em] file:text-white/85" />
              {postPhotoFile && <p className="mt-2 text-[11px] text-white/55">Selected: {postPhotoFile.name} ({(postPhotoFile.size / (1024 * 1024)).toFixed(2)} MB)</p>}
            </div>
            <div className="hidden items-center justify-between gap-3 sm:flex">
              <p className="text-xs text-white/45">Upload photos directly. Videos are URL link based.</p>
              <button type="button" onClick={submitPost} disabled={!canPublish || busy || !viewer} className="min-h-11 rounded-full bg-ember px-5 py-2 text-xs uppercase tracking-[0.28em] text-ink disabled:opacity-50">{busy ? "Posting..." : "Publish"}</button>
            </div>
            <p className="text-xs text-white/45 sm:hidden">Upload photos directly. Videos are URL link based.</p>
          </div>
        </article>

        <div className="space-y-4">
          {loading && <div className="rounded-2xl border border-white/15 bg-black/50 p-5 text-sm text-white/70">Loading feed...</div>}
          {!loading && posts.length === 0 && <div className="rounded-2xl border border-white/15 bg-black/50 p-5 text-sm text-white/70">No posts yet. Be first to publish.</div>}

          {posts.map((post) => (
            <article id={`post-${post.id}`} key={post.id} className="rounded-3xl border border-white/15 bg-black/50 p-5 shadow-[0_0_60px_rgba(242,84,45,0.08)]">
              <div className="flex items-start justify-between gap-3">
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
                <button
                  type="button"
                  onClick={() => onReportPost(post.id)}
                  className="min-h-10 rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/65"
                >
                  Report
                </button>
              </div>

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

              {post.cleanBody && <p className="mt-4 whitespace-pre-wrap text-sm text-white/85">{post.cleanBody}</p>}

              {post.mediaUrl && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
                  {post.mediaType === "image" && (
                    (() => {
                      const safe = sanitizeExternalUrl(post.mediaUrl || "");
                      if (!safe) return <p className="px-4 py-3 text-sm text-white/55">Blocked unsafe image URL.</p>;
                      return <img src={safe} alt="" loading="lazy" className="max-h-[34rem] w-full object-cover" />;
                    })()
                  )}
                  {post.mediaType === "video" && (
                    (() => {
                      const safe = sanitizeExternalUrl(post.mediaUrl || "");
                      if (!safe) return <p className="px-4 py-3 text-sm text-white/55">Blocked unsafe video URL.</p>;
                      const embed = getEmbedUrl(safe);
                      if (embed) {
                        return <iframe src={embed} title="Shared fan video" className="aspect-video w-full" allow="autoplay; encrypted-media; picture-in-picture; web-share" loading="lazy" />;
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
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs uppercase tracking-[0.22em] sm:flex sm:flex-wrap sm:items-center">
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
          ))}
        </div>
        {notice && <p className="text-xs text-gold">{notice}</p>}
      </div>

      <div className="order-1 lg:order-2">
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
        />
      </div>

      {!activeCommentPostId && (
        <button
          type="button"
          onClick={focusComposer}
          className="fixed bottom-[6.15rem] right-4 z-40 min-h-11 rounded-full border border-white/20 bg-black/80 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-xl sm:hidden"
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
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">{isBlueprintMode ? "Blueprint" : "Standard Post"}</p>
                <p className="text-xs text-white/75">{canPublish ? "Ready to publish" : "Add text, photo, or link"}</p>
              </div>
              <button
                type="button"
                onClick={submitPost}
                disabled={!canPublish || busy || !viewer}
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
