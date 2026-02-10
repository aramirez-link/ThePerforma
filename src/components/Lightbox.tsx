import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MediaItem } from "./MediaGrid";

type Props = {
  items: MediaItem[];
  index: number;
  onClose: () => void;
};

type ReactionType = "like" | "celebrate" | "support";

type SocialState = {
  reactions: {
    like: number;
    celebrate: number;
    support: number;
  };
  userReaction: ReactionType | null;
  comments: Array<{
    text: string;
    createdAt: string;
  }>;
};

const STORAGE_KEY = "the-performa-gallery-lightbox-social-v1";

const readStore = (): Record<string, SocialState> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeStore = (data: Record<string, SocialState>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const defaultSocialState = (): SocialState => ({
  reactions: { like: 0, celebrate: 0, support: 0 },
  userReaction: null,
  comments: []
});

function IconLike() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 21H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h5" />
      <path d="M10 11l3-8a2 2 0 0 1 3 1v7h4a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H10z" />
    </svg>
  );
}

function IconCelebrate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 14l7-7 7 7" />
      <path d="M12 7v13" />
      <path d="M4 4l2 2M20 4l-2 2M2 10h3M19 10h3" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12v6" />
      <path d="M16 12v6" />
      <path d="M5 21h14" />
      <path d="M8 12l-2-2M16 12l2-2" />
      <path d="M10 9l2-2 2 2" />
    </svg>
  );
}

function IconComment() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11a8 8 0 0 1-8 8H8l-5 3 2-5a8 8 0 1 1 16-6z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

type ActionButtonProps = {
  label: string;
  icon: ReactNode;
  burst: string;
  burstClass: string;
  className?: string;
  active?: boolean;
  tick: number;
  onClick: () => void;
};

function ActionButton({ label, icon, burst, burstClass, className = "", active = false, tick, onClick }: ActionButtonProps) {
  return (
    <button type="button" onClick={onClick} className={`fb-bar-btn ${active ? "fb-bar-btn-active" : ""} ${className}`}>
      <span key={tick} className="fb-bar-icon">{icon}</span>
      <span>{label}</span>
      {tick > 0 && (
        <span key={`burst-${tick}`} className={`fb-click-burst ${burstClass}`} aria-hidden="true">{burst}</span>
      )}
    </button>
  );
}

