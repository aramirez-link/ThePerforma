import { DEFAULT_PERFORMANCE_PRICING_PROFILE, type PerformancePricingProfile } from "../../lib/performancePricing";

export type EventType =
  | "club-night"
  | "festival-mainstage"
  | "warehouse-afterhours"
  | "private-luxury-event"
  | "brand-experience"
  | "cultural-celebration"
  | "corporate-vip"
  | "custom-event";

export type VenueType =
  | "nightclub"
  | "festival-stage"
  | "warehouse"
  | "private-estate"
  | "hotel-rooftop"
  | "brand-activation-space"
  | "cultural-venue"
  | "other";

export type TicketingModel = "ticketed" | "private-invite" | "guest-list" | "mixed";
export type ProductionAmbition = "essential" | "elevated" | "headline" | "immersive";
export type BudgetSignal = "exploring" | "40k-75k" | "75k-150k" | "150k-300k" | "300k-plus";
export type NextStepIntent = "availability-review" | "schedule-call" | "email-package" | "save-follow-up";
export type ContactPreference = "email" | "phone" | "text";
export type SessionStatus = "draft" | "estimate_ready" | "submitted" | "emailed" | "follow_up";
export type PackageTier = "signature-set" | "elevated-experience" | "full-performa-experience" | "custom-production-experience";

export type EstimateLine = {
  label: string;
  low: number;
  high: number;
  note: string;
};

export type EstimateBreakdown = {
  lines: EstimateLine[];
  totalLow: number;
  totalHigh: number;
  confidenceNote: string;
};

export type PackageRecommendation = {
  tier: PackageTier;
  label: string;
  rationale: string;
  components: string[];
  nextStep: NextStepIntent;
};

export type ProposalBrief = {
  title: string;
  pricingProfileKey: string;
  pricingProfileName: string;
  artistName: string;
  summary: string;
  package: {
    tier: PackageTier;
    label: string;
    rationale: string;
    components: string[];
  };
  investment: {
    currency: string;
    totalLow: number;
    totalHigh: number;
    confidenceNote: string;
    depositPercent: number;
    balanceDueDays: number;
    holdWindowDays: number;
    proposalValidityDays: number;
  };
  staffingAssumptions: string[];
  dependencies: string[];
  proposalSections: Array<{ key: string; label: string; guidance: string }>;
  bookingProfile: {
    performanceFormats: string[];
    deliverables: string[];
    technicalRequirements: string[];
    hospitalityRequirements: string[];
    bookingRequirements: string[];
    minimumLeadTimeDays: number;
    defaultSetLengthMinutes: number;
    typicalPerformanceWindowMinutes: number;
    soundcheckRequired: boolean;
    meetAndGreetAvailable: boolean;
    contentCapturePolicy: string;
  };
  nextStep: {
    value: NextStepIntent;
    label: string;
  };
};

export type BookingSession = {
  sessionId: string;
  status: SessionStatus;
  eventType: EventType | "";
  venueType: VenueType | "";
  eventName: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  targetDate: string;
  attendeeCount: number | null;
  ticketingModel: TicketingModel | "";
  audienceDescription: string;
  vibeProfile: string;
  productionAmbition: ProductionAmbition | "";
  budgetSignal: BudgetSignal | "";
  nextStepIntent: NextStepIntent | "";
  liveElements: string[];
  productionNeeds: string[];
  wantsBrandIntegration: boolean | null;
  wantsHostMoments: boolean | null;
  languageConsiderations: string;
  packagePreference: PackageTier | "";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organization: string;
  role: string;
  contactPreference: ContactPreference | "";
  followUpConsent: boolean;
  outreachConsent: boolean;
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
};

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string; caption: string }> = [
  { value: "club-night", label: "Club Night", caption: "Late-night energy and strong room identity." },
  { value: "festival-mainstage", label: "Festival Mainstage", caption: "Large audience impact with headline pacing." },
  { value: "warehouse-afterhours", label: "Warehouse Afterhours", caption: "Immersive movement-led nightlife format." },
  { value: "private-luxury-event", label: "Private Luxury Event", caption: "Concierge atmosphere for premium guests." },
  { value: "brand-experience", label: "Brand Experience", caption: "Culture-forward activation with visual polish." },
  { value: "cultural-celebration", label: "Cultural Celebration", caption: "Cross-cultural programming and communal energy." },
  { value: "corporate-vip", label: "Corporate / VIP Experience", caption: "Executive or client-facing event environments." },
  { value: "custom-event", label: "Custom Event", caption: "Built around a one-off brief or special concept." }
];

