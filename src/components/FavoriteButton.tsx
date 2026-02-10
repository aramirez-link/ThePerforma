import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite, type FavoriteType } from "../lib/fanVault";

type Props = {
  type: FavoriteType;
  itemId: string;
  title: string;
  href: string;
  image?: string;
  compact?: boolean;
};

export default function FavoriteButton({ type, itemId, title, href, image, compact = false }: Props) {
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const sync = () => {
      void isFavorite(type, itemId).then(setActive);
    };
    void sync();
    window.addEventListener("fanvault:changed", sync);
    return () => window.removeEventListener("fanvault:changed", sync);
  }, [type, itemId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const onToggle = async () => {
    setWorking(true);
    const result = await toggleFavorite({ type, id: itemId, title, href, image });
    setWorking(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setActive(result.favorited);
    setNotice(result.favorited ? "Saved to Fan Vault" : "Removed from Fan Vault");
  };

  return (
    <div className="relative inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => void onToggle()}
        disabled={working}
        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
          active
            ? "border-gold/70 bg-gold/15 text-gold"
            : "border-white/25 bg-black/50 text-white/70 hover:border-gold/50 hover:text-gold"
        } ${compact ? "" : "md:px-4 md:py-2"} ${working ? "opacity-60" : ""}`}
        aria-pressed={active}
      >
        {working ? "..." : active ? "Saved" : "Save"}
      </button>
      {notice && <span className="mt-2 rounded-md bg-black/80 px-2 py-1 text-[10px] text-white/80">{notice}</span>}
    </div>
  );
}
