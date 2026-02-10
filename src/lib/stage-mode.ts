export type StageMode = {
  active: boolean;
  immersive: boolean;
  profile: "club" | "festival";
  intensity: number;
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
  theme: "ember"
};

export function readStageMode(): StageMode {
  if (typeof window === "undefined") return defaultStageMode;
  if (!window.__stageMode) return defaultStageMode;
  return window.__stageMode.get();
}

export function writeStageMode(patch: Partial<StageMode>) {
  if (typeof window === "undefined") return;
  window.__stageMode?.set(patch);
}

export function subscribeStageMode(cb: (mode: StageMode) => void) {
  if (typeof window === "undefined" || !window.__stageMode) return () => {};
  return window.__stageMode.subscribe(cb);
}
