import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { defaultProfileBadgeId } from "./profileBadges";

export type FavoriteType = "gallery" | "watch" | "listen";

export type FavoriteRecord = {
  type: FavoriteType;
  id: string;
  title: string;
  href: string;
  image?: string;
  savedAt: string;
};

export type VaultBadge = {
  id: string;
  label: string;
  tier?: "core" | "elite" | "legend";
  tip?: string;
};

export type VaultUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  bio: string;
  profileBadgeId?: string;
  favorites: FavoriteRecord[];
};

export type EngagementMissionState = {
  stageMode: boolean;
  watchAndListen: boolean;
  innerCircle: boolean;
};

export type EngagementState = {
  points: number;
  streak: number;
  lastSeenDate: string;
  dailyClaimDate: string;
  weekKey: string;
  weeklySignal: number;
  visitedPaths: string[];
  reactions: {
    fire: number;
    bolt: number;
    hands: number;
  };
  missions: EngagementMissionState;
};

export type EngagementLeaderboardEntry = {
  userId: string;
  displayName: string;
  points: number;
  streak: number;
  weeklySignal: number;
  score: number;
  updatedAt: string;
};

export type FanFeedMediaType = "image" | "video" | "link";
export type FeedModerationStatus = "pending" | "approved" | "rejected" | "flagged";
export type FeedReportTargetType = "post" | "comment";
export type FeedReportStatus = "open" | "reviewed" | "resolved" | "dismissed";

export type FeedModerationReport = {
  id: number;
  reporterUserId: string;
  targetType: FeedReportTargetType;
  targetId: string;
  reasonCode: string;
  details: string | null;
  status: FeedReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type FanFeedComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  moderationStatus: FeedModerationStatus;
  moderationReason: string | null;
  createdAt: string;
};

export type FanFeedPollOption = {
  id: string;
  label: string;
  imageUrl: string | null;
  position: number;
  voteCount: number;
  viewerVoted: boolean;
};

export type FanFeedPoll = {
  question: string;
  allowMultiple: boolean;
  expiresAt: string | null;
  totalVotes: number;
  viewerHasVoted: boolean;
  options: FanFeedPollOption[];
};

export type TriviaLookAndFeel = {
  accentColor?: string;
  label?: string;
  cardTone?: "ember" | "gold" | "cyan" | "neutral";
};

export type TriviaQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  imageUrl: string | null;
  explanation: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TriviaCampaign = {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "completed";
  questionIds: string[];
  scheduleTimezone: string;
  startAt: string;
  endAt: string | null;
  cadenceMinutes: number;
  postDurationMinutes: number;
  nextRunAt: string;
  lastRunAt: string | null;
  lookAndFeel: TriviaLookAndFeel;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FanFeedPost = {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  mediaUrl: string | null;
  mediaType: FanFeedMediaType | null;
  moderationStatus: FeedModerationStatus;
  moderationReason: string | null;
  isNsfw: boolean;
  shareCount: number;
  likeCount: number;
  viewerHasLiked: boolean;
  poll: FanFeedPoll | null;
  comments: FanFeedComment[];
  createdAt: string;
  updatedAt: string;
};

const FAN_FEED_MEDIA_BUCKET = "fan-feed-media";
const FEED_MAX_POST_BODY_LEN = 4000;
const FEED_MAX_COMMENT_BODY_LEN = 600;
const FEED_MAX_MEDIA_URL_LEN = 2048;
const FEED_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FEED_MAX_POLL_QUESTION_LEN = 280;
const FEED_MAX_POLL_OPTION_LEN = 120;
const FEED_MIN_POLL_OPTIONS = 2;
const FEED_MAX_POLL_OPTIONS = 6;
const FEED_ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
]);
const FEED_BLOCKED_TERMS = [
  "nigger",
  "faggot",
  "kike",
  "spic",
  "chink",
  "wetback",
  "tranny",
  "rape",
  "child porn",
  "bestiality",
  "incest"
];

type LocalVaultUser = VaultUser & { password: string };

type Result<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type OAuthProvider = "google" | "github" | "facebook" | "apple";

const USERS_KEY = "the-performa-fan-vault-users-v1";
const SESSION_KEY = "the-performa-fan-vault-session-v1";
const BADGES_KEY = "the-performa-badges-v1";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isCloudVaultEnabled = Boolean(url && anonKey);

let supabaseClient: SupabaseClient | null = null;
let authListenerBound = false;

const parseAuthErrorFromUrl = () => {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const searchError = url.searchParams.get("error_description") || url.searchParams.get("error");
  const hashError = hashParams.get("error_description") || hashParams.get("error");
  return (searchError || hashError || "").trim();
};

const stripAuthParamsFromUrl = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const paramsToDelete = ["code", "error", "error_code", "error_description", "access_token", "refresh_token", "expires_at", "expires_in", "token_type", "provider_token", "provider_refresh_token"];
  let changed = false;
  paramsToDelete.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (url.hash) {
    url.hash = "";
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
};

const resolveAuthEmail = (authUser: User): string => {
  const direct = typeof authUser.email === "string" ? authUser.email.trim() : "";
  if (direct) return direct.toLowerCase();
  const metaEmail = typeof authUser.user_metadata?.email === "string" ? authUser.user_metadata.email.trim() : "";
  if (metaEmail) return metaEmail.toLowerCase();
  const identities = Array.isArray(authUser.identities) ? authUser.identities : [];
  for (const identity of identities) {
    const email = typeof identity?.identity_data?.email === "string" ? identity.identity_data.email.trim() : "";
    if (email) return email.toLowerCase();
  }
  return `${authUser.id}@fan.local`;
};

const getSupabase = () => {
  if (!isCloudVaultEnabled || !url || !anonKey) return null;
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  if (typeof window !== "undefined" && !authListenerBound) {
    supabaseClient.auth.onAuthStateChange(() => {
      emitChange();
    });
    authListenerBound = true;
  }
  return supabaseClient;
};

const normalizeEngagementState = (state: EngagementState): EngagementState => ({
  points: Math.max(0, Number(state.points || 0)),
  streak: Math.max(0, Number(state.streak || 0)),
  lastSeenDate: String(state.lastSeenDate || "").slice(0, 10),
  dailyClaimDate: String(state.dailyClaimDate || "").slice(0, 10),
  weekKey: String(state.weekKey || ""),
  weeklySignal: Math.max(0, Number(state.weeklySignal || 0)),
  visitedPaths: Array.isArray(state.visitedPaths)
    ? state.visitedPaths.filter((value) => typeof value === "string").slice(0, 128)
    : [],
  reactions: {
    fire: Math.max(0, Number(state.reactions?.fire || 0)),
    bolt: Math.max(0, Number(state.reactions?.bolt || 0)),
    hands: Math.max(0, Number(state.reactions?.hands || 0))
  },
  missions: {
    stageMode: Boolean(state.missions?.stageMode),
    watchAndListen: Boolean(state.missions?.watchAndListen),
    innerCircle: Boolean(state.missions?.innerCircle)
  }
});

const mapEngagementRow = (row: any): EngagementState => {
  const reactions = row?.reactions || {};
  const missions = row?.missions || {};
  return normalizeEngagementState({
    points: Number(row?.points || 0),
    streak: Number(row?.streak || 0),
    lastSeenDate: row?.last_seen_date || "",
    dailyClaimDate: row?.daily_claim_date || "",
    weekKey: row?.week_key || "",
    weeklySignal: Number(row?.weekly_signal || 0),
    visitedPaths: Array.isArray(row?.visited_paths) ? row.visited_paths : [],
    reactions: {
      fire: Number(reactions.fire || 0),
      bolt: Number(reactions.bolt || 0),
      hands: Number(reactions.hands || 0)
    },
    missions: {
      stageMode: Boolean(missions.stageMode),
      watchAndListen: Boolean(missions.watchAndListen),
      innerCircle: Boolean(missions.innerCircle)
    }
  });
};

const nowIso = () => new Date().toISOString();