export const VENUE_TYPE_OPTIONS: Array<{ value: VenueType; label: string }> = [
  { value: "nightclub", label: "Nightclub" },
  { value: "festival-stage", label: "Festival Stage" },
  { value: "warehouse", label: "Warehouse" },
  { value: "private-estate", label: "Private Estate" },
  { value: "hotel-rooftop", label: "Hotel / Rooftop" },
  { value: "brand-activation-space", label: "Brand Activation Space" },
  { value: "cultural-venue", label: "Cultural Venue" },
  { value: "other", label: "Other" }
];

export const TICKETING_OPTIONS: Array<{ value: TicketingModel; label: string }> = [
  { value: "ticketed", label: "Ticketed" },
  { value: "private-invite", label: "Private / Invite Only" },
  { value: "guest-list", label: "Guest List" },
  { value: "mixed", label: "Mixed" }
];

export const VIBE_OPTIONS = [
  "Luxurious and high-energy",
  "Cinematic and immersive",
  "Global and celebratory",
  "Fashion-forward and editorial",
  "Late-night and kinetic",
  "Elegant with crowd interaction"
];

export const AMBITION_OPTIONS: Array<{ value: ProductionAmbition; label: string; caption: string }> = [
  { value: "essential", label: "Essential", caption: "Refined booking with smart production support." },
  { value: "elevated", label: "Elevated", caption: "Premium nightlife feel with stronger visual ambition." },
  { value: "headline", label: "Headline", caption: "Larger room impact with visible production lift." },
  { value: "immersive", label: "Immersive", caption: "The full Performa environment with major experiential build." }
];

export const LIVE_ELEMENT_OPTIONS = [
  "Live musicians",
  "Choreography / dancers",
  "Interactive crowd moments",
  "MC / host moments",
  "Cultural rhythm integration",
  "Visual cues synced to performance"
];

export const PRODUCTION_NEED_OPTIONS = [
  "Lighting enhancement",
  "Visual content / LED support",
  "Sound reinforcement",
  "Stage design",
  "Travel / routing support",
  "Security planning",
  "Insurance / permits guidance",
  "Brand integration"
];

export const BUDGET_OPTIONS: Array<{ value: BudgetSignal; label: string }> = [
  { value: "exploring", label: "Still exploring" },
  { value: "40k-75k", label: "$40k - $75k" },
  { value: "75k-150k", label: "$75k - $150k" },
  { value: "150k-300k", label: "$150k - $300k" },
  { value: "300k-plus", label: "$300k+" }
];

export const NEXT_STEP_OPTIONS: Array<{ value: NextStepIntent; label: string }> = [
  { value: "availability-review", label: "Request availability review" },
  { value: "schedule-call", label: "Schedule booking / production call" },
  { value: "email-package", label: "Email me the package" },
  { value: "save-follow-up", label: "Save it and follow up later" }
];

export const CONTACT_PREFERENCE_OPTIONS: Array<{ value: ContactPreference; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" }
];

const resolvePricingProfile = (profile?: PerformancePricingProfile | null) => profile || DEFAULT_PERFORMANCE_PRICING_PROFILE;

const getEventRate = (eventType: EventType, profile?: PerformancePricingProfile | null) =>
  resolvePricingProfile(profile).eventTypeRates.find((item) => item.eventType === eventType) ||
  resolvePricingProfile(profile).eventTypeRates.find((item) => item.eventType === "custom-event") ||
  resolvePricingProfile(profile).eventTypeRates[0];

