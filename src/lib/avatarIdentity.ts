export const AVATAR_IMAGE_GUIDANCE = {
  recommendedPx: 1024,
  minimumPx: 256,
  maxFileSizeMb: 8
} as const;

const AVATAR_PALETTES = [
  { base: "#0f172a", accent: "#f97316", accentSoft: "#fb7185", glow: "#facc15" },
  { base: "#111827", accent: "#14b8a6", accentSoft: "#38bdf8", glow: "#f8fafc" },
  { base: "#172554", accent: "#818cf8", accentSoft: "#22d3ee", glow: "#fde68a" },
  { base: "#1f2937", accent: "#ef4444", accentSoft: "#f59e0b", glow: "#fef3c7" },
  { base: "#0f172a", accent: "#d946ef", accentSoft: "#60a5fa", glow: "#fbcfe8" },
  { base: "#1c1917", accent: "#f59e0b", accentSoft: "#fb7185", glow: "#fdba74" }
] as const;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeDisplayName = (value?: string | null, fallback = "Fan") => {
  const clean = normalizeWhitespace(String(value || ""));
  return clean || fallback;
};

export const isDefaultDisplayName = (value?: string | null) => normalizeDisplayName(value).toLowerCase() === "fan";

export const displayNameFromEmail = (email?: string | null) => {
  const local = String(email || "").trim().toLowerCase().split("@")[0] || "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const buildAvatarSeed = (userId?: string | null, name?: string | null) =>
  `${String(userId || "fan").trim() || "fan"}:${normalizeDisplayName(name)}`;

export const avatarInitials = (name?: string | null) => {
  const clean = normalizeDisplayName(name);
  const words = clean.split(" ").filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || "F"}${words[1][0] || "A"}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "FA";
};

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const avatarPaletteForSeed = (seed?: string | null) => {
  const safeSeed = String(seed || "fan");
  return AVATAR_PALETTES[hashSeed(safeSeed) % AVATAR_PALETTES.length];
};

export const isHttpImageUrl = (value?: string | null) => /^https?:\/\//i.test(String(value || "").trim());
