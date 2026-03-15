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
};

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

const sectionTitle: Record<StepKey, string> = {
  eventType: "Event type",
  venueType: "Venue",
  location: "Location",
  targetDate: "Date",
  attendeeCount: "Guests",
  ticketingModel: "Ticketing",
  audienceDescription: "Audience",
  vibeProfile: "Vibe",
  productionAmbition: "Scale",
  liveElements: "Live elements",
  productionNeeds: "Production",
  budgetSignal: "Budget",
  nextStepIntent: "Best next step",
  contact: "Contact"
};

const questionCopy: Record<StepKey, string> = {
  eventType: "What kind of event are you planning?",
  venueType: "What kind of room is it?",
  location: "Where will this happen?",
  targetDate: "When are you aiming to host it?",
  attendeeCount: "How many guests are you expecting?",
  ticketingModel: "How is the event being handled?",
  audienceDescription: "What should the room feel like?",
  vibeProfile: "Which vibe fits best?",
  productionAmbition: "How big should this feel?",
  liveElements: "What live elements matter most?",
  productionNeeds: "What extra support should I plan for?",
  budgetSignal: "What budget range feels realistic?",
  nextStepIntent: "What would help most after the brief is built?",
  contact: "Where should I send the brief?"
};

const helperCopy: Partial<Record<StepKey, string>> = {
  audienceDescription: "One or two lines is enough.",
  liveElements: "Pick any that matter. Skip the rest for now.",
  productionNeeds: "Choose only what you know you need.",
  budgetSignal: "Rough is fine. This stays preliminary.",
  contact: "Add the basics so the team can review and follow up."
};

const manualContinueSteps: StepKey[] = [
  "location",
  "targetDate",
  "attendeeCount",
  "audienceDescription",
  "liveElements",
  "productionNeeds",
  "contact"
];

const summarySteps: StepKey[] = [
  "eventType",
  "venueType",
  "location",
  "targetDate",
  "attendeeCount",
  "productionAmbition",
  "budgetSignal"
];

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
      return session.attendeeCount ? `${session.attendeeCount.toLocaleString()} guests` : "";
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
      return session.productionNeeds.join(", ");
    case "budgetSignal":
      return BUDGET_OPTIONS.find((item) => item.value === session.budgetSignal)?.label || "";
    case "nextStepIntent":
      return NEXT_STEP_OPTIONS.find((item) => item.value === session.nextStepIntent)?.label || "";
    case "contact":
      return [session.contactName, session.contactEmail].filter(Boolean).join(" / ");
    default:
      return "";
  }
};

const stepAnswered = (session: BookingSession, step: StepKey) => Boolean(renderAnswer(session, step));

const getSummaryItems = (session: BookingSession) =>
  summarySteps
    .map((step) => ({
      step,
      label: sectionTitle[step],
      value: renderAnswer(session, step)
    }))
    .filter((item) => item.value);

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
  progress
}: Props) {
  const promptIndex = STEP_ORDER.indexOf(currentStep) + 1;
  const previousStep = STEP_ORDER[Math.max(0, STEP_ORDER.indexOf(currentStep) - 1)];
  const lastAnswer = STEP_ORDER.indexOf(currentStep) > 0 ? renderAnswer(session, previousStep) : "";
  const summaryItems = getSummaryItems(session);
  const canSkip = currentStep !== "eventType" && currentStep !== "contact";
  const needsManualContinue = manualContinueSteps.includes(currentStep);

  return (
    <section className="rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[1.6rem] border border-white/12 bg-black/35 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">AI Booking Brief</p>
              <h2 className="mt-2 font-display text-3xl text-white">Tell me what you&apos;re planning.</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/66">
                About 3 minutes. I&apos;ll shape the event, estimate the range, and prep it for review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenClaude}
                className="rounded-full border border-gold/30 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-gold"
              >
                Ask Claude
              </button>
              <button
                type="button"
                onClick={onOpenBlueprint}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/74"
              >
                View Brief
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/58"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/58">
              Prompt {promptIndex} / {STEP_ORDER.length}
            </span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/58">
              {progress}% complete
            </span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/58">
              Human review before confirmation
            </span>
          </div>
        </div>

        {summaryItems.length > 0 && (
          <div className="mt-4 rounded-[1.5rem] border border-white/12 bg-black/28 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Brief so far</p>
              <button
                type="button"
                onClick={onOpenBlueprint}
                className="text-[10px] uppercase tracking-[0.22em] text-white/56 transition hover:text-white"
              >
                Open full brief
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {summaryItems.map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => onStepChange(item.step)}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-[11px] text-white/72 transition hover:border-white/26"
                >
                  <span className="text-white/45">{item.label}: </span>
                  {item.value}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {lastAnswer && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onStepChange(previousStep)}
                className="max-w-[80%] rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(242,84,45,0.94),rgba(255,123,48,0.96))] px-4 py-4 text-left text-ink shadow-[0_12px_34px_rgba(0,0,0,0.18)] transition hover:opacity-95"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-ink/70">You said</p>
                <p className="mt-2 text-sm leading-relaxed">{lastAnswer}</p>
              </button>
            </div>
          )}

          <div className="max-w-[84%] rounded-[1.6rem] border border-white/12 bg-black/34 px-4 py-4 text-white/86 shadow-[0_10px_34px_rgba(0,0,0,0.18)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{sectionTitle[currentStep]}</p>
            <p className="mt-2 text-sm leading-relaxed">{questionCopy[currentStep]}</p>
          </div>

          <div className="rounded-[1.6rem] border border-gold/18 bg-[linear-gradient(180deg,rgba(242,84,45,0.08),rgba(255,255,255,0.02))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Respond</p>
                <p className="mt-2 text-sm text-white/60">{helperCopy[currentStep] || "Choose the closest fit. You can edit anything later."}</p>
              </div>
              <button
                type="button"
                onClick={onOpenClaude}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/72"
              >
                Need Help?
              </button>
            </div>

            <div className="mt-4">{renderComposer({ currentStep, session, onUpdate, onContinue })}</div>

            {needsManualContinue && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/76"
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  {canSkip && (
                    <button
                      type="button"
                      onClick={onContinue}
                      className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/70"
                    >
                      Skip for now
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onContinue}
                    className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink"
                  >
                    {currentStep === "contact" ? "Finish Brief" : "Continue"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
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
          placeholder="State"
          aria-label="State"
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
          placeholder="Or type guest count"
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
        placeholder="Example: editorial rooftop crowd, luxury feel, high energy without losing polish."
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
          The team can follow up about this event brief and availability review.
        </label>
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/78">
          <input type="checkbox" checked={session.outreachConsent} onChange={(event) => onUpdate({ outreachConsent: event.target.checked })} />
          I am open to related booking and event updates.
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