const getAttendanceMultiplier = (count: number | null, profile?: PerformancePricingProfile | null) => {
  const attendance = count || 500;
  return resolvePricingProfile(profile).attendanceBands.find((item) => attendance <= item.maxAttendees)?.multiplier || 1;
};

const getAmbitionMultiplier = (ambition: ProductionAmbition, profile?: PerformancePricingProfile | null) =>
  resolvePricingProfile(profile).ambitionMultipliers.find((item) => item.ambition === ambition)?.multiplier || 1;

const getTravelZone = (zone: "local" | "regional" | "fly", profile?: PerformancePricingProfile | null) =>
  resolvePricingProfile(profile).travelZones.find((item) => item.zone === zone) ||
  resolvePricingProfile(profile).travelZones.find((item) => item.zone === "regional") ||
  resolvePricingProfile(profile).travelZones[0];

const sumAdders = (keys: string[], rows: Array<{ key: string; adderCents: number }>) =>
  keys.reduce((sum, key) => sum + (rows.find((row) => row.key === key)?.adderCents || 0), 0);

const getPermitAllowance = (eventType: EventType, profile?: PerformancePricingProfile | null) => {
  const active = resolvePricingProfile(profile);
  return (
    active.permitAllowances.find((item) => item.eventTypes.includes(eventType)) ||
    active.permitAllowances.find((item) => item.key === "default") ||
    active.permitAllowances[0]
  );
};

const getPackageTierConfig = (
  session: BookingSession,
  attendeeCount: number,
  ambition: ProductionAmbition,
  liveCount: number,
  productionCount: number,
  profile?: PerformancePricingProfile | null
) => {
  const tiers = [...resolvePricingProfile(profile).packageTiers].sort((a, b) => a.routeRank - b.routeRank);
  let selected = tiers[0];
  for (const tier of tiers) {
    const signals = [
      tier.minimumAttendees > 0 ? attendeeCount > tier.minimumAttendees : false,
      tier.minimumProductionNeeds > 0 ? productionCount >= tier.minimumProductionNeeds : false,
      tier.minimumLiveElements > 0 ? liveCount >= tier.minimumLiveElements : false,
      tier.requiredAmbitions.length ? tier.requiredAmbitions.includes(ambition) : false,
      tier.requiredEventTypes.length && session.eventType ? tier.requiredEventTypes.includes(session.eventType) : false
    ];
    if (!signals.some(Boolean) && tier.routeRank !== 1) continue;
    selected = tier;
  }
  return selected;
};

export const defaultBookingSession = (): BookingSession => {
  const now = new Date().toISOString();
  return {
    sessionId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `booking_${Date.now()}`,
    status: "draft",
    eventType: "",
    venueType: "",
    eventName: "",
    locationCity: "",
    locationState: "",
    locationCountry: "USA",
    targetDate: "",
    attendeeCount: null,
    ticketingModel: "",
    audienceDescription: "",
    vibeProfile: "",
    productionAmbition: "",
    budgetSignal: "",
    nextStepIntent: "",
    liveElements: [],
    productionNeeds: [],
    wantsBrandIntegration: null,
    wantsHostMoments: null,
    languageConsiderations: "",
    packagePreference: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    organization: "",
    role: "",
    contactPreference: "",
    followUpConsent: false,
    outreachConsent: false,
    aiSummary: "",
    createdAt: now,
    updatedAt: now
  };
};

export const getAnsweredCount = (session: BookingSession) => {
  const checks = [
    Boolean(session.eventType),
    Boolean(session.venueType),
    Boolean(session.locationCity),
    Boolean(session.targetDate),
    Boolean(session.attendeeCount),
    Boolean(session.ticketingModel),
    Boolean(session.audienceDescription),
    Boolean(session.vibeProfile),
    Boolean(session.productionAmbition),
    session.liveElements.length > 0,
    session.productionNeeds.length > 0,
    Boolean(session.budgetSignal),
    Boolean(session.nextStepIntent)
  ];
  return checks.filter(Boolean).length;
};

