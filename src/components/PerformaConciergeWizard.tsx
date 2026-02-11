import { useEffect, useMemo, useState } from "react";

type VenueType = "club" | "festival" | "warehouse" | "luxury" | "brand";
type PerformanceTier = "core" | "headline" | "cinematic";
type BudgetBand = "starter" | "growth" | "premium" | "flagship";

const venueOptions: Array<{ key: VenueType; label: string; caption: string }> = [
  { key: "club", label: "Club Night", caption: "High-density nightlife events" },
  { key: "festival", label: "Festival Mainstage", caption: "Large scale crowd impact" },
  { key: "warehouse", label: "Warehouse Afterhours", caption: "Immersive ritual pacing" },
  { key: "luxury", label: "Private Luxury Event", caption: "Concierge premium environments" },
  { key: "brand", label: "Brand Experience", caption: "Campaign and activation format" }
];

const tierOptions: Array<{ key: PerformanceTier; label: string; feeMultiplier: number; timelineDays: number }> = [
  { key: "core", label: "Core Performance Tier", feeMultiplier: 1, timelineDays: 14 },
  { key: "headline", label: "Headline Show Tier", feeMultiplier: 1.35, timelineDays: 21 },
  { key: "cinematic", label: "Cinematic Performa Tier", feeMultiplier: 1.75, timelineDays: 30 }
];

const moduleOptions = [
  { key: "lighting", label: "Lighting Program", cost: 6000, risk: 4, roi: 6 },
  { key: "venue_sourcing", label: "Venue Sourcing", cost: 4200, risk: 5, roi: 5 },
  { key: "hype_team", label: "Hype Team", cost: 3500, risk: 6, roi: 8 },
  { key: "security", label: "Security Operations", cost: 5200, risk: 2, roi: 3 },
  { key: "media", label: "Media Capture", cost: 6800, risk: 4, roi: 7 }
] as const;

type ModuleKey = (typeof moduleOptions)[number]["key"];

const budgetOptions: Array<{ key: BudgetBand; label: string; min: number; max: number }> = [
  { key: "starter", label: "$20k-$40k", min: 20000, max: 40000 },
  { key: "growth", label: "$40k-$80k", min: 40000, max: 80000 },
  { key: "premium", label: "$80k-$150k", min: 80000, max: 150000 },
  { key: "flagship", label: "$150k+", min: 150000, max: 260000 }
];

const stageModeByVenue: Record<VenueType, string> = {
  club: "Neon Pressure",
  festival: "Festival Surge Protocol",
  warehouse: "Afterhours Overdrive",
  luxury: "Luxury Ignition Suite",
  brand: "Cinematic Impact Mode"
};