export default function Lightbox({ items, index, onClose }: Props) {
  const [active, setActive] = useState(index);
  const [social, setSocial] = useState<SocialState>(defaultSocialState());
  const [commentText, setCommentText] = useState("");
  const [notice, setNotice] = useState("");
  const [actionTick, setActionTick] = useState({
    like: 0,
    celebrate: 0,
    support: 0,
    comment: 0,
    share: 0
  });
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setActive((prev) => (prev + 1) % items.length);
      if (event.key === "ArrowLeft") setActive((prev) => (prev - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [items.length, onClose]);

  const current = items[active];
  const currentKey = current.image;

  useEffect(() => {
    const store = readStore();
    setSocial(store[currentKey] || defaultSocialState());
    setCommentText("");
  }, [currentKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateSocial = (next: SocialState) => {
    setSocial(next);
    const store = readStore();
    store[currentKey] = next;
    writeStore(store);
  };

  const react = (type: ReactionType) => {
    const previous = social.userReaction;
    const nextReaction = previous === type ? null : type;
    const nextReactions = { ...social.reactions };

    if (previous) {
      nextReactions[previous] = Math.max(0, nextReactions[previous] - 1);
    }
    if (nextReaction) {
      nextReactions[nextReaction] = nextReactions[nextReaction] + 1;
    }

    updateSocial({
      ...social,
      reactions: nextReactions,
      userReaction: nextReaction
    });
    setActionTick((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    setNotice(nextReaction ? "Reaction added" : "Reaction removed");
  };

  const share = async () => {
    try {
      const shareUrl = `${window.location.origin}/gallery?utm_source=fan-share&utm_medium=social&utm_campaign=gallery_clip&utm_content=${encodeURIComponent(current.alt || "gallery-moment")}`;
      const payload = {
        title: "The Performa Gallery",
        text: current.alt || "Gallery moment",
        url: shareUrl
      };
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setActionTick((prev) => ({ ...prev, share: prev.share + 1 }));
      setNotice("Shared");
    } catch {
      setNotice("Share cancelled");
    }
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const nextComments = [{ text, createdAt: new Date().toISOString() }, ...social.comments].slice(0, 20);
    updateSocial({ ...social, comments: nextComments });
    setCommentText("");
    setActionTick((prev) => ({ ...prev, comment: prev.comment + 1 }));
    setNotice("Comment added");
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 md:p-6"
      onClick={onClose}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Gallery image viewer"
    >
      <button
        type="button"
        onClick={onClose}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute right-3 top-[max(0.8rem,env(safe-area-inset-top))] z-[130] rounded-full border border-white/25 bg-black/60 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/80 hover:text-white md:right-6 md:top-6 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-xs md:tracking-[0.3em]"
      >
        Close
      </button>
      <button
        type="button"
        onClick={() => setActive((prev) => (prev - 1 + items.length) % items.length)}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute left-2 top-1/2 z-[130] -translate-y-1/2 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-xl text-white/70 hover:text-white md:left-6 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-2xl"
        aria-label="Previous"
      >
        {"<"}
      </button>
      <div className="w-full max-w-4xl" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
        <img src={current.image} alt={current.alt} className="max-h-[46vh] w-full object-contain md:max-h-[62vh]" />
        <div className="mt-4 rounded-2xl border border-white/15 bg-black/50 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{current.tags.join(" · ")}</p>
          {current.credit && <p className="mt-2 text-xs text-white/50">{current.credit}</p>}

          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-white/15 bg-black/55 text-left">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
              <span>Like {social.reactions.like} · Celebrate {social.reactions.celebrate} · Support {social.reactions.support}</span>
              <span>{social.comments.length} comments</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5">
              <ActionButton label="Like" icon={<IconLike />} burst="👍 👍" burstClass="fb-burst-like" tick={actionTick.like} active={social.userReaction === "like"} className="border-r border-white/10" onClick={() => react("like")} />
              <ActionButton label="Celebrate" icon={<IconCelebrate />} burst="✨ 🎉" burstClass="fb-burst-celebrate" tick={actionTick.celebrate} active={social.userReaction === "celebrate"} className="border-r border-white/10" onClick={() => react("celebrate")} />
              <ActionButton label="Support" icon={<IconSupport />} burst="🙌 🙌" burstClass="fb-burst-support" tick={actionTick.support} active={social.userReaction === "support"} className="border-r border-white/10" onClick={() => react("support")} />
              <ActionButton
                label="Comment"
                icon={<IconComment />}
                burst="💬"
                burstClass="fb-burst-comment"
                tick={actionTick.comment}
                className="border-r border-white/10"
                onClick={() => {
                  setActionTick((prev) => ({ ...prev, comment: prev.comment + 1 }));
                  commentInputRef.current?.focus();
                }}
              />
              <ActionButton label="Share" icon={<IconShare />} burst="↗" burstClass="fb-burst-share" tick={actionTick.share} className="text-[#1877f2]" onClick={() => void share()} />
            </div>
          </div>

          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-white/10 bg-black/50 p-3 text-left">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Comments</p>
            <div className="mt-2 flex gap-2">
              <input
                ref={commentInputRef}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitComment();
                }}
                placeholder="Add a comment..."
                className="w-full rounded-full border border-white/20 bg-black/40 px-3 py-2 text-xs text-white/85 placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={submitComment}
                className="rounded-full border border-white/30 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75"
              >
                Post
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {social.comments.slice(0, 5).map((comment, idx) => (
                <li key={`${comment.createdAt}-${idx}`} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/75">
                  {comment.text}
                </li>
              ))}
              {!social.comments.length && <li className="text-xs text-white/45">No comments yet.</li>}
            </ul>
          </div>

          {notice && <p className="mt-3 text-xs text-gold">{notice}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActive((prev) => (prev + 1) % items.length)}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute right-2 top-1/2 z-[130] -translate-y-1/2 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-xl text-white/70 hover:text-white md:right-6 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-2xl"
        aria-label="Next"
      >
        {">"}
      </button>
    </div>
  );
}