export const getProgressPercent = (session: BookingSession) => Math.round((getAnsweredCount(session) / 13) * 100);

const getTravelTier = (session: BookingSession) => {
  const country = session.locationCountry.trim().toLowerCase();
  const state = session.locationState.trim().toLowerCase();
  if (!session.locationCity) return "regional";
  if (country && country !== "usa" && country !== "united states" && country !== "united states of america") return "fly";
  if (state === "ga" || state === "georgia") return "local";
  return "regional";
};

export const getRecommendedPackage = (session: BookingSession, profile?: PerformancePricingProfile | null): PackageRecommendation => {
  const attendeeCount = session.attendeeCount || 500;
  const ambition = (session.productionAmbition || "elevated") as ProductionAmbition;
  const liveCount = session.liveElements.length;
  const productionCount = session.productionNeeds.length;
  const tierConfig = getPackageTierConfig(session, attendeeCount, ambition, liveCount, productionCount, profile);
  const tier = String(tierConfig?.tier || "signature-set") as PackageTier;
  const defaultNextStep = String(tierConfig?.defaultNextStep || "availability-review") as NextStepIntent;
  const nextStep: NextStepIntent = defaultNextStep === "schedule-call" ? "schedule-call" : session.nextStepIntent || defaultNextStep;

  return {
    tier,
    label: tierConfig?.label || "Signature Set",
    rationale: tierConfig?.rationale || "Refined booking fit for the current scope.",
    components: tierConfig?.components || ["Core Performa performance"],
    nextStep
  };
};

