
import { useEffect, useMemo, useState } from "react";

type VenueType = "club" | "festival" | "warehouse" | "luxury" | "brand";
type PerformanceTier = "core" | "headline" | "cinematic";
type SetLength = 60 | 75 | 90;
type ProductionFootprint = "house" | "hybrid" | "full";
type ModuleTier = "none" | "basic" | "enhanced" | "premium";
type RoutingComplexity = "local" | "regional" | "fly_in";
type PermitStatus = "yes" | "no" | "unknown";
type EnvironmentType = "indoor" | "outdoor";
type LoadInWindow = "tight" | "standard" | "extended";
type TicketingModel = "ticketed" | "guestlist" | "mixed";
type CostOwnership = "promoter" | "shared" | "sponsor_led";
type BudgetBand = "starter" | "growth" | "premium" | "flagship";
type ModuleKey =
  | "lighting_visuals"
  | "audio"
  | "security"
  | "talent"
  | "media_promo"
  | "vip_hospitality"
  | "compliance_insurance"
  | "venue_sourcing";

type WizardState = {
  venue: VenueType;
  eventName: string;
  cityState: string;
  targetDate: string;
  expectedAttendance: number;
  ticketingModel: TicketingModel;
  doorsTime: string;
  setTime: string;
  performanceTier: PerformanceTier;
  setLength: SetLength;
  productionFootprint: ProductionFootprint;
  modules: Record<ModuleKey, ModuleTier>;
  loadInWindow: LoadInWindow;
  routingComplexity: RoutingComplexity;
  permitsStatus: PermitStatus;
  environmentType: EnvironmentType;
  budgetBand: BudgetBand;
  costOwnership: CostOwnership;
  ticketPrice: number;
  sellThroughPercent: number;
  sponsorshipDollars: number;
  barSplitPercent: number;
  merchDollars: number;
};

type CostBreakdown = {
  performaFee: number;
  travel: number;
  security: number;
  production: number;
  permitsInsurance: number;
  contingency: number;
  total: number;
  low: number;
  high: number;
};

type StaffRole = {
  label: string;
  count: number;
};

type RiskItem = {
  title: string;
  likelihood: number;
  impact: number;
  mitigation: string;
  residual: number;
};

const venueOptions: Array<{ key: VenueType; label: string; caption: string }> = [
  { key: "club", label: "Club Night", caption: "High-density nightlife events" },
  { key: "festival", label: "Festival Mainstage", caption: "Large scale crowd impact" },
  { key: "warehouse", label: "Warehouse Afterhours", caption: "Immersive ritual pacing" },
  { key: "luxury", label: "Private Luxury Event", caption: "Concierge premium environments" },
  { key: "brand", label: "Brand Experience", caption: "Campaign and activation format" }
];

const ticketingOptions: Array<{ key: TicketingModel; label: string }> = [
  { key: "ticketed", label: "Ticketed" },
  { key: "guestlist", label: "Guestlist" },
  { key: "mixed", label: "Mixed" }
];

const tierOptions: Array<{ key: PerformanceTier; label: string }> = [
  { key: "core", label: "Core Performance Tier" },
  { key: "headline", label: "Headline Show Tier" },
  { key: "cinematic", label: "Cinematic Performa Tier" }
];

const setLengthOptions: SetLength[] = [60, 75, 90];
const footprintOptions: Array<{ key: ProductionFootprint; label: string }> = [
  { key: "house", label: "House" },
  { key: "hybrid", label: "Hybrid" },
  { key: "full", label: "Full" }
];

const moduleConfig: Array<{ key: ModuleKey; label: string; baseCost: number }> = [
  { key: "lighting_visuals", label: "Lighting / Visuals", baseCost: 3200 },
  { key: "audio", label: "Audio", baseCost: 2600 },
  { key: "security", label: "Security", baseCost: 1800 },
  { key: "talent", label: "Talent", baseCost: 2800 },
  { key: "media_promo", label: "Media / Promo", baseCost: 2200 },
  { key: "vip_hospitality", label: "VIP / Hospitality", baseCost: 2500 },
  { key: "compliance_insurance", label: "Compliance / Insurance", baseCost: 1700 },
  { key: "venue_sourcing", label: "Venue Sourcing", baseCost: 2400 }
];

