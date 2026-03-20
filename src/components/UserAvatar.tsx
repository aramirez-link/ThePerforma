import { avatarInitials, avatarPaletteForSeed, buildAvatarSeed, isHttpImageUrl, normalizeDisplayName } from "../lib/avatarIdentity";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl"
};

type Props = {
  name?: string | null;
  seed?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
};

export default function UserAvatar({ name, seed, imageUrl, size = "md", className = "" }: Props) {
  const resolvedName = normalizeDisplayName(name);
  const resolvedSeed = seed || buildAvatarSeed(undefined, resolvedName);
  const palette = avatarPaletteForSeed(resolvedSeed);
  const safeImageUrl = isHttpImageUrl(imageUrl) ? String(imageUrl).trim() : "";
  const classes = [
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 shadow-[0_0_28px_rgba(242,84,45,0.14)]",
    sizeClasses[size],
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (safeImageUrl) {
    return <img src={safeImageUrl} alt={`${resolvedName} avatar`} className={classes} loading="lazy" />;
  }

  return (
    <div
      aria-label={`${resolvedName} avatar`}
      className={classes}
      style={{ background: `linear-gradient(145deg, ${palette.base}, ${palette.accent})` }}
    >
      <span
        className="absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(circle at 24% 22%, ${palette.glow}, transparent 34%), radial-gradient(circle at 78% 28%, ${palette.accentSoft}, transparent 28%), linear-gradient(160deg, transparent 18%, rgba(255,255,255,0.12) 50%, transparent 82%)`
        }}
      />
      <span
        className="absolute bottom-[18%] left-[14%] right-[14%] h-px rounded-full opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${palette.glow}, transparent)` }}
      />
      <span
        className="absolute left-[18%] top-[20%] h-[22%] w-[22%] rounded-full opacity-75 blur-[2px]"
        style={{ backgroundColor: palette.accentSoft }}
      />
      <span className="relative z-10 font-semibold uppercase tracking-[0.12em] text-white">{avatarInitials(resolvedName)}</span>
    </div>
  );
}