const randomId = () => `vault_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const emitChange = () => {
  window.dispatchEvent(new CustomEvent("fanvault:changed"));
};

const getUsers = () => readJson<LocalVaultUser[]>(USERS_KEY, []);

const setUsers = (users: LocalVaultUser[]) => {
  writeJson(USERS_KEY, users);
  emitChange();
};

const getSessionUserId = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_KEY) || "";
};

const getLocalCurrentUser = (): VaultUser | null => {
  const sessionId = getSessionUserId();
  if (!sessionId) return null;
  const user = getUsers().find((entry) => entry.id === sessionId);
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
};

const localRegisterUser = (name: string, email: string, password: string): Result<{ user: VaultUser }> => {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail || !password) {
    return { ok: false, error: "All fields are required." };
  }

  const users = getUsers();
  if (users.some((user) => user.email === cleanEmail)) {
    return { ok: false, error: "Email is already registered on this device." };
  }

  const user: LocalVaultUser = {
    id: randomId(),
    name: cleanName,
    email: cleanEmail,
    password,
    createdAt: nowIso(),
    bio: "",
    profileBadgeId: defaultProfileBadgeId,
    favorites: []
  };

  const nextUsers = [...users, user];
  setUsers(nextUsers);
  localStorage.setItem(SESSION_KEY, user.id);
  emitChange();

  const { password: _password, ...rest } = user;
  return { ok: true, user: rest };
};

const localLoginUser = (email: string, password: string): Result<{ user: VaultUser }> => {
  const cleanEmail = email.trim().toLowerCase();
  const user = getUsers().find((entry) => entry.email === cleanEmail && entry.password === password);
  if (!user) return { ok: false, error: "Invalid email or password." };
  localStorage.setItem(SESSION_KEY, user.id);
  emitChange();
  const { password: _password, ...rest } = user;
  return { ok: true, user: rest };
};

const localLogoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
  emitChange();
};

const localUpdateCurrentUserProfile = (patch: Partial<Pick<VaultUser, "name" | "bio" | "profileBadgeId">>) => {
  const current = getLocalCurrentUser();
  if (!current) return null;
  const users = getUsers();
  const nextUsers = users.map((user) =>
    user.id === current.id
      ? {
          ...user,
          name: patch.name?.trim() ? patch.name.trim() : user.name,
          bio: typeof patch.bio === "string" ? patch.bio : user.bio,
          profileBadgeId: typeof patch.profileBadgeId === "string" ? patch.profileBadgeId : user.profileBadgeId
        }
      : user
  );
  setUsers(nextUsers);
  const next = nextUsers.find((entry) => entry.id === current.id) || null;
  if (!next) return null;
  const { password: _password, ...rest } = next;
  return rest;
};

const localToggleFavorite = (item: Omit<FavoriteRecord, "savedAt">): Result<{ favorited: boolean }> => {
  const current = getLocalCurrentUser();
  if (!current) return { ok: false, error: "Please register or log in to save favorites." };

  const users = getUsers();
  const nextUsers = users.map((user) => {
    if (user.id !== current.id) return user;
    const exists = user.favorites.some((fav) => fav.type === item.type && fav.id === item.id);
    const favorites = exists
      ? user.favorites.filter((fav) => !(fav.type === item.type && fav.id === item.id))
      : [{ ...item, savedAt: nowIso() }, ...user.favorites];
    return { ...user, favorites };
  });
  setUsers(nextUsers);
  const nextUser = nextUsers.find((user) => user.id === current.id)!;
  const favorited = nextUser.favorites.some((fav) => fav.type === item.type && fav.id === item.id);
  return { ok: true, favorited };
};

const getLocalAllFavorites = () => {
  const current = getLocalCurrentUser();
  if (!current) return [];
  return current.favorites;
};

const getLocalVaultBadges = () => readJson<VaultBadge[]>(BADGES_KEY, []);

const mapCloudFavorite = (row: any): FavoriteRecord => ({
  type: row.type,
  id: row.item_id,
  title: row.title,
  href: row.href,
  image: row.image || undefined,
  savedAt: row.saved_at || nowIso()
});

const ensureCloudProfile = async (userId: string, email: string, fallbackName = "Fan") => {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.from("fan_profiles").select("id,name,bio,created_at").eq("id", userId).maybeSingle();
  if (data) return;
  await supabase.from("fan_profiles").insert({
    id: userId,
    email,
    name: fallbackName,
    bio: ""
  });
};

const migrateLegacyLocalToCloud = async (cloudUserId: string, cloudEmail: string) => {
  const supabase = getSupabase();
  if (!supabase) return;

  const legacyUsers = getUsers();
  const sessionId = getSessionUserId();
  const legacy = legacyUsers.find((entry) => entry.id === sessionId) || legacyUsers.find((entry) => entry.email === cloudEmail.toLowerCase());
  if (!legacy) return;

  await supabase.from("fan_profiles").upsert({
    id: cloudUserId,
    email: cloudEmail,
    name: legacy.name,
    bio: legacy.bio || ""
  });

  if (legacy.profileBadgeId) {
    await supabase.auth.updateUser({
      data: {
        profileBadgeId: legacy.profileBadgeId
      }
    });
  }

  if (legacy.favorites.length) {
    await supabase.from("fan_favorites").upsert(
      legacy.favorites.map((fav) => ({
        user_id: cloudUserId,
        type: fav.type,
        item_id: fav.id,
        title: fav.title,
        href: fav.href,
        image: fav.image || null,
        saved_at: fav.savedAt
      })),
      { onConflict: "user_id,type,item_id" }
    );
  }

  await syncCloudBadgesFromLocal(cloudUserId);
};

const getCloudUserAndProfile = async (): Promise<VaultUser | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return null;
  const resolvedEmail = resolveAuthEmail(authUser);

  await ensureCloudProfile(authUser.id, resolvedEmail, (authUser.user_metadata?.name as string) || "Fan");

  const [{ data: profile }, { data: favorites }] = await Promise.all([
    supabase.from("fan_profiles").select("id,name,email,bio,created_at").eq("id", authUser.id).maybeSingle(),
    supabase.from("fan_favorites").select("type,item_id,title,href,image,saved_at").eq("user_id", authUser.id).order("saved_at", { ascending: false })
  ]);

  return {
    id: authUser.id,
    name: profile?.name || (authUser.user_metadata?.name as string) || "Fan",
    email: profile?.email || resolvedEmail,
    createdAt: profile?.created_at || authUser.created_at || nowIso(),
    bio: profile?.bio || "",
    profileBadgeId: (authUser.user_metadata?.profileBadgeId as string) || defaultProfileBadgeId,
    favorites: (favorites || []).map(mapCloudFavorite)
  };
};

export const completeOAuthFromUrl = async (): Promise<Result<{ completed: boolean }>> => {
  if (!isCloudVaultEnabled) return { ok: true, completed: false };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  if (typeof window === "undefined") return { ok: true, completed: false };

  const authError = parseAuthErrorFromUrl();
  if (authError) {
    stripAuthParamsFromUrl();
    return { ok: false, error: authError };
  }

  const urlNow = new URL(window.location.href);
  const code = urlNow.searchParams.get("code");
  if (!code) return { ok: true, completed: false };

  const { data: existingSession } = await supabase.auth.getSession();
  if (existingSession.session) {
    stripAuthParamsFromUrl();
    emitChange();
    return { ok: true, completed: true };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  stripAuthParamsFromUrl();
  if (error) return { ok: false, error: error.message };

  const user = await getCloudUserAndProfile();
  if (user) {
    await migrateLegacyLocalToCloud(user.id, user.email);
  }
  emitChange();
  return { ok: true, completed: true };
};

export const getCurrentUser = async (): Promise<VaultUser | null> => {
  if (!isCloudVaultEnabled) return getLocalCurrentUser();
  return getCloudUserAndProfile();
};

export const registerUser = async (name: string, email: string, password: string): Promise<Result<{ user: VaultUser; requiresConfirm?: boolean }>> => {
  if (!isCloudVaultEnabled) return localRegisterUser(name, email, password);

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail || !password) {
    return { ok: false, error: "All fields are required." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { name: cleanName, profileBadgeId: defaultProfileBadgeId }
    }
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Signup failed. Try again." };

  await ensureCloudProfile(data.user.id, cleanEmail, cleanName);
  await migrateLegacyLocalToCloud(data.user.id, cleanEmail);

  if (!data.session) {
    emitChange();
    return {
      ok: true,
      requiresConfirm: true,
      user: {
        id: data.user.id,
        name: cleanName,
        email: cleanEmail,
        createdAt: data.user.created_at || nowIso(),
        bio: "",
        profileBadgeId: defaultProfileBadgeId,
        favorites: []
      }
    };
  }

  const user = await getCloudUserAndProfile();
  emitChange();
  return { ok: true, user: user! };
};

export const loginUser = async (email: string, password: string): Promise<Result<{ user: VaultUser }>> => {
  if (!isCloudVaultEnabled) return localLoginUser(email, password);
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) return { ok: false, error: error.message };

  const user = await getCloudUserAndProfile();
  if (!user) return { ok: false, error: "Could not load your profile." };

  await migrateLegacyLocalToCloud(user.id, user.email);
  emitChange();
  return { ok: true, user };
};

export const loginWithOAuth = async (provider: OAuthProvider): Promise<Result<{ redirected: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Cloud auth is not configured." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };

  const redirectTo =
    typeof window !== "undefined"
      ? new URL("/fan-club", window.location.origin).toString()
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, redirected: true };
};

export const logoutUser = async () => {
  if (!isCloudVaultEnabled) {
    localLogoutUser();
    return;
  }
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
  emitChange();
};

export const updateCurrentUserProfile = async (patch: Partial<Pick<VaultUser, "name" | "bio" | "profileBadgeId">>) => {
  if (!isCloudVaultEnabled) return localUpdateCurrentUserProfile(patch);

  const supabase = getSupabase();
  if (!supabase) return null;
  const current = await getCloudUserAndProfile();
  if (!current) return null;

  await supabase.from("fan_profiles").upsert({
    id: current.id,
    email: current.email,
    name: patch.name?.trim() ? patch.name.trim() : current.name,
    bio: typeof patch.bio === "string" ? patch.bio : current.bio
  });

  if (typeof patch.profileBadgeId === "string") {
    await supabase.auth.updateUser({
      data: {
        profileBadgeId: patch.profileBadgeId
      }
    });
  }

  const updated = await getCloudUserAndProfile();
  emitChange();
  return updated;
};

export const isFavorite = async (type: FavoriteType, id: string) => {
  if (!isCloudVaultEnabled) {
    const current = getLocalCurrentUser();
    if (!current) return false;
    return current.favorites.some((item) => item.type === type && item.id === id);
  }

  const supabase = getSupabase();
  if (!supabase) return false;
  const current = await getCloudUserAndProfile();
  if (!current) return false;

  const { data } = await supabase
    .from("fan_favorites")
    .select("item_id")
    .eq("user_id", current.id)
    .eq("type", type)
    .eq("item_id", id)
    .maybeSingle();

  return Boolean(data);
};

export const toggleFavorite = async (item: Omit<FavoriteRecord, "savedAt">): Promise<Result<{ favorited: boolean }>> => {
  if (!isCloudVaultEnabled) return localToggleFavorite(item);

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const current = await getCloudUserAndProfile();
  if (!current) return { ok: false, error: "Please register or log in to save favorites." };

  const { data: existing } = await supabase
    .from("fan_favorites")
    .select("item_id")
    .eq("user_id", current.id)
    .eq("type", item.type)
    .eq("item_id", item.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("fan_favorites")
      .delete()
      .eq("user_id", current.id)
      .eq("type", item.type)
      .eq("item_id", item.id);
    emitChange();
    return { ok: true, favorited: false };
  }

  await supabase.from("fan_favorites").upsert(
    {
      user_id: current.id,
      type: item.type,
      item_id: item.id,
      title: item.title,
      href: item.href,
      image: item.image || null,
      saved_at: nowIso()
    },
    { onConflict: "user_id,type,item_id" }
  );

  emitChange();
  return { ok: true, favorited: true };
};

export const getFavoritesByType = async (type: FavoriteType) => {
  const all = await getAllFavorites();
  return all.filter((item) => item.type === type);
};

export const getAllFavorites = async () => {
  if (!isCloudVaultEnabled) return getLocalAllFavorites();
  const current = await getCloudUserAndProfile();
  if (!current) return [];
  return current.favorites;
};

export const syncCloudBadgesFromLocal = async (userId?: string) => {
  if (!isCloudVaultEnabled) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const localBadges = getLocalVaultBadges();
  if (!localBadges.length) return;

  let targetUserId = userId;
  if (!targetUserId) {
    const current = await getCloudUserAndProfile();
    targetUserId = current?.id;
  }
  if (!targetUserId) return;

  await supabase.from("fan_badges").upsert(
    localBadges.map((badge) => ({
      user_id: targetUserId,
      badge_id: badge.id,
      label: badge.label,
      tier: badge.tier || null,
      tip: badge.tip || null,
      updated_at: nowIso()
    })),
    { onConflict: "user_id,badge_id" }
  );
};

export const getVaultBadges = async () => {
  if (!isCloudVaultEnabled) return getLocalVaultBadges();

  const supabase = getSupabase();
  if (!supabase) return [];
  const current = await getCloudUserAndProfile();
  if (!current) return [];

  await syncCloudBadgesFromLocal(current.id);

  const { data } = await supabase
    .from("fan_badges")
    .select("badge_id,label,tier,tip")
    .eq("user_id", current.id)
    .order("updated_at", { ascending: false });

  return (data || []).map((badge: any) => ({
    id: badge.badge_id,
    label: badge.label,
    tier: badge.tier || undefined,
    tip: badge.tip || undefined
  }));
};

const defaultEngagementState = (): EngagementState => ({
  points: 120,
  streak: 1,
  lastSeenDate: new Date().toISOString().slice(0, 10),
  dailyClaimDate: "",
  weekKey: "",
  weeklySignal: 0,
  visitedPaths: [],
  reactions: { fire: 0, bolt: 0, hands: 0 },
  missions: {
    stageMode: false,
    watchAndListen: false,
    innerCircle: false
  }
});

export const getEngagementProfile = async (): Promise<EngagementState | null> => {
  if (!isCloudVaultEnabled) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const current = await getCloudUserAndProfile();
  if (!current) return null;

  const { data } = await supabase
    .from("fan_engagement_profiles")
    .select("points,streak,last_seen_date,daily_claim_date,week_key,weekly_signal,visited_paths,reactions,missions")
    .eq("user_id", current.id)
    .maybeSingle();

  if (!data) return null;
  return mapEngagementRow(data);
};

export const upsertEngagementProfile = async (state: EngagementState): Promise<boolean> => {
  if (!isCloudVaultEnabled) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const current = await getCloudUserAndProfile();
  if (!current) return false;

  const normalized = normalizeEngagementState(state);
  const { error } = await supabase.from("fan_engagement_profiles").upsert(
    {
      user_id: current.id,
      display_name: current.name || "Fan",
      points: normalized.points,
      streak: normalized.streak,
      last_seen_date: normalized.lastSeenDate || null,
      daily_claim_date: normalized.dailyClaimDate || null,
      week_key: normalized.weekKey,
      weekly_signal: normalized.weeklySignal,
      visited_paths: normalized.visitedPaths,
      reactions: normalized.reactions,
      missions: normalized.missions,
      updated_at: nowIso()
    },
    { onConflict: "user_id" }
  );

  return !error;
};

export const ensureEngagementProfile = async (): Promise<EngagementState | null> => {
  const existing = await getEngagementProfile();
  if (existing) return existing;

  const base = defaultEngagementState();
  const saved = await upsertEngagementProfile(base);
  if (!saved) return null;
  return base;
};

export const getEngagementLeaderboard = async (limit = 10): Promise<EngagementLeaderboardEntry[]> => {
  if (!isCloudVaultEnabled) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("fan_engagement_profiles")
    .select("user_id,display_name,points,streak,weekly_signal,updated_at")
    .limit(Math.max(1, Math.min(50, limit)));

  return (data || [])
    .map((row: any) => ({
    userId: row.user_id,
    displayName: row.display_name || "Fan",
    points: Number(row.points || 0),
    streak: Number(row.streak || 0),
    weeklySignal: Number(row.weekly_signal || 0),
    score: Number(row.points || 0) + Number(row.weekly_signal || 0) + Number(row.streak || 0) * 17,
    updatedAt: row.updated_at || nowIso()
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(50, limit)));
};

export const subscribeToEngagementLeaderboard = (onChange: () => void): (() => void) | null => {
  if (!isCloudVaultEnabled) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const channel = supabase
    .channel("fan-engagement-leaderboard")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fan_engagement_profiles" },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

const mapFeedComment = (row: any, names: Map<string, string>): FanFeedComment => ({
  id: String(row.id),
  postId: String(row.post_id),
  userId: row.user_id,
  authorName: names.get(row.user_id) || "Fan",
  body: row.body || "",
  moderationStatus: (row.moderation_status as FeedModerationStatus) || "approved",
  moderationReason: row.moderation_reason || null,
  createdAt: row.created_at || nowIso()
});

const mapFeedPost = (
  row: any,
  names: Map<string, string>,
  comments: FanFeedComment[],
  likeCount: number,
  viewerHasLiked: boolean,
  poll: FanFeedPoll | null
): FanFeedPost => ({
  id: String(row.id),
  userId: row.user_id,
  authorName: names.get(row.user_id) || "Fan",
  body: row.body || "",
  mediaUrl: row.media_url || null,
  mediaType: (row.media_type as FanFeedMediaType | null) || null,
  moderationStatus: (row.moderation_status as FeedModerationStatus) || "approved",
  moderationReason: row.moderation_reason || null,
  isNsfw: Boolean(row.is_nsfw),
  shareCount: Number(row.share_count || 0),
  likeCount,
  viewerHasLiked,
  poll,
  comments,
  createdAt: row.created_at || nowIso(),
  updatedAt: row.updated_at || row.created_at || nowIso()
});

const sanitizeExternalUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findBlockedTerm = (value: string): string | null => {
  const lowered = value.toLowerCase();
  for (const term of FEED_BLOCKED_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`, "i");
    if (pattern.test(lowered)) return term;
  }
  return null;
};

