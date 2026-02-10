import { useEffect, useState } from "react";
import HeroStage from "./HeroStage";

type Props = {
  prefersSilent?: boolean;
};

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export default function HeroExperience({ prefersSilent = false }: Props) {
  const [ready, setReady] = useState(false);
  const [allowAudio, setAllowAudio] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
        WebGL unavailable. Showing cinematic fallback.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60">
          <button
            type="button"
            onClick={() => {
              setAllowAudio(true);
              setReady(true);
            }}
            className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.4em] text-ink"
          >
            Start Experience
          </button>
          <button
            type="button"
            onClick={() => {
              setAllowAudio(false);
              setReady(true);
            }}
            className="text-xs uppercase tracking-[0.3em] text-white/70"
          >
            Enter Silent
          </button>
        </div>
      )}
      {ready && <HeroStage allowAudio={!prefersSilent && allowAudio} />}
    </div>
  );
}
