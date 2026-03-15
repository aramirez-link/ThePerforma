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

const BASE_FEES: Record<EventType, number> = {
  "club-night": 18000,
  "festival-mainstage": 34000,
  "warehouse-afterhours": 24000,
  "private-luxury-event": 26000,
  "brand-experience": 32000,
  "cultural-celebration": 21000,
  "corporate-vip": 28000,
  "custom-event": 30000
};

const ATTENDANCE_MULTIPLIER = [
  { max: 250, value: 0.88 },
  { max: 750, value: 1 },
  { max: 1500, value: 1.16 },
  { max: 3000, value: 1.34 },
  { max: Infinity, value: 1.62 }
];

const AMBITION_MULTIPLIER: Record<ProductionAmbition, number> = {
  essential: 1,
  elevated: 1.2,
  headline: 1.42,
  immersive: 1.72
};

const TRAVEL_BASE = {
  local: [1200, 2500],
  regional: [4500, 9000],
  fly: [11000, 24000]
} as const;

const SECURITY_ALLOWANCE = [
  { max: 300, low: 1200, high: 2400 },
  { max: 900, low: 2500, high: 4500 },
  { max: 2000, low: 5000, high: 9000 },
  { max: Infinity, low: 9000, high: 18000 }
];

const PACKAGE_LABELS: Record<PackageTier, string> = {
  "signature-set": "Signature Set",
  "elevated-experience": "Elevated Experience",
  "full-performa-experience": "Full Performa Experience",
  "custom-production-experience": "Custom Production Experience"
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

const getAttendanceMultiplier = (count: number | null) => {
  const attendance = count || 500;
  return ATTENDANCE_MULTIPLIER.find((item) => attendance <= item.max)?.value || 1;
};

export const getRecommendedPackage = (session: BookingSession): PackageRecommendation => {
  const attendeeCount = session.attendeeCount || 500;
  const ambition = session.productionAmbition || "elevated";
  const liveCount = session.liveElements.length;
  const productionCount = session.productionNeeds.length;

  let tier: PackageTier = "signature-set";
  if (ambition === "elevated" || attendeeCount > 700 || liveCount >= 2) tier = "elevated-experience";
  if (ambition === "headline" || attendeeCount > 1600 || productionCount >= 4) tier = "full-performa-experience";
  if (ambition === "immersive" || attendeeCount > 3500 || session.eventType === "brand-experience" || session.eventType === "festival-mainstage") {
    tier = "custom-production-experience";
  }

  const componentsByTier: Record<PackageTier, string[]> = {
    "signature-set": ["Core Performa performance", "Baseline production review", "Event flow recommendations"],
    "elevated-experience": ["Performa performance + premium flow design", "Enhanced lighting / audience energy plan", "Pre-show production review"],
    "full-performa-experience": ["Expanded stage architecture", "Live element integration", "Audience engagement choreography", "Producer-led run-of-show assumptions"],
    "custom-production-experience": ["Custom event architecture", "Advanced production coordination", "Brand or festival adaptation", "Multi-layered live experience design"]
  };

  const rationale = {
    "signature-set": "Best when the event needs a high-quality Performa booking with strong atmosphere and a disciplined production footprint.",
    "elevated-experience": "Recommended when the room needs more visible shape, stronger crowd energy design, and a more layered performance environment.",
    "full-performa-experience": "Strong fit for events that need a true room transformation with live elements, broader staffing assumptions, and deeper audience engagement.",
    "custom-production-experience": "Best for premium, large-scale, or highly tailored events where thePerforma needs to function as a produced cultural centerpiece."
  }[tier];

  const nextStep: NextStepIntent =
    tier === "custom-production-experience" || tier === "full-performa-experience" ? "schedule-call" : session.nextStepIntent || "availability-review";

  return {
    tier,
    label: PACKAGE_LABELS[tier],
    rationale,
    components: componentsByTier[tier],
    nextStep
  };
};

export const getEstimateBreakdown = (session: BookingSession): EstimateBreakdown => {
  const eventType = session.eventType || "custom-event";
  const ambition = session.productionAmbition || "elevated";
  const attendeeCount = session.attendeeCount || 500;
  const attendanceMultiplier = getAttendanceMultiplier(attendeeCount);
  const ambitionMultiplier = AMBITION_MULTIPLIER[ambition];
  const performanceBase = BASE_FEES[eventType] * attendanceMultiplier * ambitionMultiplier;

  const travelTier = getTravelTier(session);
  const travelRange = TRAVEL_BASE[travelTier];
  const liveElementAdder = session.liveElements.length * 2200;
  const productionAdder = session.productionNeeds.length * 1800;
  const productionBaseLow = 6000 * (ambitionMultiplier - 0.05) + productionAdder + liveElementAdder;
  const productionBaseHigh = 10000 * ambitionMultiplier + productionAdder * 1.25 + liveElementAdder * 1.3;
  const staffingLow = 2400 + Math.max(0, session.liveElements.length - 1) * 800 + (attendeeCount > 1200 ? 1800 : 0);
  const staffingHigh = staffingLow + 2800 + session.productionNeeds.length * 600;
  const security = SECURITY_ALLOWANCE.find((item) => attendeeCount <= item.max) || SECURITY_ALLOWANCE[SECURITY_ALLOWANCE.length - 1];
  const permitsLow = session.eventType === "private-luxury-event" ? 1200 : 2200;
  const permitsHigh = session.eventType === "festival-mainstage" || session.eventType === "brand-experience" ? 7200 : 4200;

  const lines: EstimateLine[] = [
    {
      label: "Artist / performance fee",
      low: Math.round(performanceBase * 0.92),
      high: Math.round(performanceBase * 1.14),
      note: "Driven by event type, attendance, and performance ambition."
    },
    {
      label: "Travel",
      low: travelRange[0],
      high: travelRange[1],
      note: "Depends on routing, market, lodging, and transport requirements."
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
      low: security.low,
      high: security.high,
      note: "Audience scale and event format affect crowd management coverage."
    },
    {
      label: "Insurance / permits allowance",
      low: permitsLow,
      high: permitsHigh,
      note: "Preliminary placeholder for approvals, compliance, and insurance handling."
    }
  ];

  const subtotalLow = lines.reduce((sum, line) => sum + line.low, 0);
  const subtotalHigh = lines.reduce((sum, line) => sum + line.high, 0);
  const contingencyLow = Math.round(subtotalLow * 0.08);
  const contingencyHigh = Math.round(subtotalHigh * 0.12);

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
    confidenceNote: "Preliminary estimate only. Final pricing is subject to human review, availability, routing, production scope, and contract."
  };
};