const getModerationEndpoint = () => {
  const endpoint = import.meta.env.PUBLIC_FEED_MODERATION_ENDPOINT;
  if (!endpoint || typeof endpoint !== "string") return "";
  const trimmed = endpoint.trim();
  const safe = sanitizeExternalUrl(trimmed);
  return safe || "";
};

const runRemoteModerationHook = async (payload: {
  type: FeedReportTargetType;
  body: string;
  mediaUrl?: string | null;
  userId: string;
}): Promise<{ status: FeedModerationStatus; reason: string | null } | null> => {
  const endpoint = getModerationEndpoint();
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    const json = await response.json();
    const status = (json?.status as FeedModerationStatus) || "pending";
    const reason = typeof json?.reason === "string" ? json.reason : null;
    if (!["pending", "approved", "rejected", "flagged"].includes(status)) return null;
    return { status, reason };
  } catch {
    return null;
  }
};

const isFeedModerationEnabled = async (): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("fan_feed_settings")
    .select("moderation_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.moderation_enabled);
};

export const getFeedModerationEnabled = async (): Promise<Result<{ enabled: boolean }>> => {
  if (!isCloudVaultEnabled) return { ok: true, enabled: false };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const enabled = await isFeedModerationEnabled();
  return { ok: true, enabled };
};

