import { getBrowserSupabaseClient } from "./supabaseBrowser";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type PerformancePricingEventRate = {
  eventType: string;
  label: string;
  caption: string;
  baseFeeCents: number;
  note: string;
};

export type PerformancePricingPackageTier = {
  tier: string;
  label: string;
  rationale: string;
  components: string[];
  defaultNextStep: string;
  routeRank: number;
  minimumAttendees: number;
  minimumProductionNeeds: number;
  minimumLiveElements: number;
  requiredAmbitions: string[];
  requiredEventTypes: string[];
};

export type PerformancePricingAttendanceBand = {
  label: string;
  maxAttendees: number;
  multiplier: number;
};

export type PerformancePricingAmbitionMultiplier = {
  ambition: string;
  label: string;
  multiplier: number;
};

export type PerformancePricingTravelZone = {
  zone: string;
  label: string;
  lowCents: number;
  highCents: number;
  note: string;
};

export type PerformancePricingAdder = {
  key: string;
  label: string;
  adderCents: number;
};

export type PerformancePricingSecurityBand = {
  maxAttendees: number;
  lowCents: number;
  highCents: number;
};

export type PerformancePricingPermitAllowance = {
  key: string;
  label: string;
  eventTypes: string[];
  lowCents: number;
  highCents: number;
};

export type PerformancePricingStaffingFormula = {
  baseLowCents: number;
  baseHighCents: number;
  liveElementSupportLowCents: number;
  largeRoomThreshold: number;
  largeRoomLowAdderCents: number;
  productionNeedHighAdderCents: number;
  assumptionLines: string[];
};

export type PerformancePricingCommercialTerms = {
  depositPercent: number;
  balanceDueDays: number;
  holdWindowDays: number;
  proposalValidityDays: number;
  contingencyLowPercent: number;
  contingencyHighPercent: number;
  brandIntegrationLowCents: number;
  brandIntegrationHighCents: number;
  hostMomentsLowCents: number;
  hostMomentsHighCents: number;
};

export type PerformancePricingProposalSection = {
  key: string;
  label: string;
  guidance: string;
};

export type PerformancePricingMetadata = {
  performanceFormats: string[];
  idealAudienceTags: string[];
  deliverables: string[];
  technicalRequirements: string[];
  hospitalityRequirements: string[];
  travelNotes: string[];
  bookingRequirements: string[];
  proposalCallouts: string[];
  minimumLeadTimeDays: number;
  defaultSetLengthMinutes: number;
  typicalPerformanceWindowMinutes: number;
  travelPartySize: number;
  hotelRoomsRequired: number;
  localGroundSeats: number;
  soundcheckRequired: boolean;
  meetAndGreetAvailable: boolean;
  contentCapturePolicy: string;
};

export type PerformancePricingProfile = {
  profileKey: string;
  profileName: string;
  isActive: boolean;
  currency: string;
  artistName: string;
  baseOverview: string;
  aiGuidance: string;
  eventTypeRates: PerformancePricingEventRate[];
  packageTiers: PerformancePricingPackageTier[];
  attendanceBands: PerformancePricingAttendanceBand[];
  ambitionMultipliers: PerformancePricingAmbitionMultiplier[];
  travelZones: PerformancePricingTravelZone[];
  liveElementRates: PerformancePricingAdder[];
  productionNeedRates: PerformancePricingAdder[];
  securityBands: PerformancePricingSecurityBand[];
  permitAllowances: PerformancePricingPermitAllowance[];
  staffingFormula: PerformancePricingStaffingFormula;
  commercialTerms: PerformancePricingCommercialTerms;
  proposalSections: PerformancePricingProposalSection[];
  metadata: PerformancePricingMetadata;
  createdAt?: string;
  updatedAt?: string;
};

