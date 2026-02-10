export type ProfileBadge = {
  id: string;
  label: string;
  tier: "core" | "elite" | "legend";
  description: string;
  svg: string;
};

export const profileBadges: ProfileBadge[] = [
  {
    id: "visionary",
    label: "Visionary",
    tier: "core",
    description: "Future-facing selector with clear focus.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M10 32c5-9 13-14 22-14s17 5 22 14c-5 9-13 14-22 14s-17-5-22-14z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><circle cx="32" cy="32" r="6.5" fill="currentColor"/><circle cx="36.5" cy="27.5" r="1.7" fill="white"/></svg>`
  },
  {
    id: "peace-maker",
    label: "Peace Maker",
    tier: "core",
    description: "Calm frequency and balanced energy.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M32 16v20M32 36L18.5 52M32 36L45.5 52" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>`
  },
  {
    id: "rastafari",
    label: "Rastafari",
    tier: "elite",
    description: "Rasta identity with lionheart roots.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M24 24l3-4 3 4 2-4 2 4 2-4 2 4 3-4 3 4" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 43c0-6.5 5-11 11-11s11 4.5 11 11" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="27.5" cy="33" r="1.8" fill="currentColor"/><circle cx="36.5" cy="33" r="1.8" fill="currentColor"/></svg>`
  },
  {
    id: "roots-man",
    label: "Roots Man",
    tier: "elite",
    description: "Throwback soul, classic roots spirit.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><circle cx="32" cy="26" r="8" stroke="currentColor" stroke-width="2.8"/><path d="M18 48c0-7 6-12 14-12s14 5 14 12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M24 18h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "roots-gyal",
    label: "Roots Gyal",
    tier: "elite",
    description: "Throwback soul with queen presence.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><circle cx="32" cy="25.5" r="7.5" stroke="currentColor" stroke-width="2.8"/><path d="M18 48c0-7 6-12 14-12s14 5 14 12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M24 19l8-6 8 6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: "vibes-youth",
    label: "Vibes Youth",
    tier: "core",
    description: "Hype man energy and crowd ignition.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M24 36l8-8 8 8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 30h8M42 30h8M19 20l6 5M45 20l-6 5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="42.5" r="2.4" fill="currentColor"/></svg>`
  },
  {
    id: "starigh-gangsta",
    label: "Straight Gangsta",
    tier: "legend",
    description: "Gangster badge, fearless and direct.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><rect x="20" y="22" width="24" height="10" rx="2" stroke="currentColor" stroke-width="2.8"/><path d="M20 27h24M24 42h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M28 32l-4 10M36 32l4 10" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "gyalis",
    label: "Gyalis",
    tier: "core",
    description: "Womanizer charm and social magnetism.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M26.5 41c-4.6-3.2-7.5-6.2-7.5-10.6 0-3.7 2.8-6.5 6.5-6.5 2.2 0 4 1 5.3 2.8 1.3-1.8 3.1-2.8 5.3-2.8 3.7 0 6.5 2.8 6.5 6.5 0 4.4-2.9 7.4-7.5 10.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M32 15v6M29 18h6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "top-man",
    label: "Top Man",
    tier: "legend",
    description: "Boss man authority and leadership.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M17 44l5-16 10 8 10-8 5 16H17z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M24 22l8-7 8 7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M29 45h6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "top-gyal",
    label: "Top Gyal",
    tier: "legend",
    description: "Boss woman status with top-tier presence.",
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.8"/><path d="M16 44l6-17 10 8 10-8 6 17H16z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><circle cx="22" cy="24" r="2.6" fill="currentColor"/><circle cx="32" cy="17" r="2.6" fill="currentColor"/><circle cx="42" cy="24" r="2.6" fill="currentColor"/><path d="M24 47h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
  }
];

export const defaultProfileBadgeId = "visionary";
