import { useEffect, useMemo, useRef, useState } from "react";
import type { StageMode } from "../lib/stage-mode";
import { defaultStageMode, readStageMode, subscribeStageMode, writeStageMode } from "../lib/stage-mode";
import CinematicAtmosphere from "./CinematicAtmosphere";
import StageControlDeck from "./StageControlDeck";
import PerformanceVaultCarousel, { type VaultItem } from "./PerformanceVaultCarousel";
import BookingConciergeModal from "./BookingConciergeModal";

type Props = {
  vaultItems: VaultItem[];
};

export default function StageModePortal({ vaultItems }: Props) {
  const [mode, setMode] = useState<StageMode>(defaultStageMode);
  const [transitioning, setTransitioning] = useState(false);
  const [deckVisible, setDeckVisible] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(readStageMode());
    const unsubscribe = subscribeStageMode((next) => setMode(next));
    return unsubscribe;
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = now - lastT || 1;
      const velocity = Math.min(1, (dy / dt) * 2.2);
      document.body.style.setProperty("--scroll-velocity", velocity.toFixed(3));
      lastY = window.scrollY;
      lastT = now;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mode.active || !mode.immersive) return;

    let context: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;
    let timer: number | null = null;

    const start = async () => {
      try {
        context = new AudioContext();
        osc = context.createOscillator();
        gainNode = context.createGain();
        osc.type = "sine";
        osc.frequency.value = mode.profile === "festival" ? 48 : 42;
        gainNode.gain.value = 0.0001;
        osc.connect(gainNode);
        gainNode.connect(context.destination);
        osc.start();

        timer = window.setInterval(() => {
          if (!context || !gainNode) return;
          const t = context.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(0.0001, t);
          gainNode.gain.exponentialRampToValueAtTime(0.012, t + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        }, mode.profile === "festival" ? 900 : 1300);
      } catch {
        // Keep visual Stage Mode even when audio context is blocked.
      }
    };

    start();

    return () => {
      if (timer) window.clearInterval(timer);
      osc?.stop();
      context?.close();
    };
  }, [mode.active, mode.immersive, mode.profile]);

  const stageClass = useMemo(() => {
    if (!mode.active) return "lobby-mode";
    return mode.profile === "festival" ? "stage-mode-festival" : "stage-mode-club";
  }, [mode.active, mode.profile]);

  const heroBackplate = useMemo(() => {
    if (!mode.active) return "/assets/img/0030ChipFiesta_4K.jpg";
    return mode.profile === "festival" ? "/assets/img/137NewChip_4K.jpg" : "/assets/img/096NewChip_4K.jpg";
  }, [mode.active, mode.profile]);

  const controlSurfacePhoto = useMemo(() => {
    return mode.profile === "festival" ? "/assets/img/134NewChip_4K.jpg" : "/assets/img/084NewChip_4K.jpg";
  }, [mode.profile]);

  const onStartExperience = () => {
    setTransitioning(true);
    window.setTimeout(() => {
      writeStageMode({ active: true, immersive: true });
      setTransitioning(false);
    }, 780);
  };

  const onPatch = (patch: Partial<StageMode>) => {
    writeStageMode(patch);
    setDeckVisible(false);
  };

  const onEnterVault = () => {
    setDeckVisible(false);
    const target = document.getElementById("performance-vault");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section ref={heroRef} className={`relative overflow-hidden rounded-[2.2rem] border border-white/15 bg-[#06060a]/90 p-6 md:p-10 ${stageClass}`}>
      <img src={heroBackplate} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 saturate-[0.75]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_0%,rgba(0,0,0,0.2),rgba(5,5,8,0.88))]" />
      <CinematicAtmosphere mode={mode} stageTransitioning={transitioning} />

      <StageControlDeck mode={mode} visible={deckVisible} onModePatch={onPatch} onEnterVault={onEnterVault} onBooking={() => { setDeckVisible(false); setBookingOpen(true); }} />

      <div className="relative z-20 grid gap-8 pt-16 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.38em] text-haze">Lobby Mode / Stage Mode</p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">Stage Mode Portal</h1>
          <p className="max-w-xl text-sm text-white/72 md:text-base">
            Quiet in the lobby. Engineered ignition on command. Enter cinematic control and shift the atmosphere from editorial restraint to festival-scale pulse.
          </p>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onStartExperience} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.35em] text-ink shadow-[0_0_30px_rgba(242,84,45,0.4)]">
              Start Experience
            </button>
            <button type="button" onClick={() => writeStageMode({ active: false, immersive: false })} className="rounded-full border border-white/30 px-6 py-3 text-xs uppercase tracking-[0.30em] text-white/70">
              Lobby Mode
            </button>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/20 bg-black/55 p-4">
          <div className="aspect-video rounded-[1.2rem] border border-white/10 bg-black/80 p-4">
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-white/10 p-4">
              <img src={controlSurfacePhoto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.07),rgba(0,0,0,0.88))]" />
              <p className="relative z-10 text-[10px] uppercase tracking-[0.30em] text-white/55">Control Surface</p>
              <div className="relative z-10">
                <p className="text-sm uppercase tracking-[0.24em] text-gold">{mode.active ? "Stage Mode Active" : "Lobby Mode Active"}</p>
                <p className="mt-3 text-xs text-white/60">Profile: {mode.profile} / Intensity: {mode.intensity}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 mt-10">
        <PerformanceVaultCarousel items={vaultItems} stageActive={mode.active} />
      </div>

      <BookingConciergeModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </section>
  );
}