export const setFeedModerationEnabled = async (enabled: boolean): Promise<Result<{ enabled: boolean }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const { error } = await supabase.from("fan_feed_settings").upsert({
    id: 1,
    moderation_enabled: Boolean(enabled),
    updated_by: viewer.id,
    updated_at: nowIso()
  });
  if (error) return { ok: false, error: error.message };

  if (!enabled) {
    const approvePosts = await supabase
      .from("fan_feed_posts")
      .update({ moderation_status: "approved", moderation_reason: null })
      .eq("moderation_status", "pending");
    if (approvePosts.error && !hasMissingColumnError(approvePosts.error, "moderation_status")) {
      return { ok: false, error: approvePosts.error.message };
    }

    const approveComments = await supabase
      .from("fan_feed_comments")
      .update({ moderation_status: "approved", moderation_reason: null })
      .eq("moderation_status", "pending");
    if (approveComments.error && !hasMissingColumnError(approveComments.error, "moderation_status")) {
      return { ok: false, error: approveComments.error.message };
    }
  }

  return { ok: true, enabled: Boolean(enabled) };
};

const detectImageMimeByHeader = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) {
    return "image/avif";
  }
  return null;
};

const extByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif"
};

const hasMissingColumnError = (error: unknown, column: string) => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const target = column.toLowerCase();
  const schemaCacheMissing = message.includes("schema cache") && message.includes("column") && message.includes(target);
  const postgresMissing = message.includes("column") && message.includes("does not exist") && message.includes(target);
  return schemaCacheMissing || postgresMissing;
};

const hasMissingRelationError = (error: unknown, relation: string) => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const target = relation.toLowerCase();
  const bare = target.replace("public.", "");
  const postgresMissing = message.includes("relation") && message.includes("does not exist") && message.includes(target);
  const schemaCacheMissing = message.includes("could not find the table") && (message.includes(bare) || message.includes(target));
  const schemaCacheMissingAlt =
    message.includes("schema cache") &&
    message.includes("table") &&
    (message.includes(bare) || message.includes(target));
  return postgresMissing || schemaCacheMissing || schemaCacheMissingAlt;
};

const normalizeTriviaLookAndFeel = (value: unknown): TriviaLookAndFeel => {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const tone = String(raw.cardTone || "").toLowerCase();
  const cardTone: TriviaLookAndFeel["cardTone"] =
    tone === "ember" || tone === "gold" || tone === "cyan" || tone === "neutral" ? (tone as any) : undefined;
  const accentColor = typeof raw.accentColor === "string" ? raw.accentColor.slice(0, 32) : undefined;
  const label = typeof raw.label === "string" ? raw.label.slice(0, 64) : undefined;
  return {
    accentColor,
    label,
    cardTone
  };
};

