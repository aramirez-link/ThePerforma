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
  welcome: "AI Booking Concierge",
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
  productionNeeds: "Production Needs",
  budgetSignal: "Budget Signal",
  nextStepIntent: "Next Step",
  contact: "Contact + Consent"
} as const;

const questionCopy: Record<StepKey, string> = {
  welcome: "I’ll help design the right Performa experience, model the scope, estimate the range, and recommend the next move. Final booking always goes through human review.",
  eventType: "What kind of event are you designing?",
  venueType: "What kind of room or venue are we working with?",
  location: "Where is this event happening?",
  targetDate: "What date are you targeting?",
  attendeeCount: "How many guests are you expecting?",
  ticketingModel: "Is this ticketed, invite-only, or something in between?",
  audienceDescription: "Who is the audience, and what atmosphere do you want them to feel?",
  vibeProfile: "What vibe should the room carry?",
  productionAmbition: "How ambitious should the production feel?",
  liveElements: "Which live elements should be part of the experience?",
  productionNeeds: "What support layers should the blueprint account for?",
  budgetSignal: "What budget range feels realistic right now?",
  nextStepIntent: "Which path sounds most useful once the blueprint is ready?",
  contact: "Where should I send this, and how should the team follow up if there’s a fit?"
};

const pillClass = (active: boolean) =>
  `rounded-full border px-4 py-3 text-left text-[11px] uppercase tracking-[0.24em] transition ${
    active ? "border-gold/55 bg-gold/10 text-gold" : "border-white/15 bg-black/30 text-white/78 hover:border-white/35"
  }`;

const renderUserAnswer = (session: BookingSession, step: StepKey) => {
  switch (step) {
    case "eventType":
      return EVENT_TYPE_OPTIONS.find((item) => item.value === session.eventType)?.label || "";
    case "venueType":
      return VENUE_TYPE_OPTIONS.find((item) => item.value === session.venueType)?.label || "";
    case "location":
      return [session.locationCity, session.locationState, session.locationCountry].filter(Boolean).join(", ");
    case "targetDate":
      return session.targetDate;
    case "attendeeCount":
      return session.attendeeCount ? `${session.attendeeCount.toLocaleString()} expected` : "";
    case "ticketingModel":
      return TICKETING_OPTIONS.find((item) => item.value === session.ticketingModel)?.label || "";
    case "audienceDescription":
      return session.audienceDescription;
    case "vibeProfile":
      return session.vibeProfile;
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
      return [session.contactName, session.contactEmail, session.organization].filter(Boolean).join(" / ");
    default:
      return "";
  }
};

const isAnswered = (session: BookingSession, step: StepKey) => Boolean(renderUserAnswer(session, step));

