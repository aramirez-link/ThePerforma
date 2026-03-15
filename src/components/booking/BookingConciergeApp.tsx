import { useEffect, useState } from "react";
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

const getResumeStep = (session: BookingSession): StepKey => {
  if (!session.eventType) return "welcome";
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
  if (!session.contactEmail) return "contact";
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

export default function BookingConciergeApp() {
  const [session, setSession] = useState<BookingSession>(defaultBookingSession());
  const [currentStep, setCurrentStep] = useState<StepKey>("welcome");
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

  const resetSession = () => {
    const fresh = defaultBookingSession();
    setSession(fresh);
    setCurrentStep("welcome");
    setSubmissionState("");
    setBlueprintOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleAction = async (action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary") => {
    if (action === "download-brief") {
      window.open("/media/press-kit.pdf", "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "copy-summary") {
      const summary = `${aiSummary}\nEstimated range: ${formatCurrency(estimate.totalLow)} - ${formatCurrency(estimate.totalHigh)}`;
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
    <>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="sticky top-20 z-20 rounded-[1.7rem] border border-white/12 bg-black/55 p-4 backdrop-blur-xl">
          <div className="grid gap-3 xl:grid-cols-[0.95fr_0.95fr_1.1fr_auto] xl:items-center">
            <WorkspaceCard
              label="Conversation Status"
              value={readinessLabel}
              detail={`${progress}% of the booking brief mapped`}
            />
            <WorkspaceCard
              label="Package Fit"
              value={recommendation.label}
              detail={recommendation.rationale}
            />
            <WorkspaceCard
              label="Preliminary Range"
              value={`${formatCurrency(estimate.totalLow)} - ${formatCurrency(estimate.totalHigh)}`}
              detail="Preliminary only. Final review, availability, scope, and contract still apply."
            />

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <button
                type="button"
                onClick={() => setClaudeOpen(true)}
                className="rounded-full border border-gold/35 px-5 py-3 text-[11px] uppercase tracking-[0.26em] text-gold transition hover:border-gold/55"
              >
                Ask Claude
              </button>
              <button
                type="button"
                onClick={() => setBlueprintOpen(true)}
                className="rounded-full bg-ember px-5 py-3 text-[11px] uppercase tracking-[0.26em] text-ink"
              >
                Open Event Blueprint
              </button>
            </div>
          </div>
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
            readinessLabel={readinessLabel}
            aiSummary={aiSummary}
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

function WorkspaceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-black/26 p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">{label}</p>
      <p className="mt-2 text-sm text-white/90">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/56">{detail}</p>
    </article>
  );
}
