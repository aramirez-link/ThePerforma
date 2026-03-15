import { getBrowserSupabaseClient } from "./supabaseBrowser";
import type { BookingSession } from "../components/booking/bookingEngine";
import { generateAiSummary, getEstimateBreakdown, getRecommendedPackage } from "../components/booking/bookingEngine";

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
