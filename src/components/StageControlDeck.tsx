import type { StageMode } from "../lib/stage-mode";

type Props = {
  mode: StageMode;
  visible: boolean;
  onModePatch: (patch: Partial<StageMode>) => void;
  onEnterVault: () => void;
  onBooking: () => void;
};

export default function StageControlDeck({ mode, visible, onModePatch, onEnterVault, onBooking }: Props) {
  return (
    <div
      className={`pointer-events-auto absolute left-1/2 top-5 z-40 w-[min(980px,96%)] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/30 px-4 py-3 backdrop-blur-xl transition duration-700 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0"
      }`}
    >
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center">
        <div className="text-[10px] uppercase tracking-[0.36em] text-white/55">The Performa Control Deck</div>

        <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-white/70">
          <span>Sound</span>
          <button
            type="button"
            onClick={() => onModePatch({ immersive: !mode.immersive })}
            className="rounded-full border border-white/30 px-3 py-2 text-[10px] tracking-[0.2em]"
          >
            {mode.immersive ? "Immersive" : "Silent"}
          </button>
        </label>

        <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-white/70">
          <span>Scene</span>
          <button
            type="button"
            onClick={() => onModePatch({ profile: mode.profile === "club" ? "festival" : "club" })}
            className="rounded-full border border-white/30 px-3 py-2 text-[10px] tracking-[0.2em]"
          >
            {mode.profile === "club" ? "Club" : "Festival"}
          </button>
        </label>

        <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/70">
          <span>Intensity</span>
          <input
            type="range"
            min={10}
            max={100}
            value={mode.intensity}
            onChange={(event) => onModePatch({ intensity: Number(event.target.value) })}
            className="w-full accent-[#f3d38b]"
            aria-label="Visual intensity"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button type="button" onClick={onEnterVault} className="rounded-full border border-gold/40 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-gold">
            Enter Vault
          </button>
          <button type="button" onClick={onBooking} className="rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-ink">
            Request Booking
          </button>
        </div>
      </div>
    </div>
  );
}
