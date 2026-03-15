import type { ReactNode } from "react";
import type { BookingSession, BudgetSignal, ContactPreference, NextStepIntent, ProductionAmbition, TicketingModel } from "./bookingEngine";
import {
  AMBITION_OPTIONS,
  BUDGET_OPTIONS,
  CONTACT_PREFERENCE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  LIVE_ELEMENT_OPTIONS,
  NEXT_STEP_OPTIONS,
  PRODUCTION_NEED_OPTIONS,
  TICKETING_OPTIONS,
  VENUE_TYPE_OPTIONS,
  VIBE_OPTIONS
} from "./bookingEngine";

export type StepKey =
  | "welcome"
  | "eventType"
  | "venueType"
  | "location"
  | "targetDate"
  | "attendeeCount"
  | "ticketingModel"
  | "audienceDescription"
  | "vibeProfile"
  | "productionAmbition"
  | "liveElements"
  | "productionNeeds"
  | "budgetSignal"
  | "nextStepIntent"
  | "contact";

type Props = {
  session: BookingSession;
  currentStep: StepKey;
  onStepChange: (step: StepKey) => void;
  onUpdate: (patch: Partial<BookingSession>) => void;
  onBack: () => void;
  onContinue: () => void;
  onReset: () => void;
  onOpenBlueprint: () => void;
  onOpenClaude: () => void;
  progress: number;
  readinessLabel: string;
  aiSummary: string;
};

