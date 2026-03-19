import type { ReactNode } from "react";
import type { BookingSession, EstimateBreakdown, PackageRecommendation } from "./bookingEngine";
import { formatCurrency } from "./bookingEngine";

type Props = {
  session: BookingSession;
  recommendation: PackageRecommendation;
  estimate: EstimateBreakdown;
  aiSummary: string;
  currency: string;
  readinessLabel: string;
  isWelcomeState: boolean;
  onAction: (action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary") => void;
  submissionState: string;
  rootClassName?: string;
};

const snapshotItems = (session: BookingSession) => [
  { label: "Event", value: session.eventType || "In progress" },
  { label: "Venue", value: session.venueType || "In progress" },
  { label: "Where", value: [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ") || "In progress" },
  { label: "Date", value: session.targetDate || "In progress" },
  { label: "Guests", value: session.attendeeCount ? session.attendeeCount.toLocaleString() : "In progress" },
  { label: "Vibe", value: session.vibeProfile || "In progress" }
];

export default function BookingBlueprintPanel({
  session,
  recommendation,
  estimate,
  aiSummary,
  currency,
  readinessLabel,
  isWelcomeState,
  onAction,
  submissionState,
  rootClassName
}: Props) {
  const title =
    session.eventName ||
    [session.locationCity, session.eventType ? recommendation.label : "Performa Experience"].filter(Boolean).join(" ") ||
    "Performa Event Brief";

  const primaryAction =
    recommendation.nextStep === "schedule-call"
      ? { label: "Request Booking Call", action: "schedule-call" as const }
      : { label: "Submit for Review", action: "availability-review" as const };

  return (
    <section className={rootClassName || "rounded-[2rem] border border-white/15 bg-black/45 p-5 md:p-6"}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold/85">Live Event Brief</p>
          <h3 className="mt-3 font-display text-3xl md:text-4xl">{title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/66">
            {isWelcomeState
              ? "As you answer the booking prompts, this brief will fill in automatically."
              : "A short working brief built from your answers. Final pricing, availability, and approval still require human review."}
          </p>
        </div>
        <span className="rounded-full border border-white/12 bg-black/35 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/58">
          {readinessLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshotItems(session).map((item) => (
          <article key={item.label} className="rounded-[1.25rem] border border-white/10 bg-black/24 p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">{item.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/84">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Recommended package">
          <p className="text-xl font-semibold text-white/92">{recommendation.label}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{recommendation.rationale}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {recommendation.components.map((item) => (
              <span key={item} className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-[11px] text-white/74">
                {item}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Preliminary investment">
          <p className="text-2xl font-semibold text-white">
            {formatCurrency(estimate.totalLow, currency)} - {formatCurrency(estimate.totalHigh, currency)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/64">{estimate.confidenceNote}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {estimate.lines.slice(0, 4).map((line) => (
              <div key={line.label} className="rounded-[1rem] border border-white/10 bg-black/22 p-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/46">{line.label}</p>
                <p className="mt-2 text-sm text-white/84">
                  {formatCurrency(line.low, currency)} - {formatCurrency(line.high, currency)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {!isWelcomeState && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel title="AI readback">
            <p className="text-sm leading-relaxed text-white/74">{aiSummary}</p>
          </Panel>

          <Panel title="Next move">
            <p className="text-sm leading-relaxed text-white/74">
              The strongest next move right now is <span className="text-white">{primaryAction.label.toLowerCase()}</span>.
              Nothing is confirmed until the team reviews availability, scope, and contract terms.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onAction(primaryAction.action)}
                className="rounded-full bg-ember px-5 py-3 text-xs uppercase tracking-[0.24em] text-ink"
              >
                {primaryAction.label}
              </button>
              <button
                type="button"
                onClick={() => onAction("email-package")}
                className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/80"
              >
                Email Me the Package
              </button>
              <button
                type="button"
                onClick={() => onAction("save-follow-up")}
                className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/80"
              >
                Save for Later
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onAction("download-brief")}
                className="rounded-full border border-gold/35 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-gold"
              >
                Download Press Kit
              </button>
              <button
                type="button"
                onClick={() => onAction("copy-summary")}
                className="rounded-full border border-gold/35 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-gold"
              >
                Copy Summary
              </button>
            </div>
            {submissionState && <p className="mt-4 text-sm text-gold">{submissionState}</p>}
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/12 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/46">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}