export const getEstimateBreakdown = (session: BookingSession, profile?: PerformancePricingProfile | null): EstimateBreakdown => {
  const active = resolvePricingProfile(profile);
  const eventType = (session.eventType || "custom-event") as EventType;
  const ambition = (session.productionAmbition || "elevated") as ProductionAmbition;
  const attendeeCount = session.attendeeCount || 500;
  const attendanceMultiplier = getAttendanceMultiplier(attendeeCount, active);
  const ambitionMultiplier = getAmbitionMultiplier(ambition, active);
  const eventRate = getEventRate(eventType, active);
  const performanceBase = eventRate.baseFeeCents * attendanceMultiplier * ambitionMultiplier;

  const travelTier = getTravelTier(session);
  const travelRange = getTravelZone(travelTier, active);
  const liveElementAdder = sumAdders(session.liveElements, active.liveElementRates);
  const productionAdder = sumAdders(session.productionNeeds, active.productionNeedRates);
  const productionBaseLow = 6000 * (ambitionMultiplier - 0.05) + productionAdder + liveElementAdder;
  const productionBaseHigh = 10000 * ambitionMultiplier + productionAdder * 1.25 + liveElementAdder * 1.3;
  const staffingLow =
    active.staffingFormula.baseLowCents +
    Math.max(0, session.liveElements.length - 1) * active.staffingFormula.liveElementSupportLowCents +
    (attendeeCount > active.staffingFormula.largeRoomThreshold ? active.staffingFormula.largeRoomLowAdderCents : 0);
  const staffingHigh = staffingLow + active.staffingFormula.baseHighCents + session.productionNeeds.length * active.staffingFormula.productionNeedHighAdderCents;
  const security = active.securityBands.find((item) => attendeeCount <= item.maxAttendees) || active.securityBands[active.securityBands.length - 1];
  const permitAllowance = getPermitAllowance(eventType, active);
  const brandIntegrationRequested = Boolean(session.wantsBrandIntegration) || session.productionNeeds.includes("Brand integration");
  const hostMomentsRequested = Boolean(session.wantsHostMoments) || session.liveElements.includes("MC / host moments");

  const lines: EstimateLine[] = [
    {
      label: "Artist / performance fee",
      low: Math.round(performanceBase * 0.92),
      high: Math.round(performanceBase * 1.14),
      note: eventRate.note || "Driven by event type, attendance, and performance ambition."
    },
    {
      label: "Travel",
      low: travelRange.lowCents,
      high: travelRange.highCents,
      note: travelRange.note || "Depends on routing, market, lodging, and transport requirements."
    },
    {
      label: "Production",
      low: Math.round(productionBaseLow),
      high: Math.round(productionBaseHigh),
      note: "Reflects production ambition, live elements, and technical scope."
    },
    {
      label: "Staffing",
      low: Math.round(staffingLow),
      high: Math.round(staffingHigh),
      note: "Producer, technical, talent support, and event coordination assumptions."
    },
    {
      label: "Security",
      low: security.lowCents,
      high: security.highCents,
      note: "Audience scale and event format affect crowd management coverage."
    },
    {
      label: "Insurance / permits allowance",
      low: permitAllowance.lowCents,
      high: permitAllowance.highCents,
      note: "Preliminary placeholder for approvals, compliance, and insurance handling."
    }
  ];

  if (brandIntegrationRequested) {
    lines.push({
      label: "Brand integration",
      low: active.commercialTerms.brandIntegrationLowCents,
      high: active.commercialTerms.brandIntegrationHighCents,
      note: "Applies when the performance needs branded creative alignment, approvals, or custom activation handling."
    });
  }

  if (hostMomentsRequested) {
    lines.push({
      label: "Host / MC moments",
      low: active.commercialTerms.hostMomentsLowCents,
      high: active.commercialTerms.hostMomentsHighCents,
      note: "Applies when the run-of-show includes dedicated host cues, introductions, or audience command moments."
    });
  }

  const subtotalLow = lines.reduce((sum, line) => sum + line.low, 0);
  const subtotalHigh = lines.reduce((sum, line) => sum + line.high, 0);
  const contingencyLow = Math.round(subtotalLow * (active.commercialTerms.contingencyLowPercent / 100));
  const contingencyHigh = Math.round(subtotalHigh * (active.commercialTerms.contingencyHighPercent / 100));

  lines.push({
    label: "Contingency",
    low: contingencyLow,
    high: contingencyHigh,
    note: "Held to absorb production shifts, routing changes, and event-specific variables."
  });

  return {
    lines,
    totalLow: subtotalLow + contingencyLow,
    totalHigh: subtotalHigh + contingencyHigh,
    confidenceNote: `Preliminary estimate only. Final pricing remains subject to human review, availability, routing, production scope, and contract. Commercial model assumes a ${active.commercialTerms.depositPercent}% deposit and a ${active.commercialTerms.proposalValidityDays}-day proposal validity window.`
  };
};

export const getStaffingAssumptions = (session: BookingSession, profile?: PerformancePricingProfile | null) => {
  const active = resolvePricingProfile(profile);
  const attendeeCount = session.attendeeCount || 500;
  const liveCount = Math.max(1, session.liveElements.length);
  return [
    active.staffingFormula.assumptionLines[0] || "1 lead booking / production contact",
    `${Math.max(1, Math.ceil(attendeeCount / 1000))} show caller / stage management role`,
    `${Math.max(2, liveCount + 1)} technical / performance support positions`,
    `${attendeeCount > 1500 ? "Expanded" : "Standard"} guest management and security coverage`
  ];
};

export const getDependencies = (session: BookingSession, profile?: PerformancePricingProfile | null) => {
  const active = resolvePricingProfile(profile);
  const items = [
    "Final availability review by the team",
    "Venue technical fit and production scope confirmation",
    "Travel and routing validation",
    `Contracting, ${active.commercialTerms.depositPercent}% deposit, and final approval`
  ];
  if (session.productionNeeds.includes("Insurance / permits guidance")) items.push("Permit and insurance review");
  if (session.productionNeeds.includes("Brand integration")) items.push("Brand approvals and creative alignment");
  return items;
};