const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();
const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const defaultEventTypeRates: PerformancePricingEventRate[] = [
  { eventType: "club-night", label: "Club Night", caption: "Late-night energy and strong room identity.", baseFeeCents: 18000, note: "Entry point for premium nightlife bookings." },
  { eventType: "festival-mainstage", label: "Festival Mainstage", caption: "Large audience impact with headline pacing.", baseFeeCents: 34000, note: "Mainstage base fee before scale and scope multipliers." },
  { eventType: "warehouse-afterhours", label: "Warehouse Afterhours", caption: "Immersive movement-led nightlife format.", baseFeeCents: 24000, note: "Assumes longer-form room shaping and late-night pacing." },
  { eventType: "private-luxury-event", label: "Private Luxury Event", caption: "Concierge atmosphere for premium guests.", baseFeeCents: 26000, note: "Built for controlled guest experience and premium hospitality." },
  { eventType: "brand-experience", label: "Brand Experience", caption: "Culture-forward activation with visual polish.", baseFeeCents: 32000, note: "Assumes client-facing production alignment and approvals." },
  { eventType: "cultural-celebration", label: "Cultural Celebration", caption: "Cross-cultural programming and communal energy.", baseFeeCents: 21000, note: "Community-first event with flexible performance architecture." },
  { eventType: "corporate-vip", label: "Corporate / VIP Experience", caption: "Executive or client-facing event environments.", baseFeeCents: 28000, note: "Assumes premium hospitality and timing discipline." },
  { eventType: "custom-event", label: "Custom Event", caption: "Built around a one-off brief or special concept.", baseFeeCents: 30000, note: "Use when the event falls outside the standard offer map." }
];

const defaultPackageTiers: PerformancePricingPackageTier[] = [
  {
    tier: "signature-set",
    label: "Signature Set",
    rationale: "Best when the event needs a high-quality Performa booking with strong atmosphere and a disciplined production footprint.",
    components: ["Core Performa performance", "Baseline production review", "Event flow recommendations"],
    defaultNextStep: "availability-review",
    routeRank: 1,
    minimumAttendees: 0,
    minimumProductionNeeds: 0,
    minimumLiveElements: 0,
    requiredAmbitions: [],
    requiredEventTypes: []
  },
  {
    tier: "elevated-experience",
    label: "Elevated Experience",
    rationale: "Recommended when the room needs more visible shape, stronger crowd energy design, and a more layered performance environment.",
    components: ["Performa performance + premium flow design", "Enhanced lighting / audience energy plan", "Pre-show production review"],
    defaultNextStep: "availability-review",
    routeRank: 2,
    minimumAttendees: 700,
    minimumProductionNeeds: 0,
    minimumLiveElements: 2,
    requiredAmbitions: ["elevated", "headline", "immersive"],
    requiredEventTypes: []
  },
  {
    tier: "full-performa-experience",
    label: "Full Performa Experience",
    rationale: "Strong fit for events that need a true room transformation with live elements, broader staffing assumptions, and deeper audience engagement.",
    components: ["Expanded stage architecture", "Live element integration", "Audience engagement choreography", "Producer-led run-of-show assumptions"],
    defaultNextStep: "schedule-call",
    routeRank: 3,
    minimumAttendees: 1600,
    minimumProductionNeeds: 4,
    minimumLiveElements: 0,
    requiredAmbitions: ["headline", "immersive"],
    requiredEventTypes: []
  },
  {
    tier: "custom-production-experience",
    label: "Custom Production Experience",
    rationale: "Best for premium, large-scale, or highly tailored events where The Performa needs to function as a produced cultural centerpiece.",
    components: ["Custom event architecture", "Advanced production coordination", "Brand or festival adaptation", "Multi-layered live experience design"],
    defaultNextStep: "schedule-call",
    routeRank: 4,
    minimumAttendees: 3500,
    minimumProductionNeeds: 0,
    minimumLiveElements: 0,
    requiredAmbitions: ["immersive"],
    requiredEventTypes: ["brand-experience", "festival-mainstage"]
  }
];

const defaultAttendanceBands: PerformancePricingAttendanceBand[] = [
  { label: "Boutique room", maxAttendees: 250, multiplier: 0.88 },
  { label: "Core room", maxAttendees: 750, multiplier: 1 },
  { label: "Large room", maxAttendees: 1500, multiplier: 1.16 },
  { label: "Major room", maxAttendees: 3000, multiplier: 1.34 },
  { label: "Mainstage scale", maxAttendees: 999999, multiplier: 1.62 }
];

