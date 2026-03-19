import type { BookingSession, EstimateBreakdown, PackageRecommendation, ProposalBrief } from "../components/booking/bookingEngine";
import { getBrowserSupabaseClient } from "./supabaseBrowser";
import type { PerformancePricingProfile } from "./performancePricing";

export type BookingClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

type BookingClaudeRequest = {
  messages: BookingClaudeMessage[];
  session: BookingSession;
  aiSummary: string;
  recommendation: PackageRecommendation;
  estimate: EstimateBreakdown;
  proposalBrief: ProposalBrief;
  pricingProfile: PerformancePricingProfile;
};

const supabaseUrl = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();

const getFunctionUrl = (functionName: string) => {
  if (!supabaseUrl) return "";
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0] || "";
    return projectRef ? `https://${projectRef}.functions.supabase.co/${functionName}` : "";
  } catch {
    return "";
  }
};

const getAccessToken = async () => {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return supabaseAnonKey;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || supabaseAnonKey;
};

const toBookingContext = (
  session: BookingSession,
  aiSummary: string,
  recommendation: PackageRecommendation,
  estimate: EstimateBreakdown,
  proposalBrief: ProposalBrief,
  pricingProfile: PerformancePricingProfile
) => ({
  summary: aiSummary,
  readiness: session.status,
  eventType: session.eventType,
  venueType: session.venueType,
  location: [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", "),
  targetDate: session.targetDate,
  attendeeCount: session.attendeeCount,
  ticketingModel: session.ticketingModel,
  audienceDescription: session.audienceDescription,
  vibeProfile: session.vibeProfile,
  productionAmbition: session.productionAmbition,
  liveElements: session.liveElements,
  productionNeeds: session.productionNeeds,
  budgetSignal: session.budgetSignal,
  nextStepIntent: session.nextStepIntent,
  recommendation: {
    label: recommendation.label,
    rationale: recommendation.rationale,
    nextStep: recommendation.nextStep,
    components: recommendation.components
  },
  estimate: {
    totalLow: estimate.totalLow,
    totalHigh: estimate.totalHigh,
    confidenceNote: estimate.confidenceNote
  },
  proposalBrief,
  pricingProfile: {
    profileKey: pricingProfile.profileKey,
    profileName: pricingProfile.profileName,
    artistName: pricingProfile.artistName,
    baseOverview: pricingProfile.baseOverview,
    aiGuidance: pricingProfile.aiGuidance,
    currency: pricingProfile.currency,
    eventTypeRates: pricingProfile.eventTypeRates,
    packageTiers: pricingProfile.packageTiers,
    commercialTerms: pricingProfile.commercialTerms,
    proposalSections: pricingProfile.proposalSections,
    metadata: pricingProfile.metadata
  }
});

export const askBookingClaude = async ({
  messages,
  session,
  aiSummary,
  recommendation,
  estimate,
  proposalBrief,
  pricingProfile
}: BookingClaudeRequest) => {
  const functionUrl = getFunctionUrl("booking-claude-chat");
  if (!functionUrl || !supabaseAnonKey) {
    return { ok: false as const, error: "Claude booking assistant is unavailable right now." };
  }

  const token = await getAccessToken();
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messages,
      bookingContext: toBookingContext(session, aiSummary, recommendation, estimate, proposalBrief, pricingProfile)
    })
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string; text?: string; model?: string };
  if (!response.ok || !data.text) {
    return { ok: false as const, error: data.error || "Claude could not respond right now." };
  }

  return {
    ok: true as const,
    text: data.text,
    model: data.model || "claude"
  };
};
