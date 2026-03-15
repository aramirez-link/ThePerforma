import { useEffect, useMemo, useRef, useState } from "react";
import type { BookingSession, EstimateBreakdown, PackageRecommendation } from "./bookingEngine";
import { formatCurrency } from "./bookingEngine";
import { askBookingClaude, type BookingClaudeMessage } from "../../lib/bookingClaude";

type ClaudeUiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  session: BookingSession;
  aiSummary: string;
  recommendation: PackageRecommendation;
  estimate: EstimateBreakdown;
};

const STORAGE_KEY = "the-performa-booking-claude-drawer-v1";

const quickPrompts = [
  "What kind of event is The Performa best for?",
  "Is my current event profile closer to a premium nightlife booking or a full production play?",
  "What would make this brief stronger before human review?",
  "How should I explain The Performa to a buyer or brand partner?"
];

const welcomeMessage: ClaudeUiMessage = {
  id: "welcome",
  role: "assistant",
  text:
    "Ask me anything about The Performa, package fit, or your current booking brief. I can clarify the experience, explain the estimate logic, and help you decide the best next step. Final booking approval still requires human review."
};

export default function BookingClaudeDrawer({
  open,
  onClose,
  session,
  aiSummary,
  recommendation,
  estimate
}: Props) {
  const [messages, setMessages] = useState<ClaudeUiMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ClaudeUiMessage[];
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed);
      }
    } catch {
      setMessages([welcomeMessage]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-18)));
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, messages, isLoading]);

  const contextLabel = useMemo(() => {
    if (session.eventType) return recommendation.label;
    return "No event profile yet";
  }, [recommendation.label, session.eventType]);

  const sendMessage = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    const userMessage: ClaudeUiMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text
    };

    const nextMessages = [...messages, userMessage].slice(-18);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    const response = await askBookingClaude({
      messages: nextMessages.map<BookingClaudeMessage>((message) => ({
        role: message.role,
        content: message.text
      })),
      session,
      aiSummary,
      recommendation,
      estimate
    });

    if (!response.ok) {
      setError(response.error);
      setIsLoading(false);
      return;
    }

    setMessages((current) => {
      const next: ClaudeUiMessage[] = [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response.text
        }
      ];
      return next.slice(-18);
    });
    setIsLoading(false);
  };

  const clearConversation = () => {
    setMessages([welcomeMessage]);
    setError("");
    setInput("");
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/72 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-claude-title"
      onClick={onClose}
    >
      <div className="flex h-full justify-end">
        <aside
          className="flex h-full w-full max-w-[29rem] flex-col border-l border-white/12 bg-[#09090e] shadow-[-24px_0_80px_rgba(0,0,0,0.45)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold/80">Claude AI Chat</p>
                <h2 id="booking-claude-title" className="mt-2 font-display text-2xl text-white">
                  Ask about The Performa or your booking
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/66">
                  This assistant can explain package fit, clarify the experience, and answer booking questions.
                  It cannot confirm bookings or final pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/72 transition hover:border-white/30 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">Current package fit</p>
                <p className="mt-2 text-sm text-white/88">{contextLabel}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">Preliminary range</p>
                <p className="mt-2 text-sm text-white/88">
                  {formatCurrency(estimate.totalLow)} - {formatCurrency(estimate.totalHigh)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-[11px] text-white/72 transition hover:border-gold/40 hover:text-gold"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[88%] rounded-[1.5rem] px-4 py-4 shadow-[0_12px_34px_rgba(0,0,0,0.18)] ${
                      message.role === "assistant"
                        ? "border border-white/10 bg-black/35 text-white/84"
                        : "bg-[linear-gradient(135deg,rgba(242,84,45,0.94),rgba(255,123,48,0.96))] text-ink"
                    }`}
                  >
                    <p
                      className={`text-[10px] uppercase tracking-[0.22em] ${
                        message.role === "assistant" ? "text-gold/78" : "text-ink/70"
                      }`}
                    >
                      {message.role === "assistant" ? "Claude" : "You"}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{message.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[78%] rounded-[1.5rem] border border-white/10 bg-black/35 px-4 py-4 text-white/76">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gold/78">Claude</p>
                    <p className="mt-2 text-sm">Thinking through your brief...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            {error && <p className="mb-3 text-sm text-gold">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearConversation}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/62 transition hover:border-white/28 hover:text-white"
              >
                Clear chat
              </button>
              <p className="text-[11px] text-white/42">Human review is always required before confirmation.</p>
            </div>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
            >
              <label className="sr-only" htmlFor="booking-claude-input">
                Ask Claude about The Performa or your booking
              </label>
              <div className="flex items-end gap-3">
                <textarea
                  id="booking-claude-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={3}
                  placeholder="Ask about package fit, event scope, or anything about The Performa..."
                  className="min-h-[6.25rem] flex-1 rounded-[1.4rem] border border-white/15 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/35"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="rounded-full bg-ember px-5 py-3 text-xs uppercase tracking-[0.26em] text-ink disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