const defaultAmbitionMultipliers: PerformancePricingAmbitionMultiplier[] = [
  { ambition: "essential", label: "Essential", multiplier: 1 },
  { ambition: "elevated", label: "Elevated", multiplier: 1.2 },
  { ambition: "headline", label: "Headline", multiplier: 1.42 },
  { ambition: "immersive", label: "Immersive", multiplier: 1.72 }
];

const defaultTravelZones: PerformancePricingTravelZone[] = [
  { zone: "local", label: "Local / Georgia", lowCents: 1200, highCents: 2500, note: "Local market support and same-region routing." },
  { zone: "regional", label: "Regional / Domestic", lowCents: 4500, highCents: 9000, note: "Domestic routing with lodging and ground assumptions." },
  { zone: "fly", label: "Fly Market / International", lowCents: 11000, highCents: 24000, note: "Air routing, extended lodging, cargo, and border planning." }
];

const defaultLiveElementRates: PerformancePricingAdder[] = [
  { key: "Live musicians", label: "Live musicians", adderCents: 2200 },
  { key: "Choreography / dancers", label: "Choreography / dancers", adderCents: 2200 },
  { key: "Interactive crowd moments", label: "Interactive crowd moments", adderCents: 2200 },
  { key: "MC / host moments", label: "MC / host moments", adderCents: 2200 },
  { key: "Cultural rhythm integration", label: "Cultural rhythm integration", adderCents: 2200 },
  { key: "Visual cues synced to performance", label: "Visual cues synced to performance", adderCents: 2200 }
];

const defaultProductionNeedRates: PerformancePricingAdder[] = [
  { key: "Lighting enhancement", label: "Lighting enhancement", adderCents: 1800 },
  { key: "Visual content / LED support", label: "Visual content / LED support", adderCents: 1800 },
  { key: "Sound reinforcement", label: "Sound reinforcement", adderCents: 1800 },
  { key: "Stage design", label: "Stage design", adderCents: 1800 },
  { key: "Travel / routing support", label: "Travel / routing support", adderCents: 1800 },
  { key: "Security planning", label: "Security planning", adderCents: 1800 },
  { key: "Insurance / permits guidance", label: "Insurance / permits guidance", adderCents: 1800 },
  { key: "Brand integration", label: "Brand integration", adderCents: 1800 }
];

const defaultSecurityBands: PerformancePricingSecurityBand[] = [
  { maxAttendees: 300, lowCents: 1200, highCents: 2400 },
  { maxAttendees: 900, lowCents: 2500, highCents: 4500 },
  { maxAttendees: 2000, lowCents: 5000, highCents: 9000 },
  { maxAttendees: 999999, lowCents: 9000, highCents: 18000 }
];

const defaultPermitAllowances: PerformancePricingPermitAllowance[] = [
  { key: "default", label: "Standard insurance / permits", eventTypes: [], lowCents: 2200, highCents: 4200 },
  { key: "private-luxury", label: "Private luxury insurance / permits", eventTypes: ["private-luxury-event"], lowCents: 1200, highCents: 4200 },
  { key: "festival-brand", label: "Festival / brand compliance", eventTypes: ["festival-mainstage", "brand-experience"], lowCents: 2200, highCents: 7200 }
];

const defaultStaffingFormula: PerformancePricingStaffingFormula = {
  baseLowCents: 2400,
  baseHighCents: 2800,
  liveElementSupportLowCents: 800,
  largeRoomThreshold: 1200,
  largeRoomLowAdderCents: 1800,
  productionNeedHighAdderCents: 600,
  assumptionLines: [
    "1 lead booking / production contact",
    "Scaled show-calling and stage management coverage",
    "Technical / performance support sized to live elements",
    "Guest management and security coverage matched to room scale"
  ]
};

const defaultCommercialTerms: PerformancePricingCommercialTerms = {
  depositPercent: 50,
  balanceDueDays: 7,
  holdWindowDays: 10,
  proposalValidityDays: 14,
  contingencyLowPercent: 8,
  contingencyHighPercent: 12,
  brandIntegrationLowCents: 2500,
  brandIntegrationHighCents: 6000,
  hostMomentsLowCents: 1500,
  hostMomentsHighCents: 4200
};