export const getFanFeed = async (limit = 30): Promise<Result<{ posts: FanFeedPost[] }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to view the feed." };

  let { data: postRows, error: postsError } = await supabase
    .from("fan_feed_posts")
    .select("id,user_id,body,media_url,media_type,moderation_status,moderation_reason,is_nsfw,share_count,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  const postSelectMissingModerationCols =
    postsError &&
    (hasMissingColumnError(postsError, "is_nsfw") ||
      hasMissingColumnError(postsError, "moderation_status") ||
      hasMissingColumnError(postsError, "moderation_reason"));

  if (postSelectMissingModerationCols) {
    const fallback = await supabase
      .from("fan_feed_posts")
      .select("id,user_id,body,media_url,media_type,share_count,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));
    postRows = fallback.data as any[] | null;
    postsError = fallback.error;
  }

  if (postsError) return { ok: false, error: postsError.message };
  const posts = postRows || [];
  if (!posts.length) return { ok: true, posts: [] };

  const postIds = posts.map((row: any) => Number(row.id));
  const userIds = Array.from(new Set(posts.map((row: any) => row.user_id)));

  const [{ data: profileRows }, { data: likeRows }] = await Promise.all([
    supabase.from("fan_profiles").select("id,name").in("id", userIds),
    supabase.from("fan_feed_likes").select("post_id,user_id").in("post_id", postIds)
  ]);

  let { data: commentRows, error: commentsError } = await supabase
    .from("fan_feed_comments")
    .select("id,post_id,user_id,body,moderation_status,moderation_reason,created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (commentsError && (hasMissingColumnError(commentsError, "moderation_status") || hasMissingColumnError(commentsError, "moderation_reason"))) {
    const fallbackComments = await supabase
      .from("fan_feed_comments")
      .select("id,post_id,user_id,body,created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    commentRows = fallbackComments.data as any[] | null;
    commentsError = fallbackComments.error;
  }

  if (commentsError) return { ok: false, error: commentsError.message };

  const commentUserIds = Array.from(new Set((commentRows || []).map((row: any) => row.user_id)));
  const missingCommentUserIds = commentUserIds.filter((id) => !userIds.includes(id));
  let commentProfileRows: Array<{ id: string; name: string }> = [];
  if (missingCommentUserIds.length) {
    const { data } = await supabase.from("fan_profiles").select("id,name").in("id", missingCommentUserIds);
    commentProfileRows = (data || []) as Array<{ id: string; name: string }>;
  }

  const nameMap = new Map<string, string>();
  (profileRows || []).forEach((row: any) => nameMap.set(row.id, row.name || "Fan"));
  commentProfileRows.forEach((row) => nameMap.set(row.id, row.name || "Fan"));

  const commentsByPost = new Map<string, FanFeedComment[]>();
  (commentRows || []).forEach((row: any) => {
    const key = String(row.post_id);
    const list = commentsByPost.get(key) || [];
    list.push(mapFeedComment(row, nameMap));
    commentsByPost.set(key, list);
  });

  const likeCountByPost = new Map<string, number>();
  const viewerLikeSet = new Set<string>();
  (likeRows || []).forEach((row: any) => {
    const key = String(row.post_id);
    likeCountByPost.set(key, (likeCountByPost.get(key) || 0) + 1);
    if (row.user_id === viewer.id) viewerLikeSet.add(key);
  });

  const pollByPost = new Map<string, FanFeedPoll>();
  let pollRows: any[] = [];
  const pollRes = await supabase
    .from("fan_feed_polls")
    .select("post_id,question,allow_multiple,expires_at")
    .in("post_id", postIds);
  if (!pollRes.error) {
    pollRows = pollRes.data || [];
  } else if (!hasMissingRelationError(pollRes.error, "fan_feed_polls")) {
    return { ok: false, error: pollRes.error.message };
  }

  if (pollRows.length) {
    const pollPostIds = pollRows.map((row) => Number(row.post_id));
    const [optionRes, voteRes] = await Promise.all([
      supabase
        .from("fan_feed_poll_options")
        .select("id,poll_post_id,label,image_url,position")
        .in("poll_post_id", pollPostIds)
        .order("position", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("fan_feed_poll_votes")
        .select("poll_post_id,option_id,user_id")
        .in("poll_post_id", pollPostIds)
    ]);

    if (optionRes.error && !hasMissingRelationError(optionRes.error, "fan_feed_poll_options")) {
      return { ok: false, error: optionRes.error.message };
    }
    if (voteRes.error && !hasMissingRelationError(voteRes.error, "fan_feed_poll_votes")) {
      return { ok: false, error: voteRes.error.message };
    }

    const optionRows = optionRes.data || [];
    const voteRows = voteRes.data || [];
    const voteCountByOption = new Map<string, number>();
    const viewerVotes = new Set<string>();
    const totalVotesByPoll = new Map<string, number>();
    const viewerHasVotedByPoll = new Set<string>();

    voteRows.forEach((row: any) => {
      const optionKey = String(row.option_id);
      const pollKey = String(row.poll_post_id);
      voteCountByOption.set(optionKey, (voteCountByOption.get(optionKey) || 0) + 1);
      totalVotesByPoll.set(pollKey, (totalVotesByPoll.get(pollKey) || 0) + 1);
      if (row.user_id === viewer.id) {
        viewerVotes.add(optionKey);
        viewerHasVotedByPoll.add(pollKey);
      }
    });

    const optionsByPoll = new Map<string, FanFeedPollOption[]>();
    optionRows.forEach((row: any) => {
      const pollKey = String(row.poll_post_id);
      const list = optionsByPoll.get(pollKey) || [];
      list.push({
        id: String(row.id),
        label: String(row.label || ""),
        imageUrl: row.image_url || null,
        position: Number(row.position || 0),
        voteCount: voteCountByOption.get(String(row.id)) || 0,
        viewerVoted: viewerVotes.has(String(row.id))
      });
      optionsByPoll.set(pollKey, list);
    });

    pollRows.forEach((row: any) => {
      const key = String(row.post_id);
      pollByPost.set(key, {
        question: String(row.question || ""),
        allowMultiple: Boolean(row.allow_multiple),
        expiresAt: row.expires_at || null,
        totalVotes: totalVotesByPoll.get(key) || 0,
        viewerHasVoted: viewerHasVotedByPoll.has(key),
        options: optionsByPoll.get(key) || []
      });
    });
  }

  return {
    ok: true,
    posts: posts.map((row: any) =>
      mapFeedPost(
        row,
        nameMap,
        commentsByPost.get(String(row.id)) || [],
        likeCountByPost.get(String(row.id)) || 0,
        viewerLikeSet.has(String(row.id)),
        pollByPost.get(String(row.id)) || null
      )
    )
  };
};

export const createFeedPost = async (input: {
  body: string;
  mediaUrl?: string | null;
  mediaType?: FanFeedMediaType | null;
  poll?: {
    question: string;
    allowMultiple?: boolean;
    expiresAt?: string | null;
    options: Array<{ label: string; imageUrl?: string | null }>;
  };
}): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to publish posts." };

  const body = (input.body || "").trim();
  const pollInput = input.poll || null;
  const rawMediaUrl = (input.mediaUrl || "").trim();
  if (!body && !rawMediaUrl && !pollInput) return { ok: false, error: "Add text, a media link, or a poll to publish." };
  if (body.length > FEED_MAX_POST_BODY_LEN) {
    return { ok: false, error: `Post is too long. Max ${FEED_MAX_POST_BODY_LEN} characters.` };
  }
  if (rawMediaUrl.length > FEED_MAX_MEDIA_URL_LEN) {
    return { ok: false, error: `Media URL is too long. Max ${FEED_MAX_MEDIA_URL_LEN} characters.` };
  }

  const mediaUrl = rawMediaUrl ? sanitizeExternalUrl(rawMediaUrl) : null;
  if (rawMediaUrl && !mediaUrl) {
    return { ok: false, error: "Media URL must start with http:// or https://." };
  }
  if (input.mediaType && !["image", "video", "link"].includes(input.mediaType)) {
    return { ok: false, error: "Invalid media type." };
  }

  let normalizedPoll:
    | {
        question: string;
        allowMultiple: boolean;
        expiresAt: string | null;
        options: Array<{ label: string; imageUrl: string | null; position: number }>;
      }
    | null = null;

  if (pollInput) {
    const question = String(pollInput.question || "").trim();
    if (!question) return { ok: false, error: "Poll question is required." };
    if (question.length > FEED_MAX_POLL_QUESTION_LEN) {
      return { ok: false, error: `Poll question is too long. Max ${FEED_MAX_POLL_QUESTION_LEN} characters.` };
    }
    const blockedQuestion = findBlockedTerm(question);
    if (blockedQuestion) return { ok: false, error: "Poll question blocked by community safety filter." };

    const optionCandidates = Array.isArray(pollInput.options) ? pollInput.options : [];
    const options = optionCandidates
      .map((option, index) => ({
        label: String(option?.label || "").trim(),
        imageUrlRaw: String(option?.imageUrl || "").trim(),
        position: index
      }))
      .filter((option) => option.label.length > 0);

    if (options.length < FEED_MIN_POLL_OPTIONS || options.length > FEED_MAX_POLL_OPTIONS) {
      return { ok: false, error: `Poll must have ${FEED_MIN_POLL_OPTIONS}-${FEED_MAX_POLL_OPTIONS} options.` };
    }

    for (const option of options) {
      if (option.label.length > FEED_MAX_POLL_OPTION_LEN) {
        return { ok: false, error: `Poll option is too long. Max ${FEED_MAX_POLL_OPTION_LEN} characters.` };
      }
      const blockedOption = findBlockedTerm(option.label);
      if (blockedOption) return { ok: false, error: "Poll option blocked by community safety filter." };
    }

    const normalizedOptions: Array<{ label: string; imageUrl: string | null; position: number }> = [];
    for (const option of options) {
      const safeImageUrl = option.imageUrlRaw ? sanitizeExternalUrl(option.imageUrlRaw) : null;
      if (option.imageUrlRaw && !safeImageUrl) {
        return { ok: false, error: "Poll option image URL must start with http:// or https://." };
      }
      normalizedOptions.push({
        label: option.label,
        imageUrl: safeImageUrl,
        position: option.position
      });
    }

    let expiresAt: string | null = null;
    if (pollInput.expiresAt) {
      const parsed = Date.parse(String(pollInput.expiresAt));
      if (Number.isNaN(parsed)) return { ok: false, error: "Invalid poll end date." };
      if (parsed <= Date.now()) return { ok: false, error: "Poll end date must be in the future." };
      expiresAt = new Date(parsed).toISOString();
    }

    normalizedPoll = {
      question,
      allowMultiple: Boolean(pollInput.allowMultiple),
      expiresAt,
      options: normalizedOptions
    };
  }

  const blocked = findBlockedTerm(body);
  if (blocked) {
    return { ok: false, error: "Post blocked by community safety filter." };
  }

  let moderationStatus: FeedModerationStatus = "approved";
  let moderationReason: string | null = null;
  const moderationEnabled = await isFeedModerationEnabled();
  if (moderationEnabled) {
    const remoteModeration = await runRemoteModerationHook({
      type: "post",
      body,
      mediaUrl,
      userId: viewer.id
    });
    if (remoteModeration) {
      moderationReason = remoteModeration.reason;
      if (remoteModeration.status === "rejected") moderationStatus = "rejected";
      else moderationStatus = remoteModeration.status;
    } else {
      moderationStatus = "pending";
    }
    if (moderationStatus === "rejected") {
      return { ok: false, error: moderationReason || "Post rejected by moderation policy." };
    }
  }

  const insertPayload = {
    user_id: viewer.id,
    body,
    media_url: mediaUrl || null,
    media_type: input.mediaType || (mediaUrl ? "link" : null),
    moderation_status: moderationStatus,
    moderation_reason: moderationReason,
    is_nsfw: false,
    share_count: 0
  };

  const insertPostWithPayload = async (payload: typeof insertPayload) => {
    const inserted = await supabase.from("fan_feed_posts").insert(payload).select("id").single();
    return inserted;
  };

  let createdPostId: number | null = null;
  let error: any = null;
  const inserted = await insertPostWithPayload(insertPayload);
  error = inserted.error;
  if (!error) createdPostId = Number(inserted.data?.id);

  if (error) {
    const isRlsError =
      error.code === "42501" ||
      /row-level security/i.test(error.message || "") ||
      /policy/i.test(error.message || "");

    if (isRlsError) {
      // Compatibility path for earlier policies that only allow pending inserts.
      const pendingInsert = await insertPostWithPayload({
        ...insertPayload,
        moderation_status: "pending",
        moderation_reason: null
      });
      if (!pendingInsert.error) {
        createdPostId = Number(pendingInsert.data?.id);
      } else {
        error = pendingInsert.error;
      }
    }

    const missingModerationCols =
      hasMissingColumnError(error, "is_nsfw") ||
      hasMissingColumnError(error, "moderation_status") ||
      hasMissingColumnError(error, "moderation_reason");

    if (!missingModerationCols) return { ok: false, error: error.message };

    const legacyInsert = await supabase.from("fan_feed_posts").insert({
      user_id: viewer.id,
      body,
      media_url: mediaUrl || null,
      media_type: input.mediaType || (mediaUrl ? "link" : null),
      share_count: 0
    }).select("id").single();
    if (legacyInsert.error) return { ok: false, error: legacyInsert.error.message };
    createdPostId = Number(legacyInsert.data?.id);
  }

  if (normalizedPoll && createdPostId) {
    const pollInsert = await supabase.from("fan_feed_polls").insert({
      post_id: createdPostId,
      question: normalizedPoll.question,
      allow_multiple: normalizedPoll.allowMultiple,
      expires_at: normalizedPoll.expiresAt
    });
    if (pollInsert.error) {
      await supabase.from("fan_feed_posts").delete().eq("id", createdPostId).eq("user_id", viewer.id);
      if (hasMissingRelationError(pollInsert.error, "fan_feed_polls")) {
        return {
          ok: false,
          error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
        };
      }
      return { ok: false, error: pollInsert.error.message };
    }

    const optionInsert = await supabase.from("fan_feed_poll_options").insert(
      normalizedPoll.options.map((option) => ({
        poll_post_id: createdPostId,
        label: option.label,
        image_url: option.imageUrl,
        position: option.position
      }))
    );
    if (optionInsert.error) {
      await supabase.from("fan_feed_posts").delete().eq("id", createdPostId).eq("user_id", viewer.id);
      if (hasMissingRelationError(optionInsert.error, "fan_feed_poll_options")) {
        return {
          ok: false,
          error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
        };
      }
      return { ok: false, error: optionInsert.error.message };
    }
  }

  return { ok: true, created: true };
};

export const voteFeedPoll = async (input: {
  postId: string;
  optionIds: string[];
}): Promise<Result<{ voted: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to vote." };

  const postId = Number(input.postId);
  if (!Number.isFinite(postId)) return { ok: false, error: "Invalid poll id." };
  const uniqueOptionIds = Array.from(new Set((input.optionIds || []).map((id) => Number(id)).filter(Number.isFinite)));
  if (!uniqueOptionIds.length) return { ok: false, error: "Pick at least one option." };

  const { data: pollRow, error: pollError } = await supabase
    .from("fan_feed_polls")
    .select("post_id,allow_multiple,expires_at")
    .eq("post_id", postId)
    .maybeSingle();
  if (pollError) {
    if (hasMissingRelationError(pollError, "fan_feed_polls")) {
      return {
        ok: false,
        error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
      };
    }
    return { ok: false, error: pollError.message };
  }
  if (!pollRow) return { ok: false, error: "Poll not found." };

  if (!pollRow.allow_multiple && uniqueOptionIds.length > 1) {
    return { ok: false, error: "This poll only allows one selection." };
  }
  if (pollRow.expires_at && Date.parse(String(pollRow.expires_at)) <= Date.now()) {
    return { ok: false, error: "This poll has ended." };
  }

  const { data: optionRows, error: optionsError } = await supabase
    .from("fan_feed_poll_options")
    .select("id")
    .eq("poll_post_id", postId)
    .in("id", uniqueOptionIds);
  if (optionsError) {
    if (hasMissingRelationError(optionsError, "fan_feed_poll_options")) {
      return {
        ok: false,
        error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
      };
    }
    return { ok: false, error: optionsError.message };
  }
  if ((optionRows || []).length !== uniqueOptionIds.length) {
    return { ok: false, error: "One or more poll options are invalid." };
  }

  const clearExisting = await supabase
    .from("fan_feed_poll_votes")
    .delete()
    .eq("poll_post_id", postId)
    .eq("user_id", viewer.id);
  if (clearExisting.error) {
    if (hasMissingRelationError(clearExisting.error, "fan_feed_poll_votes")) {
      return {
        ok: false,
        error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
      };
    }
    return { ok: false, error: clearExisting.error.message };
  }

  const insertVotes = await supabase.from("fan_feed_poll_votes").insert(
    uniqueOptionIds.map((optionId) => ({
      poll_post_id: postId,
      option_id: optionId,
      user_id: viewer.id
    }))
  );
  if (insertVotes.error) {
    if (hasMissingRelationError(insertVotes.error, "fan_feed_poll_votes")) {
      return {
        ok: false,
        error: "Poll feature is not fully installed yet. Run the latest fan_vault_schema.sql and reload Supabase schema cache."
      };
    }
    return { ok: false, error: insertVotes.error.message };
  }

  return { ok: true, voted: true };
};

export const updateFeedPost = async (input: {
  postId: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: FanFeedMediaType | null;
}): Promise<Result<{ updated: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to edit posts." };

  const postId = Number(input.postId);
  if (!Number.isFinite(postId)) return { ok: false, error: "Invalid post id." };

  const body = (input.body || "").trim();
  const rawMediaUrl = (input.mediaUrl || "").trim();
  if (!body && !rawMediaUrl) return { ok: false, error: "Post cannot be empty." };
  if (body.length > FEED_MAX_POST_BODY_LEN) {
    return { ok: false, error: `Post is too long. Max ${FEED_MAX_POST_BODY_LEN} characters.` };
  }
  if (rawMediaUrl.length > FEED_MAX_MEDIA_URL_LEN) {
    return { ok: false, error: `Media URL is too long. Max ${FEED_MAX_MEDIA_URL_LEN} characters.` };
  }

  const mediaUrl = rawMediaUrl ? sanitizeExternalUrl(rawMediaUrl) : null;
  if (rawMediaUrl && !mediaUrl) {
    return { ok: false, error: "Media URL must start with http:// or https://." };
  }
  if (input.mediaType && !["image", "video", "link"].includes(input.mediaType)) {
    return { ok: false, error: "Invalid media type." };
  }

  const blocked = findBlockedTerm(body);
  if (blocked) return { ok: false, error: "Post blocked by community safety filter." };

  let moderationStatus: FeedModerationStatus = "approved";
  let moderationReason: string | null = null;
  const moderationEnabled = await isFeedModerationEnabled();
  if (moderationEnabled) {
    const remoteModeration = await runRemoteModerationHook({
      type: "post",
      body,
      mediaUrl,
      userId: viewer.id
    });
    if (remoteModeration) {
      moderationReason = remoteModeration.reason;
      if (remoteModeration.status === "rejected") moderationStatus = "rejected";
      else moderationStatus = remoteModeration.status;
    } else {
      moderationStatus = "pending";
    }
    if (moderationStatus === "rejected") {
      return { ok: false, error: moderationReason || "Post rejected by moderation policy." };
    }
  }

  const { error } = await supabase
    .from("fan_feed_posts")
    .update({
      body,
      media_url: mediaUrl || null,
      media_type: input.mediaType || (mediaUrl ? "link" : null),
      moderation_status: moderationStatus,
      moderation_reason: moderationReason
    })
    .eq("id", postId)
    .eq("user_id", viewer.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: true };
};

export const deleteFeedPost = async (postId: string): Promise<Result<{ deleted: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to delete posts." };

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) return { ok: false, error: "Invalid post id." };

  const { error } = await supabase
    .from("fan_feed_posts")
    .delete()
    .eq("id", numericPostId)
    .eq("user_id", viewer.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: true };
};

export const createFeedComment = async (postId: string, body: string): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to comment." };

  const cleanBody = body.trim();
  if (!cleanBody) return { ok: false, error: "Comment cannot be empty." };
  if (cleanBody.length > FEED_MAX_COMMENT_BODY_LEN) {
    return { ok: false, error: `Comment is too long. Max ${FEED_MAX_COMMENT_BODY_LEN} characters.` };
  }
  const blocked = findBlockedTerm(cleanBody);
  if (blocked) return { ok: false, error: "Comment blocked by community safety filter." };

  let moderationStatus: FeedModerationStatus = "approved";
  let moderationReason: string | null = null;
  const moderationEnabled = await isFeedModerationEnabled();
  if (moderationEnabled) {
    const remoteModeration = await runRemoteModerationHook({
      type: "comment",
      body: cleanBody,
      userId: viewer.id
    });
    if (remoteModeration) {
      moderationReason = remoteModeration.reason;
      if (remoteModeration.status === "rejected") moderationStatus = "rejected";
      else moderationStatus = remoteModeration.status;
    } else {
      moderationStatus = "pending";
    }
    if (moderationStatus === "rejected") {
      return { ok: false, error: moderationReason || "Comment rejected by moderation policy." };
    }
  }

  const insertPayload = {
    post_id: Number(postId),
    user_id: viewer.id,
    body: cleanBody,
    moderation_status: moderationStatus,
    moderation_reason: moderationReason
  };

  const { error } = await supabase.from("fan_feed_comments").insert(insertPayload);

  if (error) {
    const isRlsError =
      error.code === "42501" ||
      /row-level security/i.test(error.message || "") ||
      /policy/i.test(error.message || "");

    if (isRlsError) {
      // Compatibility path for earlier policies that only allow pending inserts.
      const pendingInsert = await supabase.from("fan_feed_comments").insert({
        ...insertPayload,
        moderation_status: "pending",
        moderation_reason: null
      });
      if (!pendingInsert.error) return { ok: true, created: true };
    }

    return { ok: false, error: error.message };
  }
  return { ok: true, created: true };
};

