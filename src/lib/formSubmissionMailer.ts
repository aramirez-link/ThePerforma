import {
  AMBITION_OPTIONS,
  BUDGET_OPTIONS,
  CONTACT_PREFERENCE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  NEXT_STEP_OPTIONS,
  TICKETING_OPTIONS,
  VENUE_TYPE_OPTIONS,
  type BookingSession,
  type EstimateBreakdown,
  type PackageRecommendation
} from "../components/booking/bookingEngine";
import { getBrowserSupabaseClient } from "./supabaseBrowser";

type FormEmailContact = {
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  role?: string | null;
  preference?: string | null;
};

type BookingFormEmailPayload = {
  kind: "booking";
  formName: string;
  sourcePath: string;
  submittedAt: string;
  requestLabel: string;
  contact: FormEmailContact;
  event: {
    eventType: string;
    venueType: string;
    eventName?: string | null;
    location: string;
    targetDate?: string | null;
    attendeeCount?: number | null;
    ticketingModel?: string | null;
  };
  creative: {
    audienceDescription?: string | null;
    vibeProfile?: string | null;
    productionAmbition?: string | null;
    liveElements: string[];
    productionNeeds: string[];
    notes?: string | null;
  };
  budget: {
    budgetSignal?: string | null;
    followUpConsent: string;
    outreachConsent: string;
  };
  recommendation: {
    tier: string;
    label: string;
    rationale: string;
    components: string[];
  };
  estimate: EstimateBreakdown;
  aiSummary: string;
  metadata?: Record<string, unknown>;
};

type ContactFormEmailPayload = {
  kind: "contact";
  formName: string;
  sourcePath: string;
  submittedAt: string;
  contact: FormEmailContact;
  details: {
    interest: string;
    notes?: string | null;
  };
  metadata?: Record<string, unknown>;
};

type FormEmailPayload = BookingFormEmailPayload | ContactFormEmailPayload;

const labelFor = <T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | ""
) => options.find((item) => item.value === value)?.label || value;

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const getLocationLabel = (session: BookingSession) =>
  [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ") || "Not provided";

const invokeFormSubmissionEmail = async (payload: FormEmailPayload) => {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return { ok: false as const, error: "Form email delivery is unavailable." };
  }

  const { data, error } = await supabase.functions.invoke("form-submission-email", {
    body: payload
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  if (!data?.ok) {
    return {
      ok: false as const,
      error: typeof data?.error === "string" ? data.error : "Form email delivery failed."
    };
  }

  return { ok: true as const };
};

type BookingSubmissionEmailOptions = {
  formName: string;
  sourcePath: string;
  session: BookingSession;
  estimate: EstimateBreakdown;
  recommendation: PackageRecommendation;
  requestLabel?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export const sendBookingSubmissionEmail = async ({
  formName,
  sourcePath,
  session,
  estimate,
  recommendation,
  requestLabel,
  notes,
  metadata
}: BookingSubmissionEmailOptions) => {
  const payload: BookingFormEmailPayload = {
    kind: "booking",
    formName,
    sourcePath,
    submittedAt: new Date().toISOString(),
    requestLabel:
      requestLabel || labelFor(NEXT_STEP_OPTIONS, session.nextStepIntent) || "Request availability review",
    contact: {
      name: session.contactName || "Not provided",
      email: session.contactEmail || "Not provided",
      phone: session.contactPhone || null,
      organization: session.organization || null,
      role: session.role || null,
      preference: labelFor(CONTACT_PREFERENCE_OPTIONS, session.contactPreference) || null
    },
    event: {
      eventType: labelFor(EVENT_TYPE_OPTIONS, session.eventType) || "Not provided",
      venueType: labelFor(VENUE_TYPE_OPTIONS, session.venueType) || "Not provided",
      eventName: session.eventName || null,
      location: getLocationLabel(session),
      targetDate: session.targetDate || null,
      attendeeCount: session.attendeeCount,
      ticketingModel: labelFor(TICKETING_OPTIONS, session.ticketingModel) || null
    },
    creative: {
      audienceDescription: session.audienceDescription || null,
      vibeProfile: session.vibeProfile || null,
      productionAmbition: labelFor(AMBITION_OPTIONS, session.productionAmbition) || null,
      liveElements: session.liveElements,
      productionNeeds: session.productionNeeds,
      notes: notes || null
    },
    budget: {
      budgetSignal: labelFor(BUDGET_OPTIONS, session.budgetSignal) || null,
      followUpConsent: yesNo(session.followUpConsent),
      outreachConsent: yesNo(session.outreachConsent)
    },
    recommendation: {
      tier: recommendation.tier,
      label: recommendation.label,
      rationale: recommendation.rationale,
      components: recommendation.components
    },
    estimate,
    aiSummary: session.aiSummary,
    metadata: {
      sessionId: session.sessionId,
      status: session.status,
      nextStepIntent: session.nextStepIntent || recommendation.nextStep,
      packagePreference: session.packagePreference || recommendation.tier,
      ...metadata
    }
  };

  return invokeFormSubmissionEmail(payload);
};

type ContactSubmissionEmailOptions = {
  formName: string;
  sourcePath: string;
  fullName: string;
  email: string;
  phone?: string;
  interest: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export const sendContactSubmissionEmail = async ({
  formName,
  sourcePath,
  fullName,
  email,
  phone,
  interest,
  notes,
  metadata
}: ContactSubmissionEmailOptions) => {
  const payload: ContactFormEmailPayload = {
    kind: "contact",
    formName,
    sourcePath,
    submittedAt: new Date().toISOString(),
    contact: {
      name: fullName,
      email,
      phone: phone || null
    },
    details: {
      interest,
      notes: notes || null
    },
    metadata
  };

  return invokeFormSubmissionEmail(payload);
};