const defaultProposalSections: PerformancePricingProposalSection[] = [
  { key: "positioning", label: "Experience Positioning", guidance: "Frame The Performa as a produced live performance environment, not a standard DJ booking." },
  { key: "package", label: "Package Recommendation", guidance: "Translate the selected tier into buyer-ready language with concise components and fit rationale." },
  { key: "investment", label: "Investment Envelope", guidance: "Present the preliminary range with confidence notes and the key cost drivers behind the number." },
  { key: "production", label: "Production Assumptions", guidance: "Summarize staffing, live elements, technical scope, routing, and operational dependencies." },
  { key: "commercial", label: "Commercial Terms", guidance: "Reference deposit, hold window, balance timing, proposal validity, and required human review." }
];

const defaultMetadata: PerformancePricingMetadata = {
  performanceFormats: [
    "DJ performance with premium room-direction and audience pacing",
    "Produced live set with optional host, choreography, or cultural performance layers",
    "Custom cultural headline experience for festivals, luxury private events, and branded rooms"
  ],
  idealAudienceTags: ["premium nightlife", "festival audiences", "luxury private guests", "brand-forward culture audiences"],
  deliverables: ["Performance set", "Run-of-show alignment", "Production review", "Buyer-facing proposal framing"],
  technicalRequirements: [
    "Professional FOH audio with clean DJ input path",
    "Stage or performance zone sized to the selected format",
    "Lighting support aligned with the agreed ambition level",
    "Safe backstage access and secure artist flow"
  ],
  hospitalityRequirements: [
    "Dedicated point of contact onsite",
    "Secure green room / holding area",
    "Water and light hospitality for artist and support team",
    "Ground transport coordination when required"
  ],
  travelNotes: [
    "Travel assumptions scale by market and routing zone",
    "Hotel, airport transfer, and local ground are budgeted separately from performance fee",
    "International routing may require extended holds and cargo / customs planning"
  ],
  bookingRequirements: [
    "Final quote requires human review and availability confirmation",
    "Signed agreement and deposit required before lock",
    "Venue technical fit must be approved before final confirmation"
  ],
  proposalCallouts: [
    "Position The Performa as a produced live experience, not a commodity booking",
    "Keep language premium, concise, and operationally credible",
    "Anchor proposals around guest impact, room transformation, and scope clarity"
  ],
  minimumLeadTimeDays: 21,
  defaultSetLengthMinutes: 75,
  typicalPerformanceWindowMinutes: 90,
  travelPartySize: 4,
  hotelRoomsRequired: 2,
  localGroundSeats: 4,
  soundcheckRequired: true,
  meetAndGreetAvailable: false,
  contentCapturePolicy: "Content capture is subject to advance approval and may require additional coordination."
};

