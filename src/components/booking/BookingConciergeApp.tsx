import { useEffect, useState } from "react";
import BookingBlueprintPanel from "./BookingBlueprintPanel";
import BookingChatPanel, { type StepKey } from "./BookingChatPanel";
import {
  defaultBookingSession,
  generateAiSummary,
  getEstimateBreakdown,
  getProgressPercent,
  getReadinessState,
  getRecommendedPackage,
  type BookingSession
} from "./bookingEngine";
import { persistBookingConciergeSession } from "../../lib/bookingConcierge";

const STORAGE_KEY = "the-performa-booking-concierge-v1";
const STEP_ORDER: StepKey[] = [
  "welcome",
  "eventType",
  "venueType",
  "location",
  "targetDate",
  "attendeeCount",
  "ticketingModel",
  "audienceDescription",
  "vibeProfile",
  "productionAmbition",
  "liveElements",
  "productionNeeds",
  "budgetSignal",
  "nextStepIntent",
  "contact"
];

const getNextStep = (current: StepKey) => STEP_ORDER[Math.min(STEP_ORDER.length - 1, STEP_ORDER.indexOf(current) + 1)];
const getPrevStep = (current: StepKey) => STEP_ORDER[Math.max(0, STEP_ORDER.indexOf(current) - 1)];

const readStoredSession = (): BookingSession => {
  if (typeof window === "undefined") return defaultBookingSession();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBookingSession();
    return { ...defaultBookingSession(), ...JSON.parse(raw) } as BookingSession;
  } catch {
    return defaultBookingSession();
  }
};

export default function BookingConciergeApp() {
  const [session, setSession] = useState<BookingSession>(defaultBookingSession());
  const [currentStep, setCurrentStep] = useState<StepKey>("welcome");
  const [submissionState, setSubmissionState] = useState("");
  const [autosaveTick, setAutosaveTick] = useState(0);

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    const timer = window.setTimeout(() => setAutosaveTick((value) => value + 1), 900);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    if (!autosaveTick) return;
    void persistBookingConciergeSession(session, "autosave");
  }, [autosaveTick, session]);

  const progress = getProgressPercent(session);
  const recommendation = getRecommendedPackage(session);
  const estimate = getEstimateBreakdown(session);
  const aiSummary = generateAiSummary(session);
  const readinessLabel = getReadinessState(session);
  const isWelcomeState = currentStep === "welcome";

  const updateSession = (patch: Partial<BookingSession>) => {
    const nextSession = {
      ...session,
      ...patch,
      updatedAt: new Date().toISOString()
    } as BookingSession;
    nextSession.aiSummary = generateAiSummary(nextSession);
    nextSession.status = getProgressPercent(nextSession) >= 75 ? "estimate_ready" : nextSession.status;
    setSession(nextSession);
  };

  const handleAction = async (action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary") => {
    if (action === "download-brief") {
      window.open("/media/press-kit.pdf", "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "copy-summary") {
      const summary = `${aiSummary}\nEstimated range: ${estimate.totalLow} - ${estimate.totalHigh}`;
      await navigator.clipboard.writeText(summary);
      setSubmissionState("Event summary copied for your team.");
      return;
    }

    if (!session.contactName || !session.contactEmail || !session.followUpConsent) {
      setCurrentStep("contact");
      setSubmissionState("Add your contact details and follow-up permission so I can prepare the next step.");
      return;
    }

    const mode = action === "email-package" ? "email" : action === "save-follow-up" ? "follow_up" : "submit";
    const nextStatus = mode === "email" ? "emailed" : mode === "follow_up" ? "follow_up" : "submitted";
    const nextSession = {
      ...session,
      status: nextStatus,
      nextStepIntent:
        action === "schedule-call"
          ? "schedule-call"
          : action === "email-package"
            ? "email-package"
            : action === "save-follow-up"
              ? "save-follow-up"
              : "availability-review",
      aiSummary,
      updatedAt: new Date().toISOString()
    } as BookingSession;

    setSession(nextSession);
    const result = await persistBookingConciergeSession(nextSession, mode);
    if (!result.ok) {
      setSubmissionState(result.error);
      return;
    }

    setSubmissionState(
      action === "schedule-call"
        ? "Your booking call request is prepared for human review. Final scheduling depends on availability and team confirmation."
        : action === "email-package"
          ? "Your package request has been logged for follow-up. The team can review and send the summary manually."
          : action === "save-follow-up"
            ? "Your blueprint has been saved for follow-up. A human review is still required before any booking path advances."
            : "Your availability review request is submitted for human review. Final booking is subject to availability, approval, and contract."
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
        <BookingChatPanel
          session={session}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onUpdate={updateSession}
          onBack={() => setCurrentStep(getPrevStep(currentStep))}
          onContinue={() => setCurrentStep(getNextStep(currentStep))}
          progress={progress}
          readinessLabel={readinessLabel}
          aiSummary={aiSummary}
        />
        <BookingBlueprintPanel
          session={session}
          recommendation={recommendation}
          estimate={estimate}
          aiSummary={aiSummary}
          readinessLabel={readinessLabel}
          isWelcomeState={isWelcomeState}
          onAction={handleAction}
          submissionState={submissionState}
        />
      </div>
    </section>
  );
}
