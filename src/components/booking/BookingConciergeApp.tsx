import { useEffect, useMemo, useState } from "react";
import BookingBlueprintModal from "./BookingBlueprintModal";
import BookingChatPanel, { type StepKey } from "./BookingChatPanel";
import BookingClaudeDrawer from "./BookingClaudeDrawer";
import {
  defaultBookingSession,
  formatCurrency,
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

const getResumeStep = (session: BookingSession): StepKey => {
  if (!session.eventType) return "eventType";
  if (!session.venueType) return "venueType";
  if (!session.locationCity) return "location";
  if (!session.targetDate) return "targetDate";
  if (!session.attendeeCount) return "attendeeCount";
  if (!session.ticketingModel) return "ticketingModel";
  if (!session.audienceDescription) return "audienceDescription";
  if (!session.vibeProfile) return "vibeProfile";
  if (!session.productionAmbition) return "productionAmbition";
  if (!session.liveElements.length) return "liveElements";
  if (!session.productionNeeds.length) return "productionNeeds";
  if (!session.budgetSignal) return "budgetSignal";
  if (!session.nextStepIntent) return "nextStepIntent";
  return "contact";
};

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

const hasSubmissionContact = (session: BookingSession) =>
  Boolean(session.contactName && session.contactEmail && session.followUpConsent);

const getPrimaryActionConfig = (
  session: BookingSession,
  recommendation: ReturnType<typeof getRecommendedPackage>,
  progress: number
) => {
  if (!hasSubmissionContact(session)) {
    if (progress >= 70) {
      return {
        label: "Finish Contact Details",
        action: null as null,
        helper: "Add contact details to submit the brief."
      };
    }
    return null;
  }

  const requestedAction = session.nextStepIntent || recommendation.nextStep;
  switch (requestedAction) {
    case "schedule-call":
      return {
        label: "Request Booking Call",
        action: "schedule-call" as const,
        helper: "Recommended for larger or more produced events."
      };
    case "email-package":
      return {
        label: "Email My Package",
        action: "email-package" as const,
        helper: "Send the brief for later internal review."
      };
    case "save-follow-up":
      return {
        label: "Save for Follow-Up",
        action: "save-follow-up" as const,
        helper: "Hold the draft and let the team follow up."
      };
    default:
      return {
        label: "Submit for Review",
        action: "availability-review" as const,
        helper: "Best for availability and scope review."
      };
  }
};

export default function BookingConciergeApp() {
  const [session, setSession] = useState<BookingSession>(defaultBookingSession());
  const [currentStep, setCurrentStep] = useState<StepKey>("eventType");
  const [submissionState, setSubmissionState] = useState("");
  const [autosaveTick, setAutosaveTick] = useState(0);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);

  useEffect(() => {
    const stored = readStoredSession();
    setSession(stored);
    setCurrentStep(getResumeStep(stored));
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock = blueprintOpen || claudeOpen;
    const previous = document.body.style.overflow;
    if (shouldLock) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [blueprintOpen, claudeOpen]);

  const progress = getProgressPercent(session);
  const recommendation = getRecommendedPackage(session);
  const estimate = getEstimateBreakdown(session);
  const aiSummary = generateAiSummary(session);
  const readinessLabel = getReadinessState(session);
  const isWelcomeState = progress === 0;
  const primaryAction = useMemo(
    () => getPrimaryActionConfig(session, recommendation, progress),
    [progress, recommendation, session]
  );

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

  const resetSession = () => {
    const fresh = defaultBookingSession();
    setSession(fresh);
    setCurrentStep("eventType");
    setSubmissionState("");
    setBlueprintOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleAction = async (
    action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary"
  ) => {
    if (action === "download-brief") {
      window.open("/media/press-kit.pdf", "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "copy-summary") {
      const summary = `${aiSummary}\nEstimated range: ${formatCurrency(estimate.totalLow)} - ${formatCurrency(estimate.totalHigh)}`;
      await navigator.clipboard.writeText(summary);
      setSubmissionState("Event summary copied.");
      return;
    }

    if (!hasSubmissionContact(session)) {
      setCurrentStep("contact");
      setSubmissionState("Add contact details and permission so the team can review the brief.");
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
        ? "Booking call request prepared for human review."
        : action === "email-package"
          ? "Package request logged for follow-up."
          : action === "save-follow-up"
            ? "Brief saved for follow-up."
            : "Availability review request submitted for human review."
    );
  };

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="rounded-[1.7rem] border border-white/12 bg-black/40 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">Straightforward Booking Flow</p>
              <p className="mt-2 text-sm leading-relaxed text-white/68">
                One AI-guided brief, one live event draft, one clean handoff to human review.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setClaudeOpen(true)}
                className="rounded-full border border-gold/35 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold"
              >
                Ask Claude
              </button>
              <button
                type="button"
                onClick={() => setBlueprintOpen(true)}
                className="rounded-full border border-white/15 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-white/76"
              >
                View Brief
              </button>
              {primaryAction && (
                <button
                  type="button"
                  onClick={() => {
                    if (primaryAction.action) {
                      void handleAction(primaryAction.action);
                    } else {
                      setCurrentStep("contact");
                    }
                  }}
                  className="rounded-full bg-ember px-5 py-3 text-[11px] uppercase tracking-[0.26em] text-ink"
                >
                  {primaryAction.label}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill label={readinessLabel} />
            {session.eventType && <StatusPill label={recommendation.label} />}
            {progress > 0 && <StatusPill label={`${progress}% mapped`} />}
            {progress >= 35 && <StatusPill label={`${formatCurrency(estimate.totalLow)} - ${formatCurrency(estimate.totalHigh)}`} />}
          </div>

          {primaryAction?.helper && (
            <p className="mt-3 text-xs text-white/52">{primaryAction.helper}</p>
          )}
          {submissionState && <p className="mt-3 text-sm text-gold">{submissionState}</p>}
        </div>

        <div className="mt-6">
          <BookingChatPanel
            session={session}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onUpdate={updateSession}
            onBack={() => setCurrentStep(getPrevStep(currentStep))}
            onContinue={() => setCurrentStep(getNextStep(currentStep))}
            onReset={resetSession}
            onOpenBlueprint={() => setBlueprintOpen(true)}
            onOpenClaude={() => setClaudeOpen(true)}
            progress={progress}
          />
        </div>
      </section>

      <BookingBlueprintModal
        open={blueprintOpen}
        onClose={() => setBlueprintOpen(false)}
        session={session}
        recommendation={recommendation}
        estimate={estimate}
        aiSummary={aiSummary}
        readinessLabel={readinessLabel}
        isWelcomeState={isWelcomeState}
        onAction={handleAction}
        submissionState={submissionState}
      />

      <BookingClaudeDrawer
        open={claudeOpen}
        onClose={() => setClaudeOpen(false)}
        session={session}
        aiSummary={aiSummary}
        recommendation={recommendation}
        estimate={estimate}
      />
    </>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/60">
      {label}
    </span>
  );
}
