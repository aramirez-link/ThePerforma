import { useMemo } from "react";
import type { StageMode } from "../lib/stage-mode";

type Props = {
  mode: StageMode;
  stageTransitioning: boolean;
};

export default function CinematicAtmosphere({ mode, stageTransitioning }: Props) {
  const pulseOpacity = useMemo(() => Math.max(0.15, mode.intensity / 180), [mode.intensity]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,rgba(242,84,45,0.16),rgba(6,6,10,0.95))]" />

      <div className={`absolute -left-[18%] top-[10%] h-[44vh] w-[44vw] rounded-full bg-[#f2542d]/20 blur-3xl ${mode.active ? "animate-atmo-drift" : "animate-atmo-idle"}`} />
      <div className={`absolute right-[-16%] top-[24%] h-[40vh] w-[40vw] rounded-full bg-[#f3d38b]/18 blur-3xl ${mode.active ? "animate-atmo-drift-rev" : "animate-atmo-idle-rev"}`} />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_60%)] mix-blend-screen" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_110%,rgba(0,0,0,0.9),rgba(0,0,0,0))]" />
      <div className="atmo-grain absolute inset-0 opacity-50" />

      {mode.active && (
        <>
          <div className="stage-wave absolute inset-x-[-10%] bottom-[-8rem] h-72" style={{ opacity: pulseOpacity }} />
          <div className={`stage-pulse absolute inset-0 ${mode.profile === "festival" ? "stage-pulse-festival" : "stage-pulse-club"}`} />
        </>
      )}

      <div className={`absolute inset-0 bg-black transition-opacity duration-700 ${stageTransitioning ? "opacity-45" : "opacity-0"}`} />
    </div>
  );
}
