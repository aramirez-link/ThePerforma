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
    "I’m your Performa Booking Concierge. I’ll interview the event brief, shape the experience live, build the booking blueprint on the right, and then recommend the strongest next move for human review.",
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
  contact: "Where should I send this, and how should the team follow up if there’s a fit?"
};

const introCards = [
  {
    title: "What this does",
    copy: "Builds a preliminary event blueprint, package recommendation, and investment range in real time."
  },
  {
    title: "How it works",
    copy: "You answer one prompt at a time. I keep the conversation tight and the right panel updates as the brief gets sharper."
  },
  {
    title: "Important",
    copy: "Nothing here confirms a booking. Final availability, approval, pricing, and contract all require human review."
  }
];

const chipClass = (active: boolean) =>
  `rounded-full border px-4 py-3 text-sm transition ${
    active ? "border-gold/55 bg-gold/10 text-gold" : "border-white/12 bg-white/[0.03] text-white/82 hover:border-white/28"
  }`;

const bubbleClass = "max-w-[88%] rounded-[1.6rem] px-4 py-4 shadow-[0_10px_34px_rgba(0,0,0,0.18)]";

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
      return [
        session.contactName,
        session.contactEmail,
        session.organization,
        session.contactPreference
      ]
        .filter(Boolean)
        .join(" | ");
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
  progress,
  readinessLabel,
  aiSummary
}: Props) {
  const answeredSteps = stepOrder.filter((step) => !["welcome"].includes(step) && stepAnswered(session, step));
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const isWelcome = currentStep === "welcome";

  return (
    <section className="rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:p-5 lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-7rem)] lg:flex-col lg:overflow-hidden">
      <div className="rounded-[1.6rem] border border-white/12 bg-black/35 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-[radial-gradient(circle,rgba(243,211,139,0.22),rgba(7,7,11,0.2))] text-sm uppercase tracking-[0.28em] text-gold">
            AI
          </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">Performa Booking Concierge</p>
              <p className="mt-1 text-sm text-white/72">Producer-grade pre-sales guidance</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/12 bg-black/30 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/28 hover:text-white"
          >
            Reset
          </button>
          <div className="rounded-full border border-white/12 bg-black/30 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/55">
            {readinessLabel}
          </div>
        </div>
      </div>

        <div className="mt-4 rounded-full border border-white/10 bg-black/25 px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-white/52">
            <span>Conversation Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.8rem] border border-white/12 bg-black/28 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="space-y-4">
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

              <div className="flex justify-end">
                <button type="button" onClick={onContinue} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.26em] text-ink">
                  Start Designing
                </button>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/22 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">What happens next</p>
                <p className="mt-2 text-sm leading-relaxed text-white/66">
                  I’ll ask one focused question at a time. As you answer, the blueprint on the right will build the event profile, package fit, investment range, and recommended next step.
                </p>
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
                    className={`${bubbleClass} bg-[linear-gradient(135deg,rgba(242,84,45,0.9),rgba(255,123,48,0.92))] text-left text-ink hover:opacity-95`}
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
              <AssistantBubble title={`Current Prompt • ${sectionTitle[currentStep]}`}>
                {questionCopy[currentStep]}
              </AssistantBubble>

              <div className="rounded-[1.6rem] border border-gold/20 bg-[linear-gradient(180deg,rgba(242,84,45,0.08),rgba(255,255,255,0.02))] p-4">
                {renderComposer({ currentStep, session, onUpdate, onContinue })}

                {["location", "targetDate", "attendeeCount", "audienceDescription", "liveElements", "productionNeeds", "contact"].includes(currentStep) && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button type="button" onClick={onBack} className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/76">
                      Back
                    </button>
                    <button type="button" onClick={onContinue} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink">
                      Continue
                    </button>
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

function AssistantBubble({ title, children }: { title: string; children: React.ReactNode }) {
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
          <button key={item.value} type="button" className={chipClass(session.eventType === item.value)} onClick={() => { onUpdate({ eventType: item.value }); onContinue(); }}>
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
          <button key={item.value} type="button" className={chipClass(session.venueType === item.value)} onClick={() => { onUpdate({ venueType: item.value }); onContinue(); }}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "location") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <input value={session.locationCity} onChange={(e) => onUpdate({ locationCity: e.target.value })} placeholder="City" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.locationState} onChange={(e) => onUpdate({ locationState: e.target.value })} placeholder="State / Province" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.locationCountry} onChange={(e) => onUpdate({ locationCountry: e.target.value })} placeholder="Country" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
      </div>
    );
  }

  if (currentStep === "targetDate") {
    return <input type="date" value={session.targetDate} onChange={(e) => onUpdate({ targetDate: e.target.value })} className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white" />;
  }

  if (currentStep === "attendeeCount") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[250, 500, 1000, 2500, 5000].map((count) => (
            <button key={count} type="button" className={chipClass(session.attendeeCount === count)} onClick={() => onUpdate({ attendeeCount: count })}>
              {count.toLocaleString()}
            </button>
          ))}
        </div>
        <input type="number" min={50} value={session.attendeeCount || ""} onChange={(e) => onUpdate({ attendeeCount: Math.max(50, Number(e.target.value || 0)) })} placeholder="Or enter expected attendance" className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
      </div>
    );
  }

  if (currentStep === "ticketingModel") {
    return (
      <div className="flex flex-wrap gap-2">
        {TICKETING_OPTIONS.map((item) => (
          <button key={item.value} type="button" className={chipClass(session.ticketingModel === item.value)} onClick={() => { onUpdate({ ticketingModel: item.value as TicketingModel }); onContinue(); }}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "audienceDescription") {
    return <textarea value={session.audienceDescription} onChange={(e) => onUpdate({ audienceDescription: e.target.value })} rows={4} placeholder="Describe the audience, room energy, and what success should feel like." className="w-full rounded-[1.4rem] border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />;
  }

  if (currentStep === "vibeProfile") {
    return (
      <div className="flex flex-wrap gap-2">
        {VIBE_OPTIONS.map((item) => (
          <button key={item} type="button" className={chipClass(session.vibeProfile === item)} onClick={() => { onUpdate({ vibeProfile: item }); onContinue(); }}>
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
          <button key={item.value} type="button" className={chipClass(session.productionAmbition === item.value)} onClick={() => { onUpdate({ productionAmbition: item.value as ProductionAmbition }); onContinue(); }}>
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
            <select value={session.wantsBrandIntegration === null ? "" : session.wantsBrandIntegration ? "yes" : "no"} onChange={(e) => onUpdate({ wantsBrandIntegration: e.target.value ? e.target.value === "yes" : null })} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-white">
              <option value="">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/74">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-white/50">Host / MC moments</span>
            <select value={session.wantsHostMoments === null ? "" : session.wantsHostMoments ? "yes" : "no"} onChange={(e) => onUpdate({ wantsHostMoments: e.target.value ? e.target.value === "yes" : null })} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-white">
              <option value="">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <textarea value={session.languageConsiderations} onChange={(e) => onUpdate({ languageConsiderations: e.target.value })} rows={3} placeholder="Language, cultural, or audience-diversity considerations" className="w-full rounded-[1.2rem] border border-white/12 bg-black/25 px-4 py-3 text-white placeholder:text-white/35" />
      </div>
    );
  }

  if (currentStep === "budgetSignal") {
    return (
      <div className="flex flex-wrap gap-2">
        {BUDGET_OPTIONS.map((item) => (
          <button key={item.value} type="button" className={chipClass(session.budgetSignal === item.value)} onClick={() => { onUpdate({ budgetSignal: item.value as BudgetSignal }); onContinue(); }}>
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
          <button key={item.value} type="button" className={chipClass(session.nextStepIntent === item.value)} onClick={() => { onUpdate({ nextStepIntent: item.value as NextStepIntent }); onContinue(); }}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (currentStep === "contact") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <input value={session.contactName} onChange={(e) => onUpdate({ contactName: e.target.value })} placeholder="Full name" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.contactEmail} onChange={(e) => onUpdate({ contactEmail: e.target.value })} placeholder="Email" type="email" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.contactPhone} onChange={(e) => onUpdate({ contactPhone: e.target.value })} placeholder="Phone" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.organization} onChange={(e) => onUpdate({ organization: e.target.value })} placeholder="Company / Organization" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <input value={session.role} onChange={(e) => onUpdate({ role: e.target.value })} placeholder="Role" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
        <select value={session.contactPreference} onChange={(e) => onUpdate({ contactPreference: e.target.value as ContactPreference })} className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white">
          <option value="">Preferred follow-up</option>
          {CONTACT_PREFERENCE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/78">
          <input type="checkbox" checked={session.followUpConsent} onChange={(e) => onUpdate({ followUpConsent: e.target.checked })} />
          The team can follow up about this booking blueprint and availability review.
        </label>
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/78">
          <input type="checkbox" checked={session.outreachConsent} onChange={(e) => onUpdate({ outreachConsent: e.target.checked })} />
          I’m open to receiving related Performa booking and event updates.
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