export const DEFAULT_PERFORMANCE_PRICING_PROFILE: PerformancePricingProfile = {
  profileKey: "default-performance",
  profileName: "The Performa Default Performance Profile",
  isActive: true,
  currency: "usd",
  artistName: "Chip Lee / The Performa",
  baseOverview:
    "Premium live performance pricing profile for The Performa across nightlife, festivals, private events, branded experiences, and cultural programming.",
  aiGuidance:
    "Use this rate card as the commercial source of truth when generating estimates and proposals. Keep buyer language premium, concise, and operationally credible. Never promise final pricing or availability without human review.",
  eventTypeRates: defaultEventTypeRates,
  packageTiers: defaultPackageTiers,
  attendanceBands: defaultAttendanceBands,
  ambitionMultipliers: defaultAmbitionMultipliers,
  travelZones: defaultTravelZones,
  liveElementRates: defaultLiveElementRates,
  productionNeedRates: defaultProductionNeedRates,
  securityBands: defaultSecurityBands,
  permitAllowances: defaultPermitAllowances,
  staffingFormula: defaultStaffingFormula,
  commercialTerms: defaultCommercialTerms,
  proposalSections: defaultProposalSections,
  metadata: defaultMetadata
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const clonePerformancePricingProfile = (profile: PerformancePricingProfile = DEFAULT_PERFORMANCE_PRICING_PROFILE) => clone(profile);

const normalizeMetadata = (metadata: unknown): PerformancePricingMetadata => {
  const raw = metadata && typeof metadata === "object" ? (metadata as Partial<PerformancePricingMetadata>) : {};
  return {
    ...clone(defaultMetadata),
    ...raw,
    performanceFormats: Array.isArray(raw.performanceFormats) ? raw.performanceFormats.filter(Boolean).map(String) : clone(defaultMetadata.performanceFormats),
    idealAudienceTags: Array.isArray(raw.idealAudienceTags) ? raw.idealAudienceTags.filter(Boolean).map(String) : clone(defaultMetadata.idealAudienceTags),
    deliverables: Array.isArray(raw.deliverables) ? raw.deliverables.filter(Boolean).map(String) : clone(defaultMetadata.deliverables),
    technicalRequirements: Array.isArray(raw.technicalRequirements)
      ? raw.technicalRequirements.filter(Boolean).map(String)
      : clone(defaultMetadata.technicalRequirements),
    hospitalityRequirements: Array.isArray(raw.hospitalityRequirements)
      ? raw.hospitalityRequirements.filter(Boolean).map(String)
      : clone(defaultMetadata.hospitalityRequirements),
    travelNotes: Array.isArray(raw.travelNotes) ? raw.travelNotes.filter(Boolean).map(String) : clone(defaultMetadata.travelNotes),
    bookingRequirements: Array.isArray(raw.bookingRequirements)
      ? raw.bookingRequirements.filter(Boolean).map(String)
      : clone(defaultMetadata.bookingRequirements),
    proposalCallouts: Array.isArray(raw.proposalCallouts)
      ? raw.proposalCallouts.filter(Boolean).map(String)
      : clone(defaultMetadata.proposalCallouts),
    minimumLeadTimeDays:
      typeof raw.minimumLeadTimeDays === "number" && Number.isFinite(raw.minimumLeadTimeDays)
        ? raw.minimumLeadTimeDays
        : defaultMetadata.minimumLeadTimeDays,
    defaultSetLengthMinutes:
      typeof raw.defaultSetLengthMinutes === "number" && Number.isFinite(raw.defaultSetLengthMinutes)
        ? raw.defaultSetLengthMinutes
        : defaultMetadata.defaultSetLengthMinutes,
    typicalPerformanceWindowMinutes:
      typeof raw.typicalPerformanceWindowMinutes === "number" && Number.isFinite(raw.typicalPerformanceWindowMinutes)
        ? raw.typicalPerformanceWindowMinutes
        : defaultMetadata.typicalPerformanceWindowMinutes,
    travelPartySize:
      typeof raw.travelPartySize === "number" && Number.isFinite(raw.travelPartySize)
        ? raw.travelPartySize
        : defaultMetadata.travelPartySize,
    hotelRoomsRequired:
      typeof raw.hotelRoomsRequired === "number" && Number.isFinite(raw.hotelRoomsRequired)
        ? raw.hotelRoomsRequired
        : defaultMetadata.hotelRoomsRequired,
    localGroundSeats:
      typeof raw.localGroundSeats === "number" && Number.isFinite(raw.localGroundSeats)
        ? raw.localGroundSeats
        : defaultMetadata.localGroundSeats,
    soundcheckRequired: typeof raw.soundcheckRequired === "boolean" ? raw.soundcheckRequired : defaultMetadata.soundcheckRequired,
    meetAndGreetAvailable:
      typeof raw.meetAndGreetAvailable === "boolean" ? raw.meetAndGreetAvailable : defaultMetadata.meetAndGreetAvailable,
    contentCapturePolicy:
      typeof raw.contentCapturePolicy === "string" && raw.contentCapturePolicy.trim()
        ? raw.contentCapturePolicy
        : defaultMetadata.contentCapturePolicy
  };
};

const mapRowToProfile = (row: any): PerformancePricingProfile => {
  const fallback = clonePerformancePricingProfile();
  if (!row) return fallback;
  return {
    ...fallback,
    profileKey: String(row.profile_key || fallback.profileKey),
    profileName: String(row.profile_name || fallback.profileName),
    isActive: row.is_active !== false,
    currency: String(row.currency || fallback.currency),
    artistName: String(row.artist_name || fallback.artistName),
    baseOverview: String(row.base_overview || fallback.baseOverview),
    aiGuidance: String(row.ai_guidance || fallback.aiGuidance),
    eventTypeRates: Array.isArray(row.event_type_rates) ? row.event_type_rates : fallback.eventTypeRates,
    packageTiers: Array.isArray(row.package_tiers) ? row.package_tiers : fallback.packageTiers,
    attendanceBands: Array.isArray(row.attendance_bands) ? row.attendance_bands : fallback.attendanceBands,
    ambitionMultipliers: Array.isArray(row.ambition_multipliers) ? row.ambition_multipliers : fallback.ambitionMultipliers,
    travelZones: Array.isArray(row.travel_zones) ? row.travel_zones : fallback.travelZones,
    liveElementRates: Array.isArray(row.live_element_rates) ? row.live_element_rates : fallback.liveElementRates,
    productionNeedRates: Array.isArray(row.production_need_rates) ? row.production_need_rates : fallback.productionNeedRates,
    securityBands: Array.isArray(row.security_bands) ? row.security_bands : fallback.securityBands,
    permitAllowances: Array.isArray(row.permit_allowances) ? row.permit_allowances : fallback.permitAllowances,
    staffingFormula:
      row.staffing_formula && typeof row.staffing_formula === "object" ? { ...fallback.staffingFormula, ...row.staffing_formula } : fallback.staffingFormula,
    commercialTerms:
      row.commercial_terms && typeof row.commercial_terms === "object" ? { ...fallback.commercialTerms, ...row.commercial_terms } : fallback.commercialTerms,
    proposalSections: Array.isArray(row.proposal_sections) ? row.proposal_sections : fallback.proposalSections,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined
  };
};

const getSupabase = () => (isConfigured ? getBrowserSupabaseClient() : null);

export const loadActivePerformancePricingProfile = async (): Promise<Result<PerformancePricingProfile>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: clonePerformancePricingProfile() };

  const { data, error } = await supabase
    .from("performance_pricing_profiles")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapRowToProfile(data) };
};