export const getStaffingAssumptions = (session: BookingSession) => {
  const attendeeCount = session.attendeeCount || 500;
  const liveCount = Math.max(1, session.liveElements.length);
  return [
    `1 lead booking / production contact`,
    `${Math.max(1, Math.ceil(attendeeCount / 1000))} show caller / stage management role`,
    `${Math.max(2, liveCount + 1)} technical / performance support positions`,
    `${attendeeCount > 1500 ? "Expanded" : "Standard"} guest management and security coverage`
  ];
};

export const getDependencies = (session: BookingSession) => {
  const items = [
    "Final availability review by the team",
    "Venue technical fit and production scope confirmation",
    "Travel and routing validation",
    "Contracting, deposit, and final approval"
  ];
  if (session.productionNeeds.includes("Insurance / permits guidance")) items.push("Permit and insurance review");
  if (session.productionNeeds.includes("Brand integration")) items.push("Brand approvals and creative alignment");
  return items;
};

export const generateAiSummary = (session: BookingSession) => {
  const packageFit = getRecommendedPackage(session);
  const location = [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ") || "location TBD";
  const attendance = session.attendeeCount ? `${session.attendeeCount.toLocaleString()} guests` : "attendance still being defined";
  const vibe = session.vibeProfile || "premium, audience-led atmosphere";
  const liveElements = session.liveElements.length ? session.liveElements.join(", ").toLowerCase() : "a tightly produced core performance";

  return `This looks like a ${packageFit.label.toLowerCase()} fit for a ${session.eventType ? EVENT_TYPE_OPTIONS.find((item) => item.value === session.eventType)?.label?.toLowerCase() : "custom event"} in ${location}. The event is shaping toward ${attendance}, with a ${vibe.toLowerCase()} energy profile and ${liveElements}. Based on the current scope, the next best move is ${NEXT_STEP_OPTIONS.find((item) => item.value === packageFit.nextStep)?.label?.toLowerCase() || "a booking review request"}. Final confirmation remains subject to human review, availability, and contract.`;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
