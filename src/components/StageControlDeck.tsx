import { useEffect, useState } from "react";
import type { StageMode } from "../lib/stage-mode";

type Props = {
  mode: StageMode;
  visible: boolean;
  onModePatch: (patch: Partial<StageMode>) => void;
  onEnterVault: () => void;
  onBooking: () => void;
};

export default function StageControlDeck({ mode, visible, onModePatch, onEnterVault, onBooking }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const presets: Array<{ label: string; hue: number; intensity: number }> = [
    { label: "Ember Gold", hue: 24, intensity: 64 },
    { label: "Steel Blue", hue: 212, intensity: 58 },
    { label: "Summer Night", hue: 332, intensity: 72 }
  ];

  return (
    <div className={`pointer-events-auto absolute left-1/2 top-5 z-40 w-[min(980px,96%)] -translate-x-1/2 transition duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      {isMobile && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex min-h-11 items-center rounded-full border border-white/25 bg-black/45 px-4 py-2 text-[10px] uppercase tracking-[0.26em] text-white/85"
            aria-expanded={mobileOpen}
            aria-controls="mobile-control-deck-panel"
          >
            {mobileOpen ? "Hide Control Deck" : "Open Control Deck"}
          </button>
        </div>
      )}

      {(!isMobile || mobileOpen) && (
        <div
          id="mobile-control-deck-panel"
          className="rounded-2xl border border-white/20 bg-black/30 px-4 py-3 backdrop-blur-xl"
        >
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
            <div className="text-[10px] uppercase tracking-[0.36em] text-white/55">The Performa Control Deck</div>

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

            <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/70">
              <span>Hue</span>
              <input
                type="range"
                min={0}
                max={360}
                value={mode.hue}
                onChange={(event) => onModePatch({ hue: Number(event.target.value) })}
                className="w-full accent-[#f3d38b]"
                aria-label="Theme hue"
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.22em] text-white/55">Presets</span>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onModePatch({ hue: preset.hue, intensity: preset.intensity })}
                className="rounded-full border border-white/25 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-white/75 hover:border-gold/45 hover:text-gold"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