export const savePerformancePricingProfile = async (profile: PerformancePricingProfile): Promise<Result<PerformancePricingProfile>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { data: authData } = await supabase.auth.getUser();

  const payload = {
    profile_key: String(profile.profileKey || DEFAULT_PERFORMANCE_PRICING_PROFILE.profileKey).trim(),
    profile_name: String(profile.profileName || DEFAULT_PERFORMANCE_PRICING_PROFILE.profileName).trim(),
    is_active: profile.isActive !== false,
    currency: String(profile.currency || "usd").trim().toLowerCase(),
    artist_name: String(profile.artistName || DEFAULT_PERFORMANCE_PRICING_PROFILE.artistName).trim(),
    base_overview: String(profile.baseOverview || ""),
    ai_guidance: String(profile.aiGuidance || ""),
    event_type_rates: profile.eventTypeRates || [],
    package_tiers: profile.packageTiers || [],
    attendance_bands: profile.attendanceBands || [],
    ambition_multipliers: profile.ambitionMultipliers || [],
    travel_zones: profile.travelZones || [],
    live_element_rates: profile.liveElementRates || [],
    production_need_rates: profile.productionNeedRates || [],
    security_bands: profile.securityBands || [],
    permit_allowances: profile.permitAllowances || [],
    staffing_formula: profile.staffingFormula || {},
    commercial_terms: profile.commercialTerms || {},
    proposal_sections: profile.proposalSections || [],
    metadata: profile.metadata || {},
    updated_at: new Date().toISOString(),
    updated_by: authData.user?.id || null,
    created_by: authData.user?.id || null
  };

  const { data, error } = await supabase
    .from("performance_pricing_profiles")
    .upsert(payload, { onConflict: "profile_key" })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapRowToProfile(data) };
};