export const generateAiSummary = (session: BookingSession, profile?: PerformancePricingProfile | null) => {
  const active = resolvePricingProfile(profile);
  const packageFit = getRecommendedPackage(session, active);
  const eventRate = session.eventType ? getEventRate(session.eventType, active) : null;
  const location = [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ") || "location TBD";
  const attendance = session.attendeeCount ? `${session.attendeeCount.toLocaleString()} guests` : "attendance still being defined";
  const vibe = session.vibeProfile || "premium, audience-led atmosphere";
  const liveElements = session.liveElements.length ? session.liveElements.join(", ").toLowerCase() : "a tightly produced core performance";

  return `This looks like a ${packageFit.label.toLowerCase()} fit for a ${eventRate?.label?.toLowerCase() || "custom event"} in ${location}. The event is shaping toward ${attendance}, with a ${vibe.toLowerCase()} energy profile and ${liveElements}. ${eventRate?.caption || active.baseOverview} Based on the current scope, the next best move is ${NEXT_STEP_OPTIONS.find((item) => item.value === packageFit.nextStep)?.label?.toLowerCase() || "a booking review request"}. Final confirmation remains subject to human review, availability, and contract.`;
};

export const buildProposalBrief = (
  session: BookingSession,
  recommendation: PackageRecommendation,
  estimate: EstimateBreakdown,
  profile?: PerformancePricingProfile | null
): ProposalBrief => {
  const active = resolvePricingProfile(profile);
  const nextStepLabel = NEXT_STEP_OPTIONS.find((item) => item.value === recommendation.nextStep)?.label || recommendation.nextStep;
  return {
    title: session.eventName || recommendation.label,
    pricingProfileKey: active.profileKey,
    pricingProfileName: active.profileName,
    artistName: active.artistName,
    summary: generateAiSummary(session, active),
    package: {
      tier: recommendation.tier,
      label: recommendation.label,
      rationale: recommendation.rationale,
      components: recommendation.components
    },
    investment: {
      currency: active.currency,
      totalLow: estimate.totalLow,
      totalHigh: estimate.totalHigh,
      confidenceNote: estimate.confidenceNote,
      depositPercent: active.commercialTerms.depositPercent,
      balanceDueDays: active.commercialTerms.balanceDueDays,
      holdWindowDays: active.commercialTerms.holdWindowDays,
      proposalValidityDays: active.commercialTerms.proposalValidityDays
    },
    staffingAssumptions: getStaffingAssumptions(session, active),
    dependencies: getDependencies(session, active),
    proposalSections: active.proposalSections,
    bookingProfile: {
      performanceFormats: active.metadata.performanceFormats,
      deliverables: active.metadata.deliverables,
      technicalRequirements: active.metadata.technicalRequirements,
      hospitalityRequirements: active.metadata.hospitalityRequirements,
      bookingRequirements: active.metadata.bookingRequirements,
      minimumLeadTimeDays: active.metadata.minimumLeadTimeDays,
      defaultSetLengthMinutes: active.metadata.defaultSetLengthMinutes,
      typicalPerformanceWindowMinutes: active.metadata.typicalPerformanceWindowMinutes,
      soundcheckRequired: active.metadata.soundcheckRequired,
      meetAndGreetAvailable: active.metadata.meetAndGreetAvailable,
      contentCapturePolicy: active.metadata.contentCapturePolicy
    },
    nextStep: {
      value: recommendation.nextStep,
      label: nextStepLabel
    }
  };
};

export const formatCurrency = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(Math.round(value));

export const getReadinessState = (session: BookingSession) => {
  const answered = getAnsweredCount(session);
  if (answered < 4) return "Welcome / Ready to design";
  if (answered < 8) return "Interview in progress";
  if (answered < 11) return "Blueprint forming";
  if (!session.contactEmail) return "Estimate ready";
  return "Ready for next step";
};