export default function BookingChatPanel({
  session,
  currentStep,
  onStepChange,
  onUpdate,
  onBack,
  onContinue,
  progress,
  readinessLabel,
  aiSummary
}: Props) {
  const answeredSteps = stepOrder.filter((step) => !["welcome", "contact"].includes(step) && isAnswered(session, step)).slice(-3);

  return (
    <section className="rounded-[2rem] border border-white/15 bg-black/45 p-5 md:p-6 lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-7rem)] lg:flex-col lg:overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold/85">Performa Booking Concierge</p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl">Design your Performa experience.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            This concierge builds a preliminary booking blueprint, package fit, and estimate for human review. It will not confirm a booking automatically.
          </p>
        </div>
        <div className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/60">
          {readinessLabel}
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-white/58">
          <span>Interview Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        <article className="rounded-[1.5rem] border border-white/12 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/85">{sectionTitle[currentStep]}</p>
          <p className="mt-3 text-base leading-relaxed text-white/86">{questionCopy[currentStep]}</p>
        </article>

        {answeredSteps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">Recent answers</p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">Blueprint updates live</p>
            </div>
            {answeredSteps.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onStepChange(step)}
                  className="w-full rounded-[1.4rem] border border-white/12 bg-black/25 p-4 text-left transition hover:border-white/25"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">{sectionTitle[step]}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">{renderUserAnswer(session, step)}</p>
                </button>
            ))}
          </div>
        )}

        <div className="rounded-[1.5rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
          {currentStep === "welcome" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-white/74">
                I’ll interview you in a producer-friendly sequence, then I’ll recommend the strongest package fit, a preliminary investment range, and the smartest next step.
              </p>
              <button type="button" onClick={onContinue} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.28em] text-ink">
                Design My Event
              </button>
            </div>
          )}

          {currentStep === "eventType" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {EVENT_TYPE_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.eventType === item.value)} onClick={() => { onUpdate({ eventType: item.value }); onContinue(); }}>
                  <span className="block">{item.label}</span>
                  <span className="mt-2 block text-[11px] normal-case tracking-normal text-white/55">{item.caption}</span>
                </button>
              ))}
            </div>
          )}

          {currentStep === "venueType" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {VENUE_TYPE_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.venueType === item.value)} onClick={() => { onUpdate({ venueType: item.value }); onContinue(); }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {currentStep === "location" && (
            <div className="grid gap-3 md:grid-cols-3">
              <input value={session.locationCity} onChange={(e) => onUpdate({ locationCity: e.target.value })} placeholder="City" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
              <input value={session.locationState} onChange={(e) => onUpdate({ locationState: e.target.value })} placeholder="State / Province" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
              <input value={session.locationCountry} onChange={(e) => onUpdate({ locationCountry: e.target.value })} placeholder="Country" className="min-h-12 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
            </div>
          )}

          {currentStep === "targetDate" && (
            <input type="date" value={session.targetDate} onChange={(e) => onUpdate({ targetDate: e.target.value })} className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white" />
          )}

          {currentStep === "attendeeCount" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[250, 500, 1000, 2500, 5000].map((count) => (
                  <button key={count} type="button" className={pillClass(session.attendeeCount === count)} onClick={() => onUpdate({ attendeeCount: count })}>
                    {count.toLocaleString()}
                  </button>
                ))}
              </div>
              <input type="number" min={50} value={session.attendeeCount || ""} onChange={(e) => onUpdate({ attendeeCount: Math.max(50, Number(e.target.value || 0)) })} placeholder="Or enter expected attendance" className="min-h-12 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
            </div>
          )}

          {currentStep === "ticketingModel" && (
            <div className="flex flex-wrap gap-2">
              {TICKETING_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.ticketingModel === item.value)} onClick={() => { onUpdate({ ticketingModel: item.value as TicketingModel }); onContinue(); }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {currentStep === "audienceDescription" && (
            <textarea value={session.audienceDescription} onChange={(e) => onUpdate({ audienceDescription: e.target.value })} rows={4} placeholder="Describe the audience, room energy, and what success should feel like." className="w-full rounded-[1.5rem] border border-white/15 bg-black/35 px-4 py-3 text-white placeholder:text-white/35" />
          )}

          {currentStep === "vibeProfile" && (
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((item) => (
                <button key={item} type="button" className={pillClass(session.vibeProfile === item)} onClick={() => { onUpdate({ vibeProfile: item }); onContinue(); }}>
                  {item}
                </button>
              ))}
            </div>
          )}

          {currentStep === "productionAmbition" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {AMBITION_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.productionAmbition === item.value)} onClick={() => { onUpdate({ productionAmbition: item.value as ProductionAmbition }); onContinue(); }}>
                  <span className="block">{item.label}</span>
                  <span className="mt-2 block text-[11px] normal-case tracking-normal text-white/55">{item.caption}</span>
                </button>
              ))}
            </div>
          )}

          {currentStep === "liveElements" && (
            <MultiToggle options={LIVE_ELEMENT_OPTIONS} values={session.liveElements} onChange={(values) => onUpdate({ liveElements: values })} />
          )}

          {currentStep === "productionNeeds" && (
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
          )}

          {currentStep === "budgetSignal" && (
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.budgetSignal === item.value)} onClick={() => { onUpdate({ budgetSignal: item.value as BudgetSignal }); onContinue(); }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {currentStep === "nextStepIntent" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {NEXT_STEP_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={pillClass(session.nextStepIntent === item.value)} onClick={() => { onUpdate({ nextStepIntent: item.value as NextStepIntent }); onContinue(); }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {currentStep === "contact" && (
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
          )}

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

        <article className="rounded-[1.5rem] border border-white/12 bg-black/25 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/85">Concierge Readback</p>
          <p className="mt-3 text-sm leading-relaxed text-white/74">{aiSummary}</p>
        </article>
      </div>
    </section>
  );
}

function MultiToggle({ options, values, onChange }: { options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const toggleValue = (value: string) => {
    if (values.includes(value)) onChange(values.filter((item) => item !== value));
    else onChange([...values, value]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((item) => (
        <button key={item} type="button" className={pillClass(values.includes(item))} onClick={() => toggleValue(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