const stepOrder: StepKey[] = [
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

const sectionTitle = {
  welcome: "Welcome",
  eventType: "Event Type",
  venueType: "Venue Type",
  location: "Location",
  targetDate: "Target Date",
  attendeeCount: "Attendance",
  ticketingModel: "Ticketing",
  audienceDescription: "Audience",
  vibeProfile: "Vibe",
  productionAmbition: "Production Ambition",
  liveElements: "Live Elements",
  productionNeeds: "Production Support",
  budgetSignal: "Budget Signal",
  nextStepIntent: "Preferred Next Step",
  contact: "Contact + Consent"
} as const;

const questionCopy: Record<StepKey, string> = {
  welcome:
    "I'm your Performa Booking Concierge. I'll shape the event brief with you, build a live blueprint in the background, and then recommend the strongest next move for human review.",
  eventType: "What kind of event are we designing?",
  venueType: "What kind of room or venue are we working with?",
  location: "Where is this event happening?",
  targetDate: "What date are you aiming for?",
  attendeeCount: "How many guests are you expecting?",
  ticketingModel: "How is the event being sold or managed?",
  audienceDescription: "Tell me about the audience and the atmosphere you want the room to carry.",
  vibeProfile: "What should the experience feel like?",
  productionAmbition: "How ambitious should the production feel?",
  liveElements: "Which live elements should be part of the show?",
  productionNeeds: "Which production or support layers should I account for?",
  budgetSignal: "What budget range feels realistic right now?",
  nextStepIntent: "When the blueprint is ready, what would be most useful?",
  contact: "Where should I send this, and how should the team follow up if there is a fit?"
};

const conversationChapters = [
  { label: "Event Brief", caption: "Map the event type, room, audience, and location." },
  { label: "Experience Design", caption: "Layer in live elements, production ambition, and vibe." },
  { label: "Review + Handoff", caption: "Prepare the blueprint for human review and follow-up." }
];

const introCards = [
  {
    title: "What this does",
    copy: "Builds a preliminary booking blueprint, package recommendation, and investment range in real time."
  },
  {
    title: "Where to look",
    copy: "Stay in the conversation here. Open the floating Event Blueprint whenever you want the full model."
  },
  {
    title: "Important",
    copy: "Nothing here confirms a booking. Final availability, scope, pricing, approval, and contract all require human review."
  }
];

const bubbleClass = "max-w-[88%] rounded-[1.6rem] px-4 py-4 shadow-[0_10px_34px_rgba(0,0,0,0.18)]";

const chipClass = (active: boolean) =>
  `rounded-full border px-4 py-3 text-sm transition ${
    active ? "border-gold/55 bg-gold/10 text-gold" : "border-white/12 bg-white/[0.03] text-white/82 hover:border-white/28"
  }`;

const renderAnswer = (session: BookingSession, step: StepKey) => {
  switch (step) {
    case "eventType":
      return EVENT_TYPE_OPTIONS.find((item) => item.value === session.eventType)?.label || "";
    case "venueType":
      return VENUE_TYPE_OPTIONS.find((item) => item.value === session.venueType)?.label || "";
    case "location":
      return [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ");
    case "targetDate":
      return session.targetDate || "";
    case "attendeeCount":
      return session.attendeeCount ? `${session.attendeeCount.toLocaleString()} guests expected` : "";
    case "ticketingModel":
      return TICKETING_OPTIONS.find((item) => item.value === session.ticketingModel)?.label || "";
    case "audienceDescription":
      return session.audienceDescription || "";
    case "vibeProfile":
      return session.vibeProfile || "";
    case "productionAmbition":
      return AMBITION_OPTIONS.find((item) => item.value === session.productionAmbition)?.label || "";
    case "liveElements":
      return session.liveElements.join(", ");
    case "productionNeeds":
      return [
        session.productionNeeds.join(", "),
        session.wantsBrandIntegration === true ? "Brand integration: yes" : session.wantsBrandIntegration === false ? "Brand integration: no" : "",
        session.wantsHostMoments === true ? "Host / MC moments: yes" : session.wantsHostMoments === false ? "Host / MC moments: no" : "",
        session.languageConsiderations ? `Notes: ${session.languageConsiderations}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
    case "budgetSignal":
      return BUDGET_OPTIONS.find((item) => item.value === session.budgetSignal)?.label || "";
    case "nextStepIntent":
      return NEXT_STEP_OPTIONS.find((item) => item.value === session.nextStepIntent)?.label || "";
    case "contact":
      return [session.contactName, session.contactEmail, session.organization, session.contactPreference].filter(Boolean).join(" | ");
    default:
      return "";
  }
};

const stepAnswered = (session: BookingSession, step: StepKey) => Boolean(renderAnswer(session, step));

export default function BookingChatPanel({
  session,
  currentStep,
  onStepChange,
  onUpdate,
  onBack,
  onContinue,
  onReset,
  onOpenBlueprint,
  onOpenClaude,
  progress,
  readinessLabel,
  aiSummary
}: Props) {
  const isWelcome = currentStep === "welcome";
  const answeredSteps = stepOrder.filter((step) => step !== "welcome" && stepAnswered(session, step));
  const currentStepIndex = stepOrder.indexOf(currentStep);

  return (
    <section className="rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:p-5">
      <div className="rounded-[1.6rem] border border-white/12 bg-black/35 px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-[radial-gradient(circle,rgba(243,211,139,0.22),rgba(7,7,11,0.2))] text-sm uppercase tracking-[0.28em] text-gold">
              AI
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">Performa Booking Concierge</p>
              <h2 className="mt-2 font-display text-2xl text-white">Producer-level guidance, one answer at a time</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/68">
                Stay in the conversation here. Open the blueprint when you want the full event model, or ask Claude
                direct questions about The Performa and your booking fit.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenClaude}
              className="rounded-full border border-gold/30 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-gold transition hover:border-gold/55"
            >
              Ask Claude
            </button>
            <button
              type="button"
              onClick={onOpenBlueprint}
              className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/78 transition hover:border-white/28 hover:text-white"
            >
              Open Blueprint
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/62 transition hover:border-white/28 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3 md:grid-cols-3">
            {conversationChapters.map((chapter, index) => (
              <article key={chapter.label} className="rounded-[1.2rem] border border-white/10 bg-black/25 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">{`0${index + 1}`}</p>
                <p className="mt-2 text-sm text-white/88">{chapter.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/56">{chapter.caption}</p>
              </article>
            ))}
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-4 lg:min-w-[13rem]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/48">Readiness</p>
            <p className="mt-2 text-sm text-white/88">{readinessLabel}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-white/48">{progress}% of the booking brief mapped</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.8rem] border border-white/12 bg-black/28 p-4">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {isWelcome && (
            <>
              <AssistantBubble title="Start here">
                {questionCopy.welcome}
              </AssistantBubble>

              <div className="grid gap-3 md:grid-cols-3">
                {introCards.map((card) => (
                  <article key={card.title} className="rounded-[1.3rem] border border-white/10 bg-black/22 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{card.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/68">{card.copy}</p>
                  </article>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={onOpenClaude}
                  className="rounded-full border border-white/18 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/76"
                >
                  Ask Claude First
                </button>
                <button
                  type="button"
                  onClick={onContinue}
                  className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.26em] text-ink"
                >
                  Start the Booking Brief
                </button>
              </div>
            </>
          )}

          {!isWelcome &&
            answeredSteps.map((step) => (
              <div key={step} className="space-y-2">
                <AssistantBubble title={sectionTitle[step]}>{questionCopy[step]}</AssistantBubble>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onStepChange(step)}
                    className={`${bubbleClass} bg-[linear-gradient(135deg,rgba(242,84,45,0.94),rgba(255,123,48,0.96))] text-left text-ink transition hover:opacity-95`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.24em] text-ink/70">You answered</p>
                    <p className="mt-2 text-sm leading-relaxed">{renderAnswer(session, step)}</p>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-ink/65">Tap to edit</p>
                  </button>
                </div>
              </div>
            ))}

          {!isWelcome && (
            <>
              <AssistantBubble title={`Current Prompt / ${sectionTitle[currentStep]}`}>
                {questionCopy[currentStep]}
              </AssistantBubble>

              <div className="rounded-[1.6rem] border border-gold/20 bg-[linear-gradient(180deg,rgba(242,84,45,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Response Composer</p>
                    <p className="mt-2 text-sm text-white/62">
                      Step {currentStepIndex} of {stepOrder.length - 1}. The blueprint keeps building in the background.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenBlueprint}
                    className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/74 transition hover:border-white/28 hover:text-white"
                  >
                    View Blueprint
                  </button>
                </div>

                <div className="mt-4">{renderComposer({ currentStep, session, onUpdate, onContinue })}</div>

                {["location", "targetDate", "attendeeCount", "audienceDescription", "liveElements", "productionNeeds", "contact"].includes(currentStep) && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={onBack}
                      className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/76"
                    >
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenClaude}
                        className="rounded-full border border-gold/30 px-5 py-3 text-xs uppercase tracking-[0.24em] text-gold"
                      >
                        Ask Claude
                      </button>
                      <button
                        type="button"
                        onClick={onContinue}
                        className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/22 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Concierge Readback</p>
                <p className="mt-2 text-sm leading-relaxed text-white/68">{aiSummary}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function AssistantBubble({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${bubbleClass} border border-white/12 bg-black/34 text-white/86`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{title}</p>
      <p className="mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function renderComposer({
  currentStep,
  session,
  onUpdate,
  onContinue
}: {
  currentStep: StepKey;
  session: BookingSession;
  onUpdate: (patch: Partial<BookingSession>) => void;
  onContinue: () => void;
}) {
  if (currentStep === "eventType") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {EVENT_TYPE_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.eventType === item.value)}
            onClick={() => {
              onUpdate({ eventType: item.value });
              onContinue();
            }}
          >
            <span className="block text-left">{item.label}</span>
            <span className="mt-2 block text-left text-[11px] text-white/52">{item.caption}</span>
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "venueType") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {VENUE_TYPE_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.venueType === item.value)}
            onClick={() => {
              onUpdate({ venueType: item.value });
              onContinue();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "location") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={session.locationCity}
          onChange={(event) => onUpdate({ locationCity: event.target.value })}
          placeholder="City"
          aria-label="City"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.locationState}
          onChange={(event) => onUpdate({ locationState: event.target.value })}
          placeholder="State / Province"
          aria-label="State or province"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.locationCountry}
          onChange={(event) => onUpdate({ locationCountry: event.target.value })}
          placeholder="Country"
          aria-label="Country"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
      </div>
    );
  }

  if (currentStep === "targetDate") {
    return (
      <input
        type="date"
        value={session.targetDate}
        onChange={(event) => onUpdate({ targetDate: event.target.value })}
        aria-label="Target date"
        className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white"
      />
    );
  }

  if (currentStep === "attendeeCount") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[250, 500, 1000, 2500, 5000].map((count) => (
            <button
              key={count}
              type="button"
              className={chipClass(session.attendeeCount === count)}
              onClick={() => onUpdate({ attendeeCount: count })}
            >
              {count.toLocaleString()}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={50}
          value={session.attendeeCount || ""}
          onChange={(event) => onUpdate({ attendeeCount: Math.max(50, Number(event.target.value || 0)) })}
          placeholder="Or enter expected attendance"
          aria-label="Expected attendance"
          className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
      </div>
    );
  }

  if (currentStep === "ticketingModel") {
    return (
      <div className="flex flex-wrap gap-2">
        {TICKETING_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.ticketingModel === item.value)}
            onClick={() => {
              onUpdate({ ticketingModel: item.value as TicketingModel });
              onContinue();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "audienceDescription") {
    return (
      <textarea
        value={session.audienceDescription}
        onChange={(event) => onUpdate({ audienceDescription: event.target.value })}
        rows={4}
        placeholder="Describe the audience, room energy, and what success should feel like."
        aria-label="Audience description"
        className="w-full rounded-[1.4rem] border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
      />
    );
  }

  if (currentStep === "vibeProfile") {
    return (
      <div className="flex flex-wrap gap-2">
        {VIBE_OPTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className={chipClass(session.vibeProfile === item)}
            onClick={() => {
              onUpdate({ vibeProfile: item });
              onContinue();
            }}
          >
            {item}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "productionAmbition") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {AMBITION_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.productionAmbition === item.value)}
            onClick={() => {
              onUpdate({ productionAmbition: item.value as ProductionAmbition });
              onContinue();
            }}
          >
            <span className="block text-left">{item.label}</span>
            <span className="mt-2 block text-left text-[11px] text-white/52">{item.caption}</span>
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "liveElements") {
    return <MultiToggle options={LIVE_ELEMENT_OPTIONS} values={session.liveElements} onChange={(values) => onUpdate({ liveElements: values })} />;
  }

  if (currentStep === "productionNeeds") {
    return (
      <div className="space-y-4">
        <MultiToggle options={PRODUCTION_NEED_OPTIONS} values={session.productionNeeds} onChange={(values) => onUpdate({ productionNeeds: values })} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/74">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-white/50">Brand integration</span>
            <select
              value={session.wantsBrandIntegration === null ? "" : session.wantsBrandIntegration ? "yes" : "no"}
              onChange={(event) => onUpdate({ wantsBrandIntegration: event.target.value ? event.target.value === "yes" : null })}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-white"
            >
              <option value="">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/74">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-white/50">Host / MC moments</span>
            <select
              value={session.wantsHostMoments === null ? "" : session.wantsHostMoments ? "yes" : "no"}
              onChange={(event) => onUpdate({ wantsHostMoments: event.target.value ? event.target.value === "yes" : null })}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-white"
            >
              <option value="">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <textarea
          value={session.languageConsiderations}
          onChange={(event) => onUpdate({ languageConsiderations: event.target.value })}
          rows={3}
          placeholder="Language, cultural, or audience-diversity considerations"
          aria-label="Language, cultural, or audience considerations"
          className="w-full rounded-[1.2rem] border border-white/12 bg-black/25 px-4 py-3 text-white placeholder:text-white/35"
        />
      </div>
    );
  }

  if (currentStep === "budgetSignal") {
    return (
      <div className="flex flex-wrap gap-2">
        {BUDGET_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.budgetSignal === item.value)}
            onClick={() => {
              onUpdate({ budgetSignal: item.value as BudgetSignal });
              onContinue();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "nextStepIntent") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {NEXT_STEP_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={chipClass(session.nextStepIntent === item.value)}
            onClick={() => {
              onUpdate({ nextStepIntent: item.value as NextStepIntent });
              onContinue();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "contact") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={session.contactName}
          onChange={(event) => onUpdate({ contactName: event.target.value })}
          placeholder="Full name"
          aria-label="Full name"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.contactEmail}
          onChange={(event) => onUpdate({ contactEmail: event.target.value })}
          placeholder="Email"
          type="email"
          aria-label="Email"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.contactPhone}
          onChange={(event) => onUpdate({ contactPhone: event.target.value })}
          placeholder="Phone"
          aria-label="Phone"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.organization}
          onChange={(event) => onUpdate({ organization: event.target.value })}
          placeholder="Company / Organization"
          aria-label="Company or organization"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          value={session.role}
          onChange={(event) => onUpdate({ role: event.target.value })}
          placeholder="Role"
          aria-label="Role"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35"
        />
        <select
          value={session.contactPreference}
          onChange={(event) => onUpdate({ contactPreference: event.target.value as ContactPreference })}
          aria-label="Preferred follow-up method"
          className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white"
        >
          <option value="">Preferred follow-up</option>
          {CONTACT_PREFERENCE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/78">
          <input type="checkbox" checked={session.followUpConsent} onChange={(event) => onUpdate({ followUpConsent: event.target.checked })} />
          The team can follow up about this booking blueprint and availability review.
        </label>
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/78">
          <input type="checkbox" checked={session.outreachConsent} onChange={(event) => onUpdate({ outreachConsent: event.target.checked })} />
          I am open to receiving related Performa booking and event updates.
        </label>
      </div>
    );
  }

  return null;
}

function MultiToggle({ options, values, onChange }: { options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const toggleValue = (value: string) => {
    if (values.includes(value)) onChange(values.filter((item) => item !== value));
    else onChange([...values, value]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((item) => (
        <button key={item} type="button" className={chipClass(values.includes(item))} onClick={() => toggleValue(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
