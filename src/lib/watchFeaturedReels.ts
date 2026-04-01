import { getBrowserSupabaseClient } from "./supabaseBrowser";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type WatchFeaturedReelPlatform = "youtube" | "vimeo" | "custom";

export type WatchFeaturedReel = {
  id: string;
  title: string;
  platform: WatchFeaturedReelPlatform;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  goLiveAt: string;
  retireAt: string | null;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();
const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getSupabase = () => (isConfigured ? getBrowserSupabaseClient() : null);

const mapRow = (row: any): WatchFeaturedReel => ({
  id: String(row.id),
  title: String(row.title || "Featured Reel"),
  platform: (String(row.platform || "custom").toLowerCase() as WatchFeaturedReelPlatform) || "custom",
  sourceUrl: String(row.source_url || row.embed_url || ""),
  embedUrl: String(row.embed_url || row.source_url || ""),
  thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
  goLiveAt: String(row.go_live_at || row.created_at || new Date().toISOString()),
  retireAt: row.retire_at ? String(row.retire_at) : null,
  isActive: Boolean(row.is_active),
  notes: String(row.notes || ""),
  createdAt: String(row.created_at || ""),
  updatedAt: String(row.updated_at || "")
});

const normalizeUrl = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
};

const extractYouTubeId = (value: string) => {
  const raw = normalizeUrl(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.replace(/^\/+/, "").split("/")[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "live") {
        return pathParts[1] || "";
      }
    }
  } catch {
    return "";
  }
  return "";
};

const extractVimeoId = (value: string) => {
  const raw = normalizeUrl(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
};

export const normalizeWatchFeaturedReelInput = (input: {
  link: string;
  thumbnailUrl?: string | null;
}): Result<{
  platform: WatchFeaturedReelPlatform;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}> => {
  const link = normalizeUrl(input.link);
  if (!link) return { ok: false, error: "Featured reel link is required." };

  const youtubeId = extractYouTubeId(link);
  if (youtubeId) {
    return {
      ok: true,
      data: {
        platform: "youtube",
        sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
        thumbnailUrl: String(input.thumbnailUrl || "").trim() || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
      }
    };
  }

  const vimeoId = extractVimeoId(link);
  if (vimeoId) {
    return {
      ok: true,
      data: {
        platform: "vimeo",
        sourceUrl: link,
        embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        thumbnailUrl: String(input.thumbnailUrl || "").trim() || null
      }
    };
  }

  return {
    ok: true,
    data: {
      platform: "custom",
      sourceUrl: link,
      embedUrl: link,
      thumbnailUrl: String(input.thumbnailUrl || "").trim() || null
    }
  };
};

export const loadActiveWatchFeaturedReel = async (): Promise<Result<WatchFeaturedReel | null>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: null };
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("watch_featured_reels")
    .select("*")
    .eq("is_active", true)
    .lte("go_live_at", nowIso)
    .order("go_live_at", { ascending: false })
    .limit(12);

  if (error) return { ok: false, error: error.message };
  const rows = Array.isArray(data) ? data : [];
  const activeRow =
    rows.find((row) => {
      const retireAt = row.retire_at ? Date.parse(String(row.retire_at)) : Number.POSITIVE_INFINITY;
      return !Number.isFinite(retireAt) || retireAt > Date.now();
    }) || null;
  return { ok: true, data: activeRow ? mapRow(activeRow) : null };
};

export const loadAdminWatchFeaturedReels = async (): Promise<Result<WatchFeaturedReel[]>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await supabase
    .from("watch_featured_reels")
    .select("*")
    .order("go_live_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: Array.isArray(data) ? data.map(mapRow) : [] };
};

export const upsertWatchFeaturedReel = async (input: {
  id?: string;
  title: string;
  link: string;
  thumbnailUrl?: string | null;
  goLiveAt: string;
  retireAt?: string | null;
  isActive: boolean;
  notes?: string;
}): Promise<Result<WatchFeaturedReel>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const title = String(input.title || "").trim();
  if (!title) return { ok: false, error: "Featured reel title is required." };

  const goLiveAt = String(input.goLiveAt || "").trim();
  if (!goLiveAt) return { ok: false, error: "Go live time is required." };

  const retireAt = String(input.retireAt || "").trim();
  if (retireAt && Date.parse(retireAt) <= Date.parse(goLiveAt)) {
    return { ok: false, error: "Retire time must be later than the go live time." };
  }

  const normalized = normalizeWatchFeaturedReelInput({
    link: input.link,
    thumbnailUrl: input.thumbnailUrl || null
  });
  if (!normalized.ok) return normalized;

  const { data: authData } = await supabase.auth.getUser();
  const actorId = authData.user?.id || null;
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title,
    platform: normalized.data.platform,
    source_url: normalized.data.sourceUrl,
    embed_url: normalized.data.embedUrl,
    thumbnail_url: normalized.data.thumbnailUrl,
    go_live_at: new Date(goLiveAt).toISOString(),
    retire_at: retireAt ? new Date(retireAt).toISOString() : null,
    is_active: input.isActive,
    notes: String(input.notes || ""),
    updated_at: new Date().toISOString(),
    updated_by: actorId,
    created_by: actorId
  };

  const { data, error } = await supabase
    .from("watch_featured_reels")
    .upsert(payload)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapRow(data) };
};

export const deleteWatchFeaturedReel = async (id: string): Promise<Result<{ deleted: true }>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { error } = await supabase.from("watch_featured_reels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { deleted: true } };
};