const moduleTierOptions: ModuleTier[] = ["none", "basic", "enhanced", "premium"];
const moduleTierMultiplier: Record<ModuleTier, number> = {
  none: 0,
  basic: 1,
  enhanced: 1.45,
  premium: 2.05
};

const loadInOptions: Array<{ key: LoadInWindow; label: string }> = [
  { key: "tight", label: "Tight (under 4h)" },
  { key: "standard", label: "Standard (4-8h)" },
  { key: "extended", label: "Extended (8h+)" }
];
const routingOptions: Array<{ key: RoutingComplexity; label: string }> = [
  { key: "local", label: "Local" },
  { key: "regional", label: "Regional" },
  { key: "fly_in", label: "Fly-in" }
];
const permitOptions: Array<{ key: PermitStatus; label: string }> = [
  { key: "yes", label: "Permits confirmed" },
  { key: "no", label: "Permits not started" },
  { key: "unknown", label: "Permits unknown" }
];
const environmentOptions: Array<{ key: EnvironmentType; label: string }> = [
  { key: "indoor", label: "Indoor" },
  { key: "outdoor", label: "Outdoor" }
];

const budgetOptions: Array<{ key: BudgetBand; label: string; min: number; max: number }> = [
  { key: "starter", label: "$20k-$45k", min: 20000, max: 45000 },
  { key: "growth", label: "$45k-$90k", min: 45000, max: 90000 },
  { key: "premium", label: "$90k-$180k", min: 90000, max: 180000 },
  { key: "flagship", label: "$180k+", min: 180000, max: 320000 }
];

const ownershipOptions: Array<{ key: CostOwnership; label: string }> = [
  { key: "promoter", label: "Promoter-led" },
  { key: "shared", label: "Shared with partners" },
  { key: "sponsor_led", label: "Sponsor-led" }
];

const stageModeByVenue: Record<VenueType, string> = {
  club: "Club Ignition",
  festival: "Festival Surge Protocol",
  warehouse: "Afterhours Overdrive",
  luxury: "Luxury Ignition Suite",
  brand: "Cinematic Impact Mode"
};

const recommendedForByVenue: Record<VenueType, string> = {
  club: "High-density nightlife, peak-hour energy",
  festival: "Mainstage crowds, large-scale impact",
  warehouse: "Afterhours culture, deep ritual pacing",
  luxury: "Concierge environments, premium restraint",
  brand: "Campaign activations, cinematic sponsor moments"
};

const footprintMultiplier: Record<ProductionFootprint, number> = {
  house: 1,
  hybrid: 1.2,
  full: 1.42
};

const performaFeeTable: Record<PerformanceTier, Record<SetLength, number>> = {
  core: { 60: 9000, 75: 11500, 90: 13500 },
  headline: { 60: 14500, 75: 18500, 90: 22000 },
  cinematic: { 60: 22000, 75: 27000, 90: 32000 }
};

const travelBase: Record<RoutingComplexity, number> = {
  local: 1200,
  regional: 5200,
  fly_in: 13200
};

const permitBase: Record<EnvironmentType, number> = {
  indoor: 900,
  outdoor: 2400
};

const defaultModules: Record<ModuleKey, ModuleTier> = {
  lighting_visuals: "enhanced",
  audio: "enhanced",
  security: "basic",
  talent: "enhanced",
  media_promo: "basic",
  vip_hospitality: "none",
  compliance_insurance: "basic",
  venue_sourcing: "none"
};