export const toggleFeedLike = async (postId: string): Promise<Result<{ liked: boolean }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to like posts." };

  const post = Number(postId);
  const { data: existing } = await supabase
    .from("fan_feed_likes")
    .select("post_id")
    .eq("post_id", post)
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("fan_feed_likes")
      .delete()
      .eq("post_id", post)
      .eq("user_id", viewer.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, liked: false };
  }

  const { error } = await supabase.from("fan_feed_likes").insert({
    post_id: post,
    user_id: viewer.id
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, liked: true };
};

export const incrementFeedShare = async (postId: string): Promise<Result<{ shared: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to share posts." };

  const post = Number(postId);
  const { data: row, error: readError } = await supabase
    .from("fan_feed_posts")
    .select("id,share_count")
    .eq("id", post)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Post not found." };

  const { error: updateError } = await supabase
    .from("fan_feed_posts")
    .update({ share_count: Number(row.share_count || 0) + 1 })
    .eq("id", post);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, shared: true };
};

export const reportFeedContent = async (input: {
  targetType: FeedReportTargetType;
  targetId: string;
  reasonCode: string;
  details?: string;
}): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Reporting requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to report content." };

  const details = (input.details || "").trim();
  const reasonCode = (input.reasonCode || "").trim().toLowerCase();
  if (!reasonCode) return { ok: false, error: "Select a report reason." };
  if (!["hate", "sexual", "harassment", "violence", "spam", "other"].includes(reasonCode)) {
    return { ok: false, error: "Invalid report reason." };
  }

  const targetType = input.targetType;
  const numericTargetId = Number(input.targetId);
  if (!Number.isFinite(numericTargetId)) return { ok: false, error: "Invalid report target." };

  const { error } = await supabase.from("fan_feed_reports").insert({
    reporter_user_id: viewer.id,
    target_type: targetType,
    target_id: numericTargetId,
    reason_code: reasonCode,
    details: details || null,
    status: "open"
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
};

export const getFeedModerationQueue = async (limit = 100): Promise<Result<{ rows: any[] }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Moderation queue requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const { data, error } = await supabase
    .from("fan_feed_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(250, limit)));

  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: data || [] };
};

