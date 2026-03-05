import type { DestinationStatus, SessionStatus } from "./types.ts";

const FORWARD_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  DRAFT: ["READY"],
  READY: ["LIVE"],
  LIVE: ["ENDED"],
  ENDED: []
};

export const canTransitionSession = (current: SessionStatus, target: SessionStatus) => {
  if (current === target) return true;
  return FORWARD_TRANSITIONS[current].includes(target);
};

export const applySessionTransition = (current: SessionStatus, target: SessionStatus) => {
  if (!canTransitionSession(current, target)) {
    throw new Error(`Invalid session transition: ${current} -> ${target}`);
  }
  return target;
};

export const desiredDestinationStatus = (enabled: boolean, sessionStatus: SessionStatus): DestinationStatus => {
  if (!enabled) return "DISABLED";
  if (sessionStatus === "LIVE") return "CONNECTING";
  if (sessionStatus === "ENDED") return "DISABLED";
  return "CONNECTING";
};