const topRisksByVenue: Record<VenueType, string[]> = {
  club: ["Ingress bottlenecks", "Local sound curfew", "Peak-hour staffing"],
  festival: ["Weather volatility", "Stage turnover compression", "Crowd surge management"],
  warehouse: ["Permitting variance", "Load-in constraints", "Late-night transport cadence"],
  luxury: ["Noise sensitivity", "Guest-flow discretion", "Concierge timeline precision"],
  brand: ["Sponsor deliverable lock", "Show-call timing precision", "Talent content approvals"]
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const parseBool = (value: string | null) => value === "1";

export default function PerformaConciergeWizard() {
  const [step, setStep] = useState(1);
  const [venue, setVenue] = useState<VenueType>("warehouse");
  const [tier, setTier] = useState<PerformanceTier>("headline");
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    lighting: true,
    venue_sourcing: false,
    hype_team: true,
    security: true,
    media: true
  });
  const [eventDate, setEventDate] = useState("");
  const [city, setCity] = useState("");
  const [guestCount, setGuestCount] = useState(1200);
  const [budget, setBudget] = useState<BudgetBand>("premium");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextStep = Number(params.get("step") || "1");
    const venueParam = params.get("venue") as VenueType | null;
    const tierParam = params.get("tier") as PerformanceTier | null;
    const budgetParam = params.get("budget") as BudgetBand | null;
    const guestParam = Number(params.get("guests") || "1200");

    if (nextStep >= 1 && nextStep <= 6) setStep(nextStep);
    if (venueParam && venueOptions.some((item) => item.key === venueParam)) setVenue(venueParam);
    if (tierParam && tierOptions.some((item) => item.key === tierParam)) setTier(tierParam);
    if (budgetParam && budgetOptions.some((item) => item.key === budgetParam)) setBudget(budgetParam);
    if (Number.isFinite(guestParam) && guestParam > 0) setGuestCount(guestParam);

    setEventDate(params.get("date") || "");
    setCity(params.get("city") || "");

    const nextModules: Record<ModuleKey, boolean> = {
      lighting: parseBool(params.get("m_lighting")) || false,
      venue_sourcing: parseBool(params.get("m_venue_sourcing")) || false,
      hype_team: parseBool(params.get("m_hype_team")) || false,
      security: parseBool(params.get("m_security")) || false,
      media: parseBool(params.get("m_media")) || false
    };
    if (Object.values(nextModules).some(Boolean)) setModules(nextModules);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("step", String(step));
    params.set("venue", venue);
    params.set("tier", tier);
    params.set("budget", budget);
    params.set("guests", String(guestCount));
    if (eventDate) params.set("date", eventDate);
    if (city.trim()) params.set("city", city.trim());
    (Object.keys(modules) as ModuleKey[]).forEach((key) => {
      params.set(`m_${key}`, modules[key] ? "1" : "0");
    });
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [step, venue, tier, budget, guestCount, eventDate, city, modules]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedTier = useMemo(() => tierOptions.find((item) => item.key === tier) || tierOptions[1], [tier]);
  const selectedBudget = useMemo(() => budgetOptions.find((item) => item.key === budget) || budgetOptions[2], [budget]);
  const selectedModules = useMemo(
    () => moduleOptions.filter((item) => modules[item.key]),
    [modules]
  );

  const blueprint = useMemo(() => {
    const baseCost = 22000;
    const guestFactor = Math.max(0.7, guestCount / 1200);
    const moduleCost = selectedModules.reduce((sum, item) => sum + item.cost, 0);
    const expected = Math.round((baseCost * selectedTier.feeMultiplier + moduleCost) * guestFactor);
    const low = Math.round(expected * 0.82);
    const high = Math.round(expected * 1.28);
    const timeline = selectedTier.timelineDays + selectedModules.length * 2;
    const roiBoost = selectedModules.reduce((sum, item) => sum + item.roi, 0) + (budget === "flagship" ? 8 : 0);
    const riskBase = selectedModules.reduce((sum, item) => sum + item.risk, 0) + (guestCount > 3000 ? 8 : 2);
    const riskScore = Math.max(8, Math.min(96, riskBase + (selectedBudget.max < expected ? 12 : 0)));
    const roiExpected = Math.round(115 + roiBoost + (guestCount > 2000 ? 12 : 0));
    const roiLow = Math.round(roiExpected * 0.72);
    const roiHigh = Math.round(roiExpected * 1.34);

    return {
      stageMode: stageModeByVenue[venue],
      modules: selectedModules.map((item) => item.label),
      costLow: low,
      costExpected: expected,
      costHigh: high,
      timelineDays: timeline,
      roiLow,
      roiExpected,
      roiHigh,
      riskScore,
      topRisks: topRisksByVenue[venue]
    };
  }, [guestCount, selectedModules, selectedTier, selectedBudget, venue, budget]);

  const progress = Math.round((step / 6) * 100);

  const nextStep = () => setStep((value) => Math.min(6, value + 1));
  const prevStep = () => setStep((value) => Math.max(1, value - 1));

  const toggleModule = (key: ModuleKey) => {
    setModules((current) => ({ ...current, [key]: !current[key] }));
  };

  const copyProfile = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setNotice("Event profile link copied.");
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
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
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">1) Venue Type</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {venueOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setVenue(item.key)}
                    className={`rounded-2xl border p-3 text-left min-h-11 transition ${
                      venue === item.key ? "border-gold/70 bg-gold/10 shadow-[0_0_26px_rgba(243,211,139,0.2)]" : "border-white/15 bg-black/35"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]">{item.label}</p>
                    <p className="mt-1 text-[11px] text-white/58">{item.caption}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">2) Chip Lee Performance Tier</p>
              <div className="mt-3 grid gap-2">
                {tierOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTier(item.key)}
                    className={`rounded-2xl border p-3 text-left min-h-11 transition ${tier === item.key ? "border-gold/70 bg-gold/10" : "border-white/15 bg-black/35"}`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]">{item.label}</p>
                    <p className="mt-1 text-[11px] text-white/58">Timeline baseline: {item.timelineDays} days</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">3) Experience Modules</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {moduleOptions.map((item) => (
                  <label key={item.key} className="rounded-2xl border border-white/15 bg-black/35 p-3 text-sm text-white/80">
                    <span className="flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <input type="checkbox" checked={modules[item.key]} onChange={() => toggleModule(item.key)} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">4) Timeline + Logistics Inputs</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City / Market" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11" />
                <input type="number" min={50} value={guestCount} onChange={(e) => setGuestCount(Math.max(50, Number(e.target.value || 50)))} placeholder="Projected guests" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 min-h-11 sm:col-span-2" />
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">5) Budget Band Selection</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {budgetOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setBudget(item.key)}
                    className={`rounded-2xl border p-3 text-left min-h-11 transition ${budget === item.key ? "border-gold/70 bg-gold/10" : "border-white/15 bg-black/35"}`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]">{item.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">6) ROI + Risk Preview</p>
              <div className="mt-3 rounded-2xl border border-white/15 bg-black/35 p-4 text-sm text-white/75">
                <p>Projected ROI range is based on tier, modules, and crowd volume.</p>
                <p className="mt-2">Risk score reflects execution complexity and operational pressure points.</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={prevStep} disabled={step === 1} className="min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.22em] disabled:opacity-40">
              Back
            </button>
            <button type="button" onClick={nextStep} disabled={step === 6} className="min-h-11 rounded-full bg-ember px-5 py-2 text-xs uppercase tracking-[0.22em] text-ink disabled:opacity-40">
              Next
            </button>
          </div>
        </article>

        <article className="rounded-[1.8rem] border border-white/15 bg-black/45 p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Event Blueprint</p>
          <h2 className="mt-3 text-2xl font-semibold">{blueprint.stageMode}</h2>
          <div className="mt-4 space-y-3 text-sm text-white/72">
            <p><span className="text-white/48">Modules:</span> {blueprint.modules.length ? blueprint.modules.join(", ") : "Base package only"}</p>
            <p><span className="text-white/48">Cost Estimate:</span> {toCurrency(blueprint.costLow)} - {toCurrency(blueprint.costHigh)} (expected {toCurrency(blueprint.costExpected)})</p>
            <p><span className="text-white/48">Timeline Estimate:</span> {blueprint.timelineDays} days production runway</p>
            <p><span className="text-white/48">ROI Projection:</span> low {blueprint.roiLow}% / expected {blueprint.roiExpected}% / high {blueprint.roiHigh}%</p>
            <p><span className="text-white/48">Risk Score:</span> {blueprint.riskScore}/100</p>
            <p><span className="text-white/48">Top Risks:</span> {blueprint.topRisks.join(", ")}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/book" className="inline-flex min-h-11 items-center rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink">
              Request Availability
            </a>
            <a href="/media/press-kit.pdf" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-6 py-3 text-xs uppercase tracking-[0.28em] text-white/80">
              Download Event Brief
            </a>
            <button type="button" onClick={copyProfile} className="inline-flex min-h-11 items-center rounded-full border border-gold/45 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold">
              Copy Event Profile Link
            </button>
          </div>
          {notice && <p className="mt-2 text-xs text-gold">{notice}</p>}
        </article>
      </div>
    </section>
  );
}
