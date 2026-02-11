import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

export type FanFeedComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type FanFeedPost = {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  mediaUrl: string | null;
  mediaType: FanFeedMediaType | null;
  shareCount: number;
  likeCount: number;
  viewerHasLiked: boolean;
  comments: FanFeedComment[];
  createdAt: string;
  updatedAt: string;
};

const FAN_FEED_MEDIA_BUCKET = "fan-feed-media";

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
  if (!authUser || !authUser.email) return null;

  await ensureCloudProfile(authUser.id, authUser.email, (authUser.user_metadata?.name as string) || "Fan");

  const [{ data: profile }, { data: favorites }] = await Promise.all([
    supabase.from("fan_profiles").select("id,name,email,bio,created_at").eq("id", authUser.id).maybeSingle(),
    supabase.from("fan_favorites").select("type,item_id,title,href,image,saved_at").eq("user_id", authUser.id).order("saved_at", { ascending: false })
  ]);

  return {
    id: authUser.id,
    name: profile?.name || (authUser.user_metadata?.name as string) || "Fan",
    email: profile?.email || authUser.email,
    createdAt: profile?.created_at || authUser.created_at || nowIso(),
    bio: profile?.bio || "",
    profileBadgeId: (authUser.user_metadata?.profileBadgeId as string) || defaultProfileBadgeId,
    favorites: (favorites || []).map(mapCloudFavorite)
  };
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
      ? new URL(`${import.meta.env.BASE_URL}fan-club/`, window.location.origin).toString()
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
  createdAt: row.created_at || nowIso()
});

const mapFeedPost = (row: any, names: Map<string, string>, comments: FanFeedComment[], likeCount: number, viewerHasLiked: boolean): FanFeedPost => ({
  id: String(row.id),
  userId: row.user_id,
  authorName: names.get(row.user_id) || "Fan",
  body: row.body || "",
  mediaUrl: row.media_url || null,
  mediaType: (row.media_type as FanFeedMediaType | null) || null,
  shareCount: Number(row.share_count || 0),
  likeCount,
  viewerHasLiked,
  comments,
  createdAt: row.created_at || nowIso(),
  updatedAt: row.updated_at || row.created_at || nowIso()
});

export const getFanFeed = async (limit = 30): Promise<Result<{ posts: FanFeedPost[] }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to view the feed." };

  const { data: postRows, error: postsError } = await supabase
    .from("fan_feed_posts")
    .select("id,user_id,body,media_url,media_type,share_count,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (postsError) return { ok: false, error: postsError.message };
  const posts = postRows || [];
  if (!posts.length) return { ok: true, posts: [] };

  const postIds = posts.map((row: any) => Number(row.id));
  const userIds = Array.from(new Set(posts.map((row: any) => row.user_id)));

  const [{ data: profileRows }, { data: commentRows }, { data: likeRows }] = await Promise.all([
    supabase.from("fan_profiles").select("id,name").in("id", userIds),
    supabase
      .from("fan_feed_comments")
      .select("id,post_id,user_id,body,created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    supabase.from("fan_feed_likes").select("post_id,user_id").in("post_id", postIds)
  ]);

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

  return {
    ok: true,
    posts: posts.map((row: any) =>
      mapFeedPost(
        row,
        nameMap,
        commentsByPost.get(String(row.id)) || [],
        likeCountByPost.get(String(row.id)) || 0,
        viewerLikeSet.has(String(row.id))
      )
    )
  };
};

export const createFeedPost = async (input: {
  body: string;
  mediaUrl?: string | null;
  mediaType?: FanFeedMediaType | null;
}): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to publish posts." };

  const body = (input.body || "").trim();
  const mediaUrl = (input.mediaUrl || "").trim();
  if (!body && !mediaUrl) return { ok: false, error: "Add text or a media link to publish." };

  const { error } = await supabase.from("fan_feed_posts").insert({
    user_id: viewer.id,
    body,
    media_url: mediaUrl || null,
    media_type: input.mediaType || (mediaUrl ? "link" : null),
    share_count: 0
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
};

export const createFeedComment = async (postId: string, body: string): Promise<Result<{ created: true }>> => {
  if (!isCloudVaultEnabled) return { ok: false, error: "Fan Feed requires Supabase cloud mode." };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Vault is not configured." };
  const viewer = await getCloudUserAndProfile();
  if (!viewer) return { ok: false, error: "Log in to Fan Vault to comment." };

  const cleanBody = body.trim();
  if (!cleanBody) return { ok: false, error: "Comment cannot be empty." };

  const { error } = await supabase.from("fan_feed_comments").insert({
    post_id: Number(postId),
    user_id: viewer.id,
    body: cleanBody
  });

  if (error) return { ok: false, error: error.message };
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

export const subscribeToFanFeed = (onChange: () => void): (() => void) | null => {
  if (!isCloudVaultEnabled) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const channel = supabase
    .channel("fan-feed-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_posts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_comments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "fan_feed_likes" }, onChange)
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
  if (file.size > 15 * 1024 * 1024) {
    return { ok: false, error: "Image is too large. Max 15MB." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const path = `${viewer.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(FAN_FEED_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(FAN_FEED_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
};
