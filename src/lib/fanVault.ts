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