export const getFeedModerationReports = async (limit = 100): Promise<Result<{ reports: FeedModerationReport[] }>> => {
  const result = await getFeedModerationQueue(limit);
  if (!result.ok) return result;
  return {
    ok: true,
    reports: (result.rows || []).map((row: any) => ({
      id: Number(row.id),
      reporterUserId: row.reporter_user_id,
      targetType: row.target_type as FeedReportTargetType,
      targetId: String(row.target_id),
      reasonCode: row.reason_code,
      details: row.details || null,
      status: (row.status as FeedReportStatus) || "open",
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      createdAt: row.created_at || nowIso()
    }))
  };
};

export const moderateFeedItem = async (input: {
  targetType: FeedReportTargetType;
  targetId: string;
  status: FeedModerationStatus;
  reason?: string | null;
}): Promise<Result<{ updated: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Moderation update requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const numericTargetId = Number(input.targetId);
  if (!Number.isFinite(numericTargetId)) return { ok: false, error: "Invalid target id." };
  if (!["pending", "approved", "rejected", "flagged"].includes(input.status)) {
    return { ok: false, error: "Invalid moderation status." };
  }

  const table = input.targetType === "post" ? "fan_feed_posts" : "fan_feed_comments";
  const { error } = await supabase
    .from(table)
    .update({
      moderation_status: input.status,
      moderation_reason: input.reason || null,
      moderated_by: viewer.id,
      moderated_at: nowIso()
    })
    .eq("id", numericTargetId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: true };
};

export const updateFeedReportStatus = async (input: {
  reportId: number;
  status: FeedReportStatus;
}): Promise<Result<{ updated: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Moderation update requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };
  if (!["open", "reviewed", "resolved", "dismissed"].includes(input.status)) {
    return { ok: false, error: "Invalid report status." };
  }

  const { error } = await supabase
    .from("fan_feed_reports")
    .update({
      status: input.status,
      reviewed_by: viewer.id,
      reviewed_at: nowIso()
    })
    .eq("id", input.reportId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: true };
};

export const listTriviaQuestions = async (): Promise<Result<{ questions: TriviaQuestion[] }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const { data, error } = await supabase
    .from("fan_feed_trivia_questions")
    .select("id,prompt,options,correct_option_index,category,difficulty,image_url,explanation,is_active,created_by,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    questions: (data || []).map((row: any) => ({
      id: String(row.id),
      prompt: String(row.prompt || ""),
      options: Array.isArray(row.options) ? row.options.map((value: any) => String(value || "")) : [],
      correctOptionIndex: Number(row.correct_option_index || 0),
      category: String(row.category || "general"),
      difficulty: (String(row.difficulty || "medium") as TriviaQuestion["difficulty"]),
      imageUrl: row.image_url || null,
      explanation: row.explanation || null,
      isActive: Boolean(row.is_active),
      createdBy: row.created_by || null,
      createdAt: row.created_at || nowIso(),
      updatedAt: row.updated_at || row.created_at || nowIso()
    }))
  };
};

