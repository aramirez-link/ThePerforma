export type StageMode = {
  active: boolean;
  immersive: boolean;
  profile: "club" | "festival";
  intensity: number;
  hue: number;
  theme: "ember" | "gold" | "cobalt" | "crimson";
};

declare global {
  interface Window {
    __stageMode?: {
      get: () => StageMode;
      set: (patch: Partial<StageMode>) => void;
      subscribe: (cb: (mode: StageMode) => void) => () => void;
    };
  }
}

export const defaultStageMode: StageMode = {
  active: false,
  immersive: false,
  profile: "club",
  intensity: 45,
  hue: 18,
  theme: "ember"
};

const STAGE_KEY = "the-performa-stage-mode";

function normalizeStageMode(input: Partial<StageMode> | null | undefined): StageMode {
  const merged = { ...defaultStageMode, ...(input ?? {}) };
  return {
    ...merged,
    intensity: Math.min(100, Math.max(10, Number(merged.intensity) || defaultStageMode.intensity)),
    hue: Math.min(360, Math.max(0, Number(merged.hue) || defaultStageMode.hue))
  };
}

export function readStageMode(): StageMode {
  if (typeof window === "undefined") return defaultStageMode;
  if (window.__stageMode) return normalizeStageMode(window.__stageMode.get());
  try {
    const raw = localStorage.getItem(STAGE_KEY);
    if (!raw) return defaultStageMode;
    return normalizeStageMode(JSON.parse(raw) as Partial<StageMode>);
  } catch {
    return defaultStageMode;
  }
}

export function writeStageMode(patch: Partial<StageMode>) {
  if (typeof window === "undefined") return;
  window.__stageMode?.set(patch);
}

export function subscribeStageMode(cb: (mode: StageMode) => void) {
  if (typeof window === "undefined" || !window.__stageMode) return () => {};
  return window.__stageMode.subscribe(cb);
}