const defaultState: WizardState = {
  venue: "warehouse",
  eventName: "",
  cityState: "",
  targetDate: "",
  expectedAttendance: 1200,
  ticketingModel: "ticketed",
  doorsTime: "",
  setTime: "",
  performanceTier: "headline",
  setLength: 75,
  productionFootprint: "hybrid",
  modules: defaultModules,
  loadInWindow: "standard",
  routingComplexity: "regional",
  permitsStatus: "unknown",
  environmentType: "indoor",
  budgetBand: "premium",
  costOwnership: "promoter",
  ticketPrice: 45,
  sellThroughPercent: 72,
  sponsorshipDollars: 0,
  barSplitPercent: 10,
  merchDollars: 0
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Math.round(value));

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const base64UrlEncodeJson = (value: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecodeJson = (value: string): Partial<WizardState> | null => {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

const withNumericDefaults = (parsed: Partial<WizardState>): WizardState => ({
  ...defaultState,
  ...parsed,
  modules: { ...defaultModules, ...(parsed.modules || {}) },
  expectedAttendance: clamp(Number(parsed.expectedAttendance || defaultState.expectedAttendance), 50, 120000),
  setLength: ([60, 75, 90].includes(Number(parsed.setLength)) ? Number(parsed.setLength) : defaultState.setLength) as SetLength,
  ticketPrice: clamp(Number(parsed.ticketPrice || defaultState.ticketPrice), 0, 2000),
  sellThroughPercent: clamp(Number(parsed.sellThroughPercent || defaultState.sellThroughPercent), 0, 100),
  sponsorshipDollars: Math.max(0, Number(parsed.sponsorshipDollars || defaultState.sponsorshipDollars)),
  barSplitPercent: clamp(Number(parsed.barSplitPercent || defaultState.barSplitPercent), 0, 100),
  merchDollars: Math.max(0, Number(parsed.merchDollars || defaultState.merchDollars))
});

const calculateLeadTimeDays = (targetDate: string): number => {
  if (!targetDate) return 0;
  const now = new Date();
  const target = new Date(targetDate);
  const delta = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(delta / (1000 * 60 * 60 * 24)));
};
const calculateOutputPercent = (state: WizardState): number => {
  const moduleTierTotal = Object.values(state.modules).reduce((sum, tier) => sum + moduleTierMultiplier[tier], 0);
  const attendanceFactor = clamp(state.expectedAttendance / 5000, 0.1, 1.1) * 18;
  const tierFactor = state.performanceTier === "cinematic" ? 22 : state.performanceTier === "headline" ? 14 : 8;
  const footprintFactor = state.productionFootprint === "full" ? 10 : state.productionFootprint === "hybrid" ? 6 : 2;
  return clamp(Math.round(34 + moduleTierTotal * 5 + attendanceFactor + tierFactor + footprintFactor), 35, 99);
};

const calculateCostBreakdown = (state: WizardState, riskScore: number): CostBreakdown => {
  const performaFee = performaFeeTable[state.performanceTier][state.setLength];
  const travel = travelBase[state.routingComplexity];

  const securityBasePer100 = state.expectedAttendance >= 5000 ? 380 : state.expectedAttendance >= 2000 ? 300 : 240;
  const securityTierMultiplier =
    state.modules.security === "premium" ? 1.45 : state.modules.security === "enhanced" ? 1.2 : state.modules.security === "basic" ? 1 : 0.7;
  const security = Math.round((state.expectedAttendance / 100) * securityBasePer100 * securityTierMultiplier);

  const productionFromModules = moduleConfig.reduce((sum, mod) => {
    const tier = state.modules[mod.key];
    return sum + mod.baseCost * moduleTierMultiplier[tier];
  }, 0);
  const production = Math.round(productionFromModules * footprintMultiplier[state.productionFootprint]);

  const permitMultiplier = state.permitsStatus === "yes" ? 1 : state.permitsStatus === "unknown" ? 1.28 : 1.55;
  const venueMultiplier = state.venue === "festival" || state.venue === "brand" ? 1.35 : 1;
  const permitsInsurance = Math.round(permitBase[state.environmentType] * permitMultiplier * venueMultiplier + moduleTierMultiplier[state.modules.compliance_insurance] * 900);

  const subtotal = performaFee + travel + security + production + permitsInsurance;
  const contingencyPercent = riskScore >= 70 ? 0.14 : riskScore >= 50 ? 0.1 : 0.07;
  const contingency = Math.round(subtotal * contingencyPercent);
  const total = subtotal + contingency;

  return {
    performaFee,
    travel,
    security,
    production,
    permitsInsurance,
    contingency,
    total,
    low: Math.round(total * 0.88),
    high: Math.round(total * 1.2)
  };
};

const getRiskRegister = (state: WizardState, leadTimeDays: number): RiskItem[] => {
  const risks: RiskItem[] = [];

  if (leadTimeDays > 0 && leadTimeDays < 21) {
    risks.push({
      title: "Compressed pre-production window",
      likelihood: 4,
      impact: 4,
      mitigation: "Lock vendors and permits in 48h sprint with daily checkpoints.",
      residual: 3
    });
  }

  if (state.environmentType === "outdoor") {
    risks.push({
      title: "Weather and site volatility",
      likelihood: 3,
      impact: 5,
      mitigation: "Build weather fallback and hard cover trigger at T-72.",
      residual: 3
    });
  }

  if (state.routingComplexity === "fly_in") {
    risks.push({
      title: "Travel chain delays",
      likelihood: 3,
      impact: 4,
      mitigation: "Add redundant flight windows and backup local crew.",
      residual: 2
    });
  }

  if (state.modules.security === "none" || state.modules.security === "basic") {
    risks.push({
      title: "Crowd management pressure",
      likelihood: state.expectedAttendance >= 2500 ? 4 : 3,
      impact: 4,
      mitigation: "Increase ingress staffing and add zone supervisors.",
      residual: 3
    });
  }

  if (state.permitsStatus !== "yes") {
    risks.push({
      title: "Regulatory uncertainty",
      likelihood: state.permitsStatus === "unknown" ? 3 : 5,
      impact: 4,
      mitigation: "Trigger permit desk now and appoint legal owner.",
      residual: 3
    });
  }

  risks.push({
    title: "Brand/guest expectation misalignment",
    likelihood: 2,
    impact: 3,
    mitigation: "Confirm run-of-show expectations at T-14 review.",
    residual: 2
  });

  return risks.slice(0, 6);
};

const getCompatibilityWarnings = (state: WizardState): string[] => {
  const warnings: string[] = [];

  if (state.productionFootprint === "house" && (state.modules.lighting_visuals === "premium" || state.modules.media_promo === "premium")) {
    warnings.push("House footprint may bottleneck premium lighting/media modules.");
  }

  if (state.venue === "luxury" && state.modules.talent === "premium") {
    warnings.push("Premium talent intensity may conflict with luxury pacing expectations.");
  }

  if (state.environmentType === "outdoor" && state.modules.audio === "none") {
    warnings.push("Outdoor format with no dedicated audio module increases failure risk.");
  }

  return warnings;
};

const formatMilestoneDate = (targetDate: string, minusDays: number): string => {
  if (!targetDate) return "TBD";
  const date = new Date(targetDate);
  date.setDate(date.getDate() - minusDays);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getStaffingPlan = (state: WizardState): StaffRole[] => {
  const guestScale = Math.max(1, Math.ceil(state.expectedAttendance / 750));
  const visualBoost = state.modules.lighting_visuals === "premium" ? 2 : state.modules.lighting_visuals === "enhanced" ? 1 : 0;
  const securityBoost = state.modules.security === "premium" ? 3 : state.modules.security === "enhanced" ? 2 : state.modules.security === "basic" ? 1 : 0;

  return [
    { label: "Production Manager", count: 1 },
    { label: "Stage/Deck Technicians", count: 2 + visualBoost + (state.productionFootprint === "full" ? 2 : 0) },
    { label: "Front-of-House Audio", count: 1 + (state.modules.audio !== "none" ? 1 : 0) },
    { label: "Security Team", count: guestScale + securityBoost },
    { label: "Guest Experience / VIP", count: state.modules.vip_hospitality === "none" ? 1 : 2 + (state.modules.vip_hospitality === "premium" ? 2 : 0) },
    { label: "Media / Content", count: state.modules.media_promo === "none" ? 0 : state.modules.media_promo === "basic" ? 1 : state.modules.media_promo === "enhanced" ? 2 : 3 }
  ].filter((item) => item.count > 0);
};

const nextTier = (tier: ModuleTier, direction: "down" | "up"): ModuleTier => {
  const ordered = moduleTierOptions;
  const idx = ordered.indexOf(tier);
  if (direction === "down") return ordered[Math.max(0, idx - 1)];
  return ordered[Math.min(ordered.length - 1, idx + 1)];
};

const debounceMs = 250;

export default function PerformaConciergeWizardV2() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(defaultState);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("p");
    if (encoded) {
      const decoded = base64UrlDecodeJson(encoded);
      if (decoded) {
        setState(withNumericDefaults(decoded));
      }
    }

    const stepFromUrl = Number(params.get("step") || "1");
    if (stepFromUrl >= 1 && stepFromUrl <= 6) {
      setStep(stepFromUrl);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set("p", base64UrlEncodeJson(state));
      params.set("step", String(step));
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [state, step]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const leadTimeDays = useMemo(() => calculateLeadTimeDays(state.targetDate), [state.targetDate]);
  const compatibilityWarnings = useMemo(() => getCompatibilityWarnings(state), [state]);
  const riskRegister = useMemo(() => getRiskRegister(state, leadTimeDays), [state, leadTimeDays]);

  const riskScore = useMemo(() => {
    if (!riskRegister.length) return 18;
    const weighted = riskRegister.reduce((sum, item) => sum + item.likelihood * item.impact, 0);
    const normalized = Math.round((weighted / (riskRegister.length * 25)) * 100);
    return clamp(normalized, 12, 95);
  }, [riskRegister]);

  const costBreakdown = useMemo(() => calculateCostBreakdown(state, riskScore), [state, riskScore]);

  const outputPercent = useMemo(() => calculateOutputPercent(state), [state]);
  const stageModeName = useMemo(() => {
    const base = stageModeByVenue[state.venue];
    return state.performanceTier === "cinematic" ? `${base} (Cinematic Tier)` : base;
  }, [state.venue, state.performanceTier]);

  const modulesSelected = useMemo(
    () =>
      moduleConfig
        .map((item) => ({ label: item.label, tier: state.modules[item.key] }))
        .filter((item) => item.tier !== "none"),
    [state.modules]
  );

  const timelineMilestones = useMemo(
    () => [
      { label: "T-30", date: formatMilestoneDate(state.targetDate, 30), action: "Creative lock + module finalization" },
      { label: "T-14", date: formatMilestoneDate(state.targetDate, 14), action: "Run-of-show, permits, staffing confirmation" },
      { label: "T-7", date: formatMilestoneDate(state.targetDate, 7), action: "Technical rehearsal + safety review" },
      { label: "Day-of", date: formatMilestoneDate(state.targetDate, 0), action: "Load-in, execution, post-show wrap" }
    ],
    [state.targetDate]
  );

  const staffingPlan = useMemo(() => getStaffingPlan(state), [state]);

  const revenueExpected = useMemo(() => {
    const attendance = state.expectedAttendance;
    const ticketRevenue = state.ticketPrice * attendance * (state.sellThroughPercent / 100);
    const barRevenue = attendance * 28 * (state.barSplitPercent / 100);
    return ticketRevenue + barRevenue + state.sponsorshipDollars + state.merchDollars;
  }, [state]);

  const roiExpected = useMemo(() => {
    if (costBreakdown.total <= 0) return 0;
    return Math.round(((revenueExpected - costBreakdown.total) / costBreakdown.total) * 100);
  }, [revenueExpected, costBreakdown.total]);

  const roiLow = Math.round(roiExpected * 0.72);
  const roiHigh = Math.round(roiExpected * 1.28);

  const packageOptions = useMemo(() => {
    const deriveModules = (mode: "good" | "better" | "best"): Record<ModuleKey, ModuleTier> => {
      const adjusted: Record<ModuleKey, ModuleTier> = { ...state.modules };
      if (mode === "good") {
        (Object.keys(adjusted) as ModuleKey[]).forEach((key) => {
          adjusted[key] = nextTier(adjusted[key], "down");
        });
      }
      if (mode === "best") {
        (Object.keys(adjusted) as ModuleKey[]).forEach((key) => {
          adjusted[key] = nextTier(adjusted[key], "up");
        });
      }
      return adjusted;
    };

    const calc = (label: "Good" | "Better" | "Best", mode: "good" | "better" | "best") => {
      const scenario: WizardState = { ...state, modules: deriveModules(mode) };
      const scenarioRisk = clamp(mode === "best" ? riskScore - 4 : mode === "good" ? riskScore + 6 : riskScore, 10, 99);
      const costs = calculateCostBreakdown(scenario, scenarioRisk);
      const activeModules = moduleConfig
        .filter((mod) => scenario.modules[mod.key] !== "none")
        .map((mod) => `${mod.label} (${scenario.modules[mod.key]})`);
      return {
        label,
        total: costs.total,
        low: costs.low,
        high: costs.high,
        modules: activeModules
      };
    };

    return [calc("Good", "good"), calc("Better", "better"), calc("Best", "best")];
  }, [state, riskScore]);

  const progress = Math.round((step / 6) * 100);

  const updateState = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const updateModuleTier = (key: ModuleKey, value: ModuleTier) => {
    setState((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: value
      }
    }));
  };

  const nextStep = () => setStep((value) => Math.min(6, value + 1));
  const prevStep = () => setStep((value) => Math.max(1, value - 1));

  const copyProfile = async () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("p") || base64UrlEncodeJson(state);
    const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
    await navigator.clipboard.writeText(url);
    setNotice("Event profile link copied.");
  };

  const requestAvailability = () => {
    const encoded = base64UrlEncodeJson(state);
    localStorage.setItem("the-performa-concierge-prefill-v1", encoded);
    window.location.href = `/book?p=${encoded}`;
  };

  const printBlueprint = () => {
    window.print();
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <style>{`
        @media print {
          .concierge-no-print { display: none !important; }
          .concierge-blueprint { border: 1px solid #999 !important; background: #fff !important; color: #111 !important; }
        }
      `}</style>

      <div className="rounded-[2rem] border border-white/15 bg-black/45 p-6 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.34em] text-gold/80">Promoter Tool</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">Performa Party Concierge™</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/72 md:text-base">
          Configure the event stack step by step, then export a promoter-ready Event Blueprint.
        </p>
      </div>

      <div className="mt-5 rounded-3xl border border-white/15 bg-black/35 p-4">
        <div className="flex items-center justify-between text-xs text-white/65">
          <span>Step {step} / 6</span>
          <span>{progress}% complete</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-[1.8rem] border border-white/15 bg-black/45 p-5">
          {step === 1 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">1) Venue Type + Event Basics</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {venueOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateState("venue", item.key)}
                    className={`rounded-2xl border p-3 text-left min-h-11 transition ${
                      state.venue === item.key ? "border-gold/70 bg-gold/10 shadow-[0_0_26px_rgba(243,211,139,0.2)]" : "border-white/15 bg-black/35"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]">{item.label}</p>
                    <p className="mt-1 text-[11px] text-white/58">{item.caption}</p>
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={state.eventName} onChange={(e) => updateState("eventName", e.target.value)} placeholder="Event name" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input value={state.cityState} onChange={(e) => updateState("cityState", e.target.value)} placeholder="City / State" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="date" value={state.targetDate} onChange={(e) => updateState("targetDate", e.target.value)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={50} value={state.expectedAttendance} onChange={(e) => updateState("expectedAttendance", Math.max(50, Number(e.target.value || 50)))} placeholder="Expected attendance" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <select value={state.ticketingModel} onChange={(e) => updateState("ticketingModel", e.target.value as TicketingModel)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {ticketingOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={state.doorsTime} onChange={(e) => updateState("doorsTime", e.target.value)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" title="Doors time" />
                  <input type="time" value={state.setTime} onChange={(e) => updateState("setTime", e.target.value)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" title="Set time" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">2) Performance Core</p>
              <div className="mt-3 grid gap-2">
                {tierOptions.map((item) => (
                  <button key={item.key} type="button" onClick={() => updateState("performanceTier", item.key)} className={`rounded-2xl border p-3 text-left min-h-11 transition ${state.performanceTier === item.key ? "border-gold/70 bg-gold/10" : "border-white/15 bg-black/35"}`}>
                    <p className="text-xs uppercase tracking-[0.2em]">{item.label}</p>
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={state.setLength} onChange={(e) => updateState("setLength", Number(e.target.value) as SetLength)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {setLengthOptions.map((len) => (
                    <option key={len} value={len}>{len} min set length</option>
                  ))}
                </select>
                <select value={state.productionFootprint} onChange={(e) => updateState("productionFootprint", e.target.value as ProductionFootprint)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {footprintOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label} footprint</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">3) Experience Modules</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {moduleConfig.map((item) => (
                  <label key={item.key} className="rounded-2xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/70">{item.label}</span>
                    <select value={state.modules[item.key]} onChange={(e) => updateModuleTier(item.key, e.target.value as ModuleTier)} className="w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11 text-xs">
                      {moduleTierOptions.map((tier) => (
                        <option key={tier} value={tier}>{tier}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {compatibilityWarnings.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-3 text-xs text-amber-100/90">
                  <p className="uppercase tracking-[0.2em]">Compatibility Warnings</p>
                  <ul className="mt-2 space-y-1">
                    {compatibilityWarnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">4) Logistics & Timeline</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={state.loadInWindow} onChange={(e) => updateState("loadInWindow", e.target.value as LoadInWindow)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {loadInOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <select value={state.routingComplexity} onChange={(e) => updateState("routingComplexity", e.target.value as RoutingComplexity)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {routingOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label} routing</option>
                  ))}
                </select>
                <select value={state.permitsStatus} onChange={(e) => updateState("permitsStatus", e.target.value as PermitStatus)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {permitOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <select value={state.environmentType} onChange={(e) => updateState("environmentType", e.target.value as EnvironmentType)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {environmentOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-3 rounded-2xl border border-white/15 bg-black/35 p-3 text-xs text-white/75">
                <p>Lead time: {leadTimeDays > 0 ? `${leadTimeDays} days until event` : "Set a target date for lead-time analysis"}</p>
                <p className="mt-1">Milestones auto-populate in Event Blueprint.</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">5) Budget & Commercial Model</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={state.budgetBand} onChange={(e) => updateState("budgetBand", e.target.value as BudgetBand)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {budgetOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <select value={state.costOwnership} onChange={(e) => updateState("costOwnership", e.target.value as CostOwnership)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11">
                  {ownershipOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <input type="number" min={0} value={state.ticketPrice} onChange={(e) => updateState("ticketPrice", Math.max(0, Number(e.target.value || 0)))} placeholder="Ticket price" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={0} max={100} value={state.sellThroughPercent} onChange={(e) => updateState("sellThroughPercent", clamp(Number(e.target.value || 0), 0, 100))} placeholder="Sell-through %" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={0} value={state.sponsorshipDollars} onChange={(e) => updateState("sponsorshipDollars", Math.max(0, Number(e.target.value || 0)))} placeholder="Sponsorship $" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={0} max={100} value={state.barSplitPercent} onChange={(e) => updateState("barSplitPercent", clamp(Number(e.target.value || 0), 0, 100))} placeholder="Bar split %" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={0} value={state.merchDollars} onChange={(e) => updateState("merchDollars", Math.max(0, Number(e.target.value || 0)))} placeholder="Merch $" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11 sm:col-span-2" />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                {packageOptions.map((pkg) => (
                  <div key={pkg.label} className="rounded-2xl border border-white/15 bg-black/35 p-3">
                    <p className="uppercase tracking-[0.22em] text-white/65">{pkg.label}</p>
                    <p className="mt-1 text-sm text-white">{toCurrency(pkg.total)}</p>
                    <p className="text-[11px] text-white/55">{toCurrency(pkg.low)} - {toCurrency(pkg.high)}</p>
                    <p className="mt-2 text-[11px] text-white/55">{pkg.modules.slice(0, 2).join(", ") || "Base modules"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">6) ROI + Risk Preview</p>
              <div className="mt-3 rounded-2xl border border-white/15 bg-black/35 p-4 text-sm text-white/75">
                <p>ROI scenarios use ticket, sponsorship, bar split, and merch assumptions.</p>
                <p className="mt-1">Risk register includes top operational constraints and mitigation plans.</p>
                <p className="mt-2">Expected ROI: <span className="text-white">{roiExpected}%</span></p>
                <p>Risk Score: <span className="text-white">{riskScore}/100</span></p>
              </div>
            </div>
          )}

          <div className="concierge-no-print mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={prevStep} disabled={step === 1} className="min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.22em] disabled:opacity-40">Back</button>
            <button type="button" onClick={nextStep} disabled={step === 6} className="min-h-11 rounded-full bg-ember px-5 py-2 text-xs uppercase tracking-[0.22em] text-ink disabled:opacity-40">Next</button>
          </div>
        </article>

        <article className="concierge-blueprint rounded-[1.8rem] border border-white/15 bg-black/45 p-5 transition-opacity duration-200 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Event Blueprint</p>
          <h2 className="mt-3 text-2xl font-semibold">{state.eventName || "Untitled Event"}</h2>
          <p className="mt-1 text-xs text-white/60">{state.cityState || "City / State"} • {state.targetDate || "Date TBD"} • {state.expectedAttendance.toLocaleString()} expected attendees</p>

          <div className="mt-4 space-y-3 text-sm text-white/72">
            <p><span className="text-white/48">Stage Mode:</span> {stageModeName} - {outputPercent}% Output</p>
            <p><span className="text-white/48">Recommended For:</span> {recommendedForByVenue[state.venue]}</p>
            <p><span className="text-white/48">Modules:</span> {modulesSelected.length ? modulesSelected.map((mod) => `${mod.label} (${mod.tier})`).join(", ") : "Base package only"}</p>

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 text-xs">
              <p className="uppercase tracking-[0.2em] text-white/55">Cost Breakdown</p>
              <div className="mt-2 grid grid-cols-2 gap-y-1">
                <span className="text-white/55">Performa fee</span><span>{toCurrency(costBreakdown.performaFee)}</span>
                <span className="text-white/55">Travel</span><span>{toCurrency(costBreakdown.travel)}</span>
                <span className="text-white/55">Security</span><span>{toCurrency(costBreakdown.security)}</span>
                <span className="text-white/55">Production</span><span>{toCurrency(costBreakdown.production)}</span>
                <span className="text-white/55">Permits/Insurance</span><span>{toCurrency(costBreakdown.permitsInsurance)}</span>
                <span className="text-white/55">Contingency</span><span>{toCurrency(costBreakdown.contingency)}</span>
                <span className="text-white">Total Range</span><span>{toCurrency(costBreakdown.low)} - {toCurrency(costBreakdown.high)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 text-xs">
              <p className="uppercase tracking-[0.2em] text-white/55">Timeline + Staffing</p>
              <p className="mt-1 text-white/70">Lead time: {leadTimeDays > 0 ? `${leadTimeDays} days` : "TBD"}</p>
              <div className="mt-2 space-y-1">
                {timelineMilestones.map((item) => (
                  <p key={item.label}><span className="text-white/55">{item.label} ({item.date}):</span> {item.action}</p>
                ))}
              </div>
              <p className="mt-2 text-white/55">Staffing:</p>
              <div className="grid grid-cols-2 gap-y-1">
                {staffingPlan.map((role) => (
                  <div key={role.label} className="contents">
                    <span className="text-white/55">{role.label}</span>
                    <span>{role.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 text-xs">
              <p className="uppercase tracking-[0.2em] text-white/55">ROI Scenarios</p>
              <p className="mt-1">Low: {roiLow}% | Expected: {roiExpected}% | High: {roiHigh}%</p>
              <p className="mt-1 text-white/55">Assumptions: ${state.ticketPrice} avg ticket, {state.sellThroughPercent}% sell-through, {toCurrency(state.sponsorshipDollars)} sponsorship, {state.barSplitPercent}% bar split, {toCurrency(state.merchDollars)} merch.</p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 text-xs">
              <p className="uppercase tracking-[0.2em] text-white/55">Risk Register</p>
              <p className="mt-1 text-white/70">Risk Score: {riskScore}/100</p>
              <div className="mt-2 space-y-2">
                {riskRegister.slice(0, 6).map((risk) => (
                  <div key={risk.title} className="rounded-xl border border-white/10 bg-black/25 p-2">
                    <p className="text-white/85">{risk.title}</p>
                    <p className="text-white/55">L{risk.likelihood} / I{risk.impact} | Residual {risk.residual}</p>
                    <p className="text-white/60">Mitigation: {risk.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 text-xs">
              <p className="uppercase tracking-[0.2em] text-white/55">Dependencies + Next Actions</p>
              <p className="mt-1">1) Confirm permits, insurance, and venue lock.</p>
              <p>2) Finalize module owners and production call sheet.</p>
              <p>3) Approve commercial package and move to booking.</p>
            </div>
          </div>

          <div className="concierge-no-print mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={requestAvailability} className="inline-flex min-h-11 items-center rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink">Request Availability</button>
            <a href="/media/press-kit.pdf" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-6 py-3 text-xs uppercase tracking-[0.28em] text-white/80">Download Event Brief</a>
            <button type="button" onClick={printBlueprint} className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-6 py-3 text-xs uppercase tracking-[0.28em] text-white/80">Print / Save PDF</button>
            <button type="button" onClick={copyProfile} className="inline-flex min-h-11 items-center rounded-full border border-gold/45 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold">Copy Event Profile Link</button>
          </div>
          {notice && <p className="mt-2 text-xs text-gold">{notice}</p>}
        </article>
      </div>
    </section>
  );
}
