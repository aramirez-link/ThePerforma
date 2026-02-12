import { useEffect, useMemo, useState } from "react";
import {
  createTriviaCampaign,
  createTriviaQuestion,
  listTriviaCampaigns,
  listTriviaQuestions,
  runTriviaCampaignScheduler,
  updateTriviaCampaign,
  updateTriviaQuestion,
  type TriviaCampaign,
  type TriviaQuestion
} from "../lib/fanVault";
import { getCurrentUser, getSupabaseBrowser, isStoreAdmin, signOutStore } from "../lib/storefront";

const ADMIN_NAV_KEY = "the-performa-admin-nav";

const toLocalDateTimeValue = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function AdminTriviaConsole() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [campaigns, setCampaigns] = useState<TriviaCampaign[]>([]);

  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState(["", "", "", ""]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [questionCategory, setQuestionCategory] = useState("general");
  const [questionDifficulty, setQuestionDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionImageUrl, setQuestionImageUrl] = useState("");
  const [questionExplanation, setQuestionExplanation] = useState("");

  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignStartAt, setCampaignStartAt] = useState("");
  const [campaignEndAt, setCampaignEndAt] = useState("");
  const [campaignCadenceMinutes, setCampaignCadenceMinutes] = useState(60);
  const [campaignPostDurationMinutes, setCampaignPostDurationMinutes] = useState(10);
  const [campaignStatus, setCampaignStatus] = useState<"draft" | "active" | "paused" | "completed">("draft");
  const [campaignQuestionIds, setCampaignQuestionIds] = useState<string[]>([]);
  const [lookLabel, setLookLabel] = useState("Trivia Beacon");
  const [lookAccentColor, setLookAccentColor] = useState("#f9b233");
  const [lookTone, setLookTone] = useState<"ember" | "gold" | "cyan" | "neutral">("gold");

  const refresh = async () => {
    const [questionResult, campaignResult] = await Promise.all([listTriviaQuestions(), listTriviaCampaigns()]);
    if (!questionResult.ok) {
      setNotice(questionResult.error);
      return;
    }
    if (!campaignResult.ok) {
      setNotice(campaignResult.error);
      return;
    }
    setQuestions(questionResult.questions);
    setCampaigns(campaignResult.campaigns);
  };

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      const user = await getCurrentUser();
      setUserEmail(user?.email || "");
      const admin = await isStoreAdmin();
      setIsAdmin(admin);
      if (typeof window !== "undefined") {
        if (admin) localStorage.setItem(ADMIN_NAV_KEY, "true");
        else localStorage.removeItem(ADMIN_NAV_KEY);
      }
      if (admin) await refresh();
      setLoading(false);
    };
    void boot();

    const supabase = getSupabaseBrowser();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      void boot();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const availableQuestionCount = useMemo(() => questions.filter((question) => question.isActive).length, [questions]);

  const sendMagicLink = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/trivia` : undefined
      }
    });
    setBusy(false);
    setNotice(error ? error.message : "Check your email for the magic link.");
  };

  const createQuestion = async () => {
    setBusy(true);
    const result = await createTriviaQuestion({
      prompt: questionPrompt,
      options: questionOptions,
      correctOptionIndex,
      category: questionCategory,
      difficulty: questionDifficulty,
      imageUrl: questionImageUrl || null,
      explanation: questionExplanation || null
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setQuestionPrompt("");
    setQuestionOptions(["", "", "", ""]);
    setCorrectOptionIndex(0);
    setQuestionCategory("general");
    setQuestionDifficulty("medium");
    setQuestionImageUrl("");
    setQuestionExplanation("");
    setNotice("Trivia question added.");
    await refresh();
  };

  const createCampaign = async () => {
    setBusy(true);
    const result = await createTriviaCampaign({
      title: campaignTitle,
      questionIds: campaignQuestionIds,
      startAt: campaignStartAt,
      endAt: campaignEndAt || null,
      cadenceMinutes: campaignCadenceMinutes,
      postDurationMinutes: campaignPostDurationMinutes,
      status: campaignStatus,
      lookAndFeel: {
        label: lookLabel,
        accentColor: lookAccentColor,
        cardTone: lookTone
      }
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setCampaignTitle("");
    setCampaignStartAt("");
    setCampaignEndAt("");
    setCampaignCadenceMinutes(60);
    setCampaignPostDurationMinutes(10);
    setCampaignStatus("draft");
    setCampaignQuestionIds([]);
    setLookLabel("Trivia Beacon");
    setLookAccentColor("#f9b233");
    setLookTone("gold");
    setNotice("Trivia campaign created.");
    await refresh();
  };

  const runSchedulerNow = async () => {
    setBusy(true);
    const result = await runTriviaCampaignScheduler(20);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Scheduler published ${result.posted} trivia post${result.posted === 1 ? "" : "s"}.`);
    await refresh();
  };

  const toggleQuestionActive = async (question: TriviaQuestion) => {
    setBusy(true);
    const result = await updateTriviaQuestion({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      correctOptionIndex: question.correctOptionIndex,
      category: question.category,
      difficulty: question.difficulty,
      imageUrl: question.imageUrl,
      explanation: question.explanation,
      isActive: !question.isActive
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(!question.isActive ? "Question enabled." : "Question disabled.");
    await refresh();
  };

  const setCampaignStatusValue = async (campaignId: string, status: TriviaCampaign["status"]) => {
    setBusy(true);
    const result = await updateTriviaCampaign({ id: campaignId, status });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Campaign ${status}.`);
    await refresh();
  };

  const runCampaignNow = async (campaignId: string) => {
    setBusy(true);
    const result = await updateTriviaCampaign({
      id: campaignId,
      status: "active",
      nextRunAt: new Date().toISOString()
    });
    if (!result.ok) {
      setBusy(false);
      setNotice(result.error);
      return;
    }
    const runResult = await runTriviaCampaignScheduler(20);
    setBusy(false);
    if (!runResult.ok) {
      setNotice(runResult.error);
      return;
    }
    setNotice(`Campaign triggered. Published ${runResult.posted} post${runResult.posted === 1 ? "" : "s"}.`);
    await refresh();
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/70">Loading trivia console...</p>
        </div>
      </section>
    );
  }

  if (!userEmail) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Admin Trivia</p>
          <h1 className="mt-2 font-display text-3xl">Sign In</h1>
          <p className="mt-2 text-sm text-white/70">Use a magic link. Access is restricted to users in `store_admins`.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@theperforma.com"
              className="min-h-11 flex-1 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
            />
            <button type="button" onClick={sendMagicLink} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink">
              {busy ? "Sending..." : "Magic Link"}
            </button>
          </div>
          {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-sm text-white/75">Signed in as {userEmail}, but this account is not in `store_admins`.</p>
          <button
            type="button"
            onClick={async () => {
              localStorage.removeItem(ADMIN_NAV_KEY);
              await signOutStore();
              window.location.reload();
            }}
            className="mt-4 min-h-11 rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white/80"
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-20 pt-8 sm:px-6">
      <div className="rounded-3xl border border-white/15 bg-black/45 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Admin Trivia</p>
            <h1 className="mt-2 font-display text-3xl">Trivia Campaign Control</h1>
            <p className="mt-1 text-sm text-white/70">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={runSchedulerNow}
            disabled={busy}
            className="min-h-11 rounded-full border border-gold/45 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-gold disabled:opacity-50"
          >
            {busy ? "Working..." : "Run Scheduler Now"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/55">Shared question bank: {availableQuestionCount} active question(s).</p>
        {notice && <p className="mt-3 text-sm text-gold">{notice}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-gold/80">Question Bank</p>
          <h2 className="mt-2 font-display text-2xl">Create Trivia Question</h2>
          <div className="mt-4 grid gap-3">
            <textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} rows={3} placeholder="Trivia prompt" className="rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-sm" />
            {questionOptions.map((option, index) => (
              <input
                key={`q-opt-${index}`}
                value={option}
                onChange={(event) =>
                  setQuestionOptions((current) => current.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))
                }
                placeholder={`Option ${index + 1}`}
                className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
              />
            ))}
            <div className="grid gap-2 sm:grid-cols-3">
              <select value={String(correctOptionIndex)} onChange={(event) => setCorrectOptionIndex(Number(event.target.value))} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                {questionOptions.map((_, index) => (
                  <option key={`correct-${index}`} value={index}>Correct: Option {index + 1}</option>
                ))}
              </select>
              <input value={questionCategory} onChange={(event) => setQuestionCategory(event.target.value)} placeholder="Category" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <select value={questionDifficulty} onChange={(event) => setQuestionDifficulty(event.target.value as any)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <input value={questionImageUrl} onChange={(event) => setQuestionImageUrl(event.target.value)} placeholder="Optional image URL" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <textarea value={questionExplanation} onChange={(event) => setQuestionExplanation(event.target.value)} rows={2} placeholder="Optional explanation" className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <button type="button" onClick={createQuestion} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink disabled:opacity-50">
              Add Question
            </button>
          </div>
        </article>

        <article className="rounded-3xl border border-white/15 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-gold/80">Campaign Builder</p>
          <h2 className="mt-2 font-display text-2xl">Schedule Trivia Campaign</h2>
          <div className="mt-4 grid gap-3">
            <input value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} placeholder="Campaign title" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-white/65">
                Start
                <input type="datetime-local" value={campaignStartAt} onChange={(event) => setCampaignStartAt(event.target.value)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs text-white/65">
                End (optional)
                <input type="datetime-local" value={campaignEndAt} onChange={(event) => setCampaignEndAt(event.target.value)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-white/65">
                Cadence (min)
                <input type="number" min={1} max={1440} value={campaignCadenceMinutes} onChange={(event) => setCampaignCadenceMinutes(Number(event.target.value) || 60)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs text-white/65">
                Post timer (min)
                <input type="number" min={1} max={60} value={campaignPostDurationMinutes} onChange={(event) => setCampaignPostDurationMinutes(Number(event.target.value) || 10)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs text-white/65">
                Status
                <select value={campaignStatus} onChange={(event) => setCampaignStatus(event.target.value as any)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Question selection</p>
              <div className="mt-2 max-h-36 space-y-2 overflow-auto">
                {questions.map((question) => (
                  <label key={question.id} className="flex items-start gap-2 text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={campaignQuestionIds.includes(question.id)}
                      onChange={(event) =>
                        setCampaignQuestionIds((current) =>
                          event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id)
                        )
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>{question.prompt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={lookLabel} onChange={(event) => setLookLabel(event.target.value)} placeholder="Label" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <input value={lookAccentColor} onChange={(event) => setLookAccentColor(event.target.value)} placeholder="#f9b233" className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm" />
              <select value={lookTone} onChange={(event) => setLookTone(event.target.value as any)} className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm">
                <option value="gold">Gold</option>
                <option value="ember">Ember</option>
                <option value="cyan">Cyan</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <button type="button" onClick={createCampaign} disabled={busy} className="min-h-11 rounded-full bg-ember px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-ink disabled:opacity-50">
              Create Campaign
            </button>
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-white/15 bg-black/45 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-gold/80">Question Bank</p>
        <div className="mt-3 grid gap-2">
          {questions.map((question) => (
            <div key={question.id} className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/90">{question.prompt}</p>
                <button type="button" onClick={() => toggleQuestionActive(question)} className="min-h-10 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                  {question.isActive ? "Disable" : "Enable"}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/55">{question.category} · {question.difficulty} · {question.options.length} options</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-white/15 bg-black/45 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-gold/80">Campaigns</p>
        <div className="mt-3 grid gap-2">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/90">{campaign.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => runCampaignNow(campaign.id)} className="min-h-10 rounded-full border border-gold/35 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                    Run Now
                  </button>
                  {campaign.status !== "active" && (
                    <button type="button" onClick={() => setCampaignStatusValue(campaign.id, "active")} className="min-h-10 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">Activate</button>
                  )}
                  {campaign.status === "active" && (
                    <button type="button" onClick={() => setCampaignStatusValue(campaign.id, "paused")} className="min-h-10 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">Pause</button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-white/55">
                Status: {campaign.status} · Questions: {campaign.questionIds.length} · Every {campaign.cadenceMinutes}m · Duration {campaign.postDurationMinutes}m
              </p>
              <p className="mt-1 text-xs text-white/50">
                Next run: {toLocalDateTimeValue(campaign.nextRunAt).replace("T", " ")} · Last run: {campaign.lastRunAt ? toLocalDateTimeValue(campaign.lastRunAt).replace("T", " ") : "n/a"}
              </p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
