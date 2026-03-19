import { useEffect } from "react";
import type { BookingSession, EstimateBreakdown, PackageRecommendation } from "./bookingEngine";
import BookingBlueprintPanel from "./BookingBlueprintPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  session: BookingSession;
  recommendation: PackageRecommendation;
  estimate: EstimateBreakdown;
  aiSummary: string;
  currency: string;
  readinessLabel: string;
  isWelcomeState: boolean;
  onAction: (action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary") => void;
  submissionState: string;
};

export default function BookingBlueprintModal({
  open,
  onClose,
  session,
  recommendation,
  estimate,
  aiSummary,
  currency,
  readinessLabel,
  isWelcomeState,
  onAction,
  submissionState
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 p-4 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-blueprint-title"
      onClick={onClose}
    >
      <div className="mx-auto flex h-full max-w-5xl items-start justify-center">
        <div
          className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#08080d] shadow-[0_28px_120px_rgba(0,0,0,0.55)] md:max-h-[calc(100vh-3rem)] md:max-w-4xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/80">Live Event Brief</p>
              <h2 id="booking-blueprint-title" className="mt-2 font-display text-2xl text-white">Booking Draft</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/72 transition hover:border-white/30 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="overflow-y-auto p-3 md:p-4">
            <BookingBlueprintPanel
              session={session}
              recommendation={recommendation}
              estimate={estimate}
              aiSummary={aiSummary}
              currency={currency}
              readinessLabel={readinessLabel}
              isWelcomeState={isWelcomeState}
              onAction={onAction}
              submissionState={submissionState}
              rootClassName="rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 md:p-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