export const createTriviaQuestion = async (input: {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  imageUrl?: string | null;
  explanation?: string | null;
}): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const prompt = String(input.prompt || "").trim();
  const options = (input.options || []).map((value) => String(value || "").trim()).filter(Boolean);
  const correctOptionIndex = Number(input.correctOptionIndex || 0);
  const category = String(input.category || "general").trim() || "general";
  const difficulty = (String(input.difficulty || "medium").toLowerCase() as TriviaQuestion["difficulty"]);
  const imageUrlRaw = String(input.imageUrl || "").trim();
  const imageUrl = imageUrlRaw ? sanitizeExternalUrl(imageUrlRaw) : null;

  if (!prompt) return { ok: false, error: "Question prompt is required." };
  if (options.length < 2 || options.length > 6) return { ok: false, error: "Provide 2 to 6 options." };
  if (!Number.isFinite(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    return { ok: false, error: "Correct option index is out of range." };
  }
  if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
    return { ok: false, error: "Invalid difficulty." };
  }
  if (imageUrlRaw && !imageUrl) return { ok: false, error: "Image URL must start with http:// or https://." };

  const { error } = await supabase.from("fan_feed_trivia_questions").insert({
    prompt,
    options,
    correct_option_index: correctOptionIndex,
    category,
    difficulty,
    image_url: imageUrl,
    explanation: (input.explanation || null),
    is_active: true,
    created_by: viewer.id
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
};

export const updateTriviaQuestion = async (input: {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  imageUrl?: string | null;
  explanation?: string | null;
  isActive?: boolean;
}): Promise<Result<{ updated: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const options = (input.options || []).map((value) => String(value || "").trim()).filter(Boolean);
  if (options.length < 2 || options.length > 6) return { ok: false, error: "Provide 2 to 6 options." };
  const imageUrlRaw = String(input.imageUrl || "").trim();
  const imageUrl = imageUrlRaw ? sanitizeExternalUrl(imageUrlRaw) : null;
  if (imageUrlRaw && !imageUrl) return { ok: false, error: "Image URL must start with http:// or https://." };

  const { error } = await supabase
    .from("fan_feed_trivia_questions")
    .update({
      prompt: String(input.prompt || "").trim(),
      options,
      correct_option_index: Number(input.correctOptionIndex || 0),
      category: String(input.category || "general").trim() || "general",
      difficulty: String(input.difficulty || "medium").toLowerCase(),
      image_url: imageUrl,
      explanation: input.explanation || null,
      is_active: input.isActive !== undefined ? Boolean(input.isActive) : true,
      updated_at: nowIso()
    })
    .eq("id", Number(input.id));
  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: true };
};

export const listTriviaCampaigns = async (): Promise<Result<{ campaigns: TriviaCampaign[] }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const { data, error } = await supabase
    .from("fan_feed_trivia_campaigns")
    .select("id,title,status,question_ids,schedule_timezone,start_at,end_at,cadence_minutes,post_duration_minutes,next_run_at,last_run_at,look_and_feel,created_by,updated_by,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    campaigns: (data || []).map((row: any) => ({
      id: String(row.id),
      title: String(row.title || ""),
      status: String(row.status || "draft") as TriviaCampaign["status"],
      questionIds: Array.isArray(row.question_ids) ? row.question_ids.map((value: any) => String(value)) : [],
      scheduleTimezone: String(row.schedule_timezone || "UTC"),
      startAt: row.start_at || nowIso(),
      endAt: row.end_at || null,
      cadenceMinutes: Number(row.cadence_minutes || 60),
      postDurationMinutes: Number(row.post_duration_minutes || 10),
      nextRunAt: row.next_run_at || nowIso(),
      lastRunAt: row.last_run_at || null,
      lookAndFeel: normalizeTriviaLookAndFeel(row.look_and_feel),
      createdBy: row.created_by || null,
      updatedBy: row.updated_by || null,
      createdAt: row.created_at || nowIso(),
      updatedAt: row.updated_at || row.created_at || nowIso()
    }))
  };
};

export const createTriviaCampaign = async (input: {
  title: string;
  questionIds: string[];
  startAt: string;
  cadenceMinutes: number;
  postDurationMinutes: number;
  endAt?: string | null;
  lookAndFeel?: TriviaLookAndFeel;
  status?: TriviaCampaign["status"];
}): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const title = String(input.title || "").trim();
  const numericQuestionIds = Array.from(new Set((input.questionIds || []).map((id) => Number(id)).filter(Number.isFinite)));
  if (!title) return { ok: false, error: "Campaign title is required." };
  if (!numericQuestionIds.length) return { ok: false, error: "Select at least one trivia question." };

  const startAtMs = Date.parse(String(input.startAt || ""));
  if (Number.isNaN(startAtMs)) return { ok: false, error: "Invalid campaign start time." };
  const endAtMs = input.endAt ? Date.parse(String(input.endAt)) : NaN;
  if (input.endAt && Number.isNaN(endAtMs)) return { ok: false, error: "Invalid campaign end time." };
  if (input.endAt && endAtMs <= startAtMs) return { ok: false, error: "End time must be after start time." };

  const cadenceMinutes = Math.max(1, Math.min(1440, Number(input.cadenceMinutes || 60)));
  const postDurationMinutes = Math.max(1, Math.min(60, Number(input.postDurationMinutes || 10)));
  const status = (input.status || "draft") as TriviaCampaign["status"];

  const { error } = await supabase.from("fan_feed_trivia_campaigns").insert({
    title,
    status,
    question_ids: numericQuestionIds,
    schedule_timezone: "UTC",
    start_at: new Date(startAtMs).toISOString(),
    end_at: input.endAt ? new Date(endAtMs).toISOString() : null,
    cadence_minutes: cadenceMinutes,
    post_duration_minutes: postDurationMinutes,
    next_run_at: new Date(startAtMs).toISOString(),
    look_and_feel: normalizeTriviaLookAndFeel(input.lookAndFeel),
    created_by: viewer.id,
    updated_by: viewer.id
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
};

export const updateTriviaCampaign = async (input: {
  id: string;
  status?: TriviaCampaign["status"];
  title?: string;
  questionIds?: string[];
  startAt?: string;
  endAt?: string | null;
  cadenceMinutes?: number;
  postDurationMinutes?: number;
  nextRunAt?: string;
  lookAndFeel?: TriviaLookAndFeel;
}): Promise<Result<{ updated: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in required." };

  const patch: Record<string, unknown> = { updated_at: nowIso(), updated_by: viewer.id };
  if (input.status) patch.status = input.status;
  if (input.title !== undefined) patch.title = String(input.title || "").trim();
  if (input.questionIds) patch.question_ids = Array.from(new Set(input.questionIds.map((id) => Number(id)).filter(Number.isFinite)));
  if (input.startAt) {
    const startMs = Date.parse(String(input.startAt));
    if (Number.isNaN(startMs)) return { ok: false, error: "Invalid start time." };
    patch.start_at = new Date(startMs).toISOString();
  }
  if (input.endAt !== undefined) {
    if (!input.endAt) patch.end_at = null;
    else {
      const endMs = Date.parse(String(input.endAt));
      if (Number.isNaN(endMs)) return { ok: false, error: "Invalid end time." };
      patch.end_at = new Date(endMs).toISOString();
    }
  }
  if (input.cadenceMinutes !== undefined) patch.cadence_minutes = Math.max(1, Math.min(1440, Number(input.cadenceMinutes || 60)));
  if (input.postDurationMinutes !== undefined) patch.post_duration_minutes = Math.max(1, Math.min(60, Number(input.postDurationMinutes || 10)));
  if (input.nextRunAt) {
    const nextRunMs = Date.parse(String(input.nextRunAt));
    if (Number.isNaN(nextRunMs)) return { ok: false, error: "Invalid next run time." };
    patch.next_run_at = new Date(nextRunMs).toISOString();
  }
  if (input.lookAndFeel) patch.look_and_feel = normalizeTriviaLookAndFeel(input.lookAndFeel);

  const { error } = await supabase.from("fan_feed_trivia_campaigns").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: true };
};

export const runTriviaCampaignScheduler = async (maxPosts = 8): Promise<Result<{ posted: number }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Trivia requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const { data, error } = await supabase.rpc("run_due_trivia_campaigns", {
    max_posts: Math.max(1, Math.min(50, Number(maxPosts || 8)))
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, posted: Number(data || 0) };
};

export const subscribeToFanFeed = (onChange: () => void): (() => void) | null => {
  if (!isCloudVaultEnabled) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const channel = supabase
    .channel("fan-feed-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_posts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_comments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_likes" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_polls" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_poll_options" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_poll_votes" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_trivia_posts" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const uploadFeedPhoto = async (file: File): Promise<Result<{ url: string }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Photo upload requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to upload photos." };

  if (!file || !file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (!FEED_ALLOWED_IMAGE_MIME.has(file.type)) {
    return { ok: false, error: "Unsupported image format. Use JPG, PNG, WEBP, GIF, or AVIF." };
  }
  if (file.size > FEED_MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is too large. Max 15MB." };
  }

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detectedMime = detectImageMimeByHeader(header);
  if (!detectedMime || !FEED_ALLOWED_IMAGE_MIME.has(detectedMime)) {
    return { ok: false, error: "Image content did not pass validation." };
  }
  if (file.type !== detectedMime) {
    return { ok: false, error: "File type mismatch detected. Re-export and upload again." };
  }

  const ext = extByMime[detectedMime] || "jpg";
  const objectId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${viewer.id}/${objectId}.${ext}`;

  const { error } = await supabase.storage.from(FAN_FEED_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: detectedMime
  });

  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(FAN_FEED_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
};
