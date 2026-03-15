import type { BookingSession, EstimateBreakdown, PackageRecommendation } from "./bookingEngine";
import { formatCurrency, getDependencies, getStaffingAssumptions } from "./bookingEngine";

type Props = {
  session: BookingSession;
  recommendation: PackageRecommendation;
  estimate: EstimateBreakdown;
  aiSummary: string;
  readinessLabel: string;
  isWelcomeState: boolean;
  onAction: (action: "availability-review" | "schedule-call" | "email-package" | "save-follow-up" | "download-brief" | "copy-summary") => void;
  submissionState: string;
};

export default function BookingBlueprintPanel({
  session,
  recommendation,
  estimate,
  aiSummary,
  readinessLabel,
  isWelcomeState,
  onAction,
  submissionState
}: Props) {
  const title =
    session.eventName ||
    [session.locationCity, session.eventType ? recommendation.label : "Performa Experience"].filter(Boolean).join(" ") ||
    "Performa Event Blueprint";

  return (
    <aside className="rounded-[2rem] border border-white/15 bg-black/45 p-5 md:p-6 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold/85">Event Blueprint</p>
          <h3 className="mt-3 font-display text-3xl md:text-4xl">{title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/66">
            {readinessLabel}. This blueprint is preliminary and designed for human review, availability screening, and contract follow-through.
          </p>
        </div>
        <span className="rounded-full border border-white/12 bg-black/35 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/58">
          {session.status}
        </span>
      </div>

      <div className="mt-5 rounded-[1.4rem] border border-white/12 bg-black/28 p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">What You’re Seeing</p>
        {isWelcomeState ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-white/70">
              Once you start the interview, this panel will turn into your live event blueprint.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/24 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">Will Build Live</p>
                <p className="mt-2 text-sm leading-relaxed text-white/72">Event profile, package recommendation, investment range, and next-step path.</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/24 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">Important</p>
                <p className="mt-2 text-sm leading-relaxed text-white/72">Everything here is preliminary until the team reviews availability, scope, and contract terms.</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            This panel updates in real time as the concierge captures your event details. It shows the current event model, package fit, preliminary investment range, and the next action the team would recommend.
          </p>
        )}
      </div>

      <div className={`mt-5 grid gap-4 ${isWelcomeState ? "opacity-55" : ""}`}>
        <Panel title="Event Summary">
          <InfoLine label="Event type" value={session.eventType || "In progress"} />
          <InfoLine label="Venue" value={session.venueType || "In progress"} />
          <InfoLine label="Location" value={[session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ") || "In progress"} />
          <InfoLine label="Target date" value={session.targetDate || "In progress"} />
          <InfoLine label="Attendance" value={session.attendeeCount ? session.attendeeCount.toLocaleString() : "In progress"} />
          <InfoLine label="Ticketing" value={session.ticketingModel || "In progress"} />
          <InfoLine label="Vibe" value={session.vibeProfile || "In progress"} />
        </Panel>

        <Panel title="Recommended Package">
          <p className="text-xl font-semibold text-white/92">{recommendation.label}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{recommendation.rationale}</p>
          <ul className="mt-4 space-y-2 text-sm text-white/74">
            {recommendation.components.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Estimated Investment">
          <p className="text-2xl font-semibold text-white">{formatCurrency(estimate.totalLow)} - {formatCurrency(estimate.totalHigh)}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/64">{estimate.confidenceNote}</p>
          <div className="mt-4 space-y-3">
            {estimate.lines.map((line) => (
              <div key={line.label} className="rounded-[1rem] border border-white/10 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/86">{line.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/52">{line.note}</p>
                  </div>
                  <p className="text-sm text-white/78">{formatCurrency(line.low)} - {formatCurrency(line.high)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Production Assumptions">
          <ul className="space-y-2 text-sm text-white/74">
            {getStaffingAssumptions(session).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Dependencies / Risks">
          <ul className="space-y-2 text-sm text-white/74">
            {getDependencies(session).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="AI Summary">
          <p className="text-sm leading-relaxed text-white/74">{aiSummary}</p>
        </Panel>

        <Panel title="Next Steps">
          <p className="text-sm leading-relaxed text-white/74">
            Based on the current event profile, the next best step is <span className="text-white">{recommendation.nextStep.replace("-", " ")}</span>. Nothing is confirmed until the team reviews availability, approves scope, and executes contract.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => onAction("availability-review")} className="rounded-full bg-ember px-5 py-3 text-xs uppercase tracking-[0.24em] text-ink">
              Request Availability Review
            </button>
            <button type="button" onClick={() => onAction("schedule-call")} className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/80">
              Schedule Booking Call
            </button>
            <button type="button" onClick={() => onAction("email-package")} className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/80">
              Email Me the Package
            </button>
            <button type="button" onClick={() => onAction("save-follow-up")} className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/80">
              Save for Later
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => onAction("download-brief")} className="rounded-full border border-gold/35 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-gold">
              Download Event Brief
            </button>
            <button type="button" onClick={() => onAction("copy-summary")} className="rounded-full border border-gold/35 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-gold">
              Copy Event Summary
            </button>
          </div>
          {submissionState && <p className="mt-4 text-sm text-gold">{submissionState}</p>}
        </Panel>
      </div>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/12 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/46">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/8 py-2 text-sm last:border-b-0">
      <span className="text-white/48">{label}</span>
      <span className="text-right text-white/82">{value}</span>
    </div>
  );
}
