import type { LiveSession } from "../lib/performaLive";

const statusStyles: Record<string, string> = {
  DRAFT: "border-white/25 text-white/75",
  READY: "border-gold/50 text-gold",
  LIVE: "border-emerald-400/60 text-emerald-300 bg-emerald-500/10",
  ENDED: "border-white/20 text-white/55"
};

type Props = {
  session: LiveSession;
};

export default function LiveSessionHeader({ session }: Props) {
  const statusClass = statusStyles[session.status] || statusStyles.DRAFT;
  return (
    <header className="rounded-2xl border border-white/15 bg-black/45 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Performa Live Session</p>
          <h1 className="mt-2 font-display text-2xl md:text-3xl">{session.title}</h1>
          <p className="mt-2 text-xs text-white/65">Provider: {session.provider.replace("_", " ")}</p>
        </div>
        <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${statusClass}`}>
          {session.status}
        </div>
      </div>
    </header>
  );
}

