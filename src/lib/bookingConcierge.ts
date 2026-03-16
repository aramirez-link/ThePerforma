import { getBrowserSupabaseClient } from "./supabaseBrowser";
import type { BookingSession } from "../components/booking/bookingEngine";
import {
  defaultBookingSession,
  generateAiSummary,
  getEstimateBreakdown,
  getRecommendedPackage
} from "../components/booking/bookingEngine";
import { sendBookingSubmissionEmail } from "./formSubmissionMailer";

const mapSessionPayload = (session: BookingSession, submitMode: "autosave" | "submit" | "email" | "follow_up") => {
  const estimate = getEstimateBreakdown(session);
  const recommendation = getRecommendedPackage(session);

  return {
    session_token: session.sessionId,
    status:
      submitMode === "submit"
        ? "submitted"
        : submitMode === "email"
          ? "emailed"
          : submitMode === "follow_up"
            ? "follow_up"
            : session.status,
    event_type: session.eventType || null,
    venue_type: session.venueType || null,
    event_name: session.eventName || null,
    location_city: session.locationCity || null,
    location_state: session.locationState || null,
    location_country: session.locationCountry || null,
    target_date: session.targetDate || null,
    attendee_count: session.attendeeCount,
    ticketing_model: session.ticketingModel || null,
    audience_description: session.audienceDescription || null,
    vibe_profile: session.vibeProfile || null,
    package_preference: recommendation.tier,
    production_ambition: session.productionAmbition || null,
    live_elements: session.liveElements,
    production_needs: session.productionNeeds,
    budget_signal: session.budgetSignal || null,
    next_step_intent: session.nextStepIntent || recommendation.nextStep,
    contact_name: session.contactName || null,
    contact_email: session.contactEmail || null,
    contact_phone: session.contactPhone || null,
    organization: session.organization || null,
    role: session.role || null,
    contact_preference: session.contactPreference || null,
    follow_up_consent: session.followUpConsent,
    outreach_consent: session.outreachConsent,
    ai_summary: generateAiSummary(session),
    estimate_breakdown: estimate,
    total_range_low: estimate.totalLow,
    total_range_high: estimate.totalHigh,
    metadata: {
      wantsBrandIntegration: session.wantsBrandIntegration,
      wantsHostMoments: session.wantsHostMoments,
      languageConsiderations: session.languageConsiderations,
      requestedAction: submitMode
    },
    updated_at: new Date().toISOString()
  };
};

export const persistBookingConciergeSession = async (
  session: BookingSession,
  submitMode: "autosave" | "submit" | "email" | "follow_up" = "autosave"
) => {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { ok: false as const, error: "Booking concierge storage is unavailable." };

  const payload = mapSessionPayload(session, submitMode);
  const { error } = await supabase.from("booking_concierge_sessions").upsert(payload, {
    onConflict: "session_token"
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};

export type LegacyBookingInquiryInput = {
  venueType: string;
  experienceTier: string;
  name: string;
  email: string;
  city?: string;
  date?: string;
  notes?: string;
  sourcePath?: string;
};

const mapLegacyVenueType = (value: string): BookingSession["venueType"] => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "club") return "nightclub";
  if (normalized === "festival") return "festival-stage";
  if (normalized === "private event") return "private-estate";
  return "other";
};

const mapLegacyEventType = (value: string): BookingSession["eventType"] => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "club") return "club-night";
  if (normalized === "festival") return "festival-mainstage";
  if (normalized === "private event") return "private-luxury-event";
  return "custom-event";
};

const mapLegacyAmbition = (value: string): BookingSession["productionAmbition"] => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "cinematic set") return "elevated";
  if (normalized === "full stage production") return "headline";
  if (normalized === "headliner package") return "immersive";
  return "elevated";
};

const buildLegacyBookingSession = (input: LegacyBookingInquiryInput): BookingSession => {
  const session = defaultBookingSession();
  session.status = "submitted";
  session.eventType = mapLegacyEventType(input.venueType);
  session.venueType = mapLegacyVenueType(input.venueType);
  session.locationCity = input.city?.trim() || "";
  session.targetDate = input.date?.trim() || "";
  session.productionAmbition = mapLegacyAmbition(input.experienceTier);
  session.audienceDescription = input.notes?.trim() || "";
  session.vibeProfile = input.experienceTier.trim();
  session.contactName = input.name.trim();
  session.contactEmail = input.email.trim().toLowerCase();
  session.nextStepIntent = "availability-review";
  session.contactPreference = "email";
  session.followUpConsent = true;
  session.outreachConsent = true;
  session.updatedAt = new Date().toISOString();
  return session;
};

export const submitLegacyBookingInquiry = async (input: LegacyBookingInquiryInput) => {
  const session = buildLegacyBookingSession(input);
  const recommendation = getRecommendedPackage(session);
  session.packagePreference = recommendation.tier;
  session.aiSummary = generateAiSummary(session);
  const estimate = getEstimateBreakdown(session);

  const persistResult = await persistBookingConciergeSession(session, "submit");
  if (!persistResult.ok) return persistResult;

  const emailResult = await sendBookingSubmissionEmail({
    formName: "Stage Mode Booking Modal",
    sourcePath: input.sourcePath || "/",
    session,
    estimate,
    recommendation,
    notes: input.notes?.trim() || "",
    metadata: {
      legacyVenueType: input.venueType,
      legacyExperienceTier: input.experienceTier
    }
  });

  if (!emailResult.ok) {
    return {
      ok: true as const,
      warning:
        "The request was saved, but the notification email could not be sent. Please retry or email info@link-collective.com."
    };
  }

  return { ok: true as const };
};
