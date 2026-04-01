import { useEffect, useMemo, useState } from "react";
import {
  deleteWatchFeaturedReel,
  loadActiveWatchFeaturedReel,
  loadAdminWatchFeaturedReels,
  normalizeWatchFeaturedReelInput,
  upsertWatchFeaturedReel,
  type WatchFeaturedReel
} from "../lib/watchFeaturedReels";

const blankForm = {
  id: "",
  title: "",
  link: "",
  thumbnailUrl: "",
  goLiveAt: "",
  retireAt: "",
  isActive: true,
  notes: ""
};

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return "";
  }
};

const formatSchedule = (value?: string | null) => {
  if (!value) return "Not scheduled";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getScheduleState = (reel: WatchFeaturedReel) => {
  const now = Date.now();
  const goLiveAt = Date.parse(reel.goLiveAt);
  const retireAt = reel.retireAt ? Date.parse(reel.retireAt) : Number.POSITIVE_INFINITY;

  if (!reel.isActive) return "inactive";
  if (Number.isFinite(retireAt) && retireAt <= now) return "ended";
  if (Number.isFinite(goLiveAt) && goLiveAt > now) return "scheduled";
  return "live";
};

export default function FeaturedReelSchedulerPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(blankForm);
  const [queue, setQueue] = useState<WatchFeaturedReel[]>([]);
  const [currentReel, setCurrentReel] = useState<WatchFeaturedReel | null>(null);

  const refresh = async () => {
    const [queueResult, activeResult] = await Promise.all([
      loadAdminWatchFeaturedReels(),
      loadActiveWatchFeaturedReel()
    ]);

    if (!queueResult.ok) {
      setNotice(queueResult.error);
    } else {
      setQueue(queueResult.data);
    }

    if (!activeResult.ok) {
      setNotice(activeResult.error);
    } else {
      setCurrentReel(activeResult.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const normalizedPreview = useMemo(
    () =>
      normalizeWatchFeaturedReelInput({
        link: form.link,
        thumbnailUrl: form.thumbnailUrl || null
      }),
    [form.link, form.thumbnailUrl]
  );

  const clearForm = () => {
    setForm({
      ...blankForm,
      goLiveAt: toLocalDateTimeInput(new Date().toISOString())
    });
  };

  useEffect(() => {
    if (form.goLiveAt) return;
    clearForm();
  }, [form.goLiveAt]);

  const saveReel = async () => {
    setSaving(true);
    const result = await upsertWatchFeaturedReel({
      id: form.id || undefined,
      title: form.title,
      link: form.link,
      thumbnailUrl: form.thumbnailUrl || null,
      goLiveAt: form.goLiveAt,
      retireAt: form.retireAt || null,
      isActive: form.isActive,
      notes: form.notes
    });
    setSaving(false);

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setNotice(form.id ? "Featured reel updated." : "Featured reel scheduled.");
    clearForm();
    await refresh();
  };

  const editReel = (reel: WatchFeaturedReel) => {
    setForm({
      id: reel.id,
      title: reel.title,
      link: reel.sourceUrl || reel.embedUrl,
      thumbnailUrl: reel.thumbnailUrl || "",
      goLiveAt: toLocalDateTimeInput(reel.goLiveAt),
      retireAt: toLocalDateTimeInput(reel.retireAt),
      isActive: reel.isActive,
      notes: reel.notes || ""
    });
    setNotice(`Editing featured reel: ${reel.title}`);
  };

  const removeReel = async (reel: WatchFeaturedReel) => {
    const confirmed = window.confirm(`Delete featured reel "${reel.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    const result = await deleteWatchFeaturedReel(reel.id);
    setSaving(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    if (form.id === reel.id) clearForm();
    setNotice("Featured reel deleted.");
    await refresh();
  };

  return (
    <article className="rounded-3xl border border-white/15 bg-black/35 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Watch Control</p>
          <h2 className="mt-2 font-display text-2xl text-white">Featured Reel Scheduler</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Spotlight one scheduled reel on the watch page. Future entries rotate automatically based on the go live time.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/62">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold/78">Current Public Reel</p>
          <p className="mt-2 text-sm text-white/82">{currentReel?.title || "None live right now"}</p>
          <p className="mt-1 text-[11px] text-white/50">
            {currentReel ? `Since ${formatSchedule(currentReel.goLiveAt)}` : "Add or schedule a reel to populate /watch."}
          </p>
        </div>
      </div>

      {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-white/65">Loading featured reel schedule...</p>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">
                {form.id ? "Edit Scheduled Reel" : "Schedule New Reel"}
              </p>
              {form.id && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="min-h-10 rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Reel Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  placeholder="Chip Lee - Featured Reel"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Reel Link</span>
                <input
                  value={form.link}
                  onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))}
                  className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  placeholder="YouTube watch/share/embed URL"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Thumbnail Override</span>
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))}
                  className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  placeholder="Optional thumbnail URL"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Go Live At</span>
                  <input
                    type="datetime-local"
                    value={form.goLiveAt}
                    onChange={(event) => setForm((current) => ({ ...current, goLiveAt: event.target.value }))}
                    className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Retire At</span>
                  <input
                    type="datetime-local"
                    value={form.retireAt}
                    onChange={(event) => setForm((current) => ({ ...current, retireAt: event.target.value }))}
                    className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                  placeholder="Optional scheduling notes"
                />
              </label>

              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/82">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>Keep this scheduled reel active</span>
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/62">
                <p className="text-[10px] uppercase tracking-[0.22em] text-gold/78">Link Preview</p>
                {normalizedPreview.ok ? (
                  <div className="mt-3 space-y-2">
                    <p>Platform: <span className="text-white/84">{normalizedPreview.data.platform}</span></p>
                    <p className="break-all">Embed: <span className="text-white/84">{normalizedPreview.data.embedUrl}</span></p>
                    {normalizedPreview.data.thumbnailUrl && (
                      <p className="break-all">Thumbnail: <span className="text-white/84">{normalizedPreview.data.thumbnailUrl}</span></p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-rose-200">{normalizedPreview.error}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveReel()}
                  disabled={saving}
                  className="min-h-11 rounded-full bg-ember px-5 py-2 text-[10px] uppercase tracking-[0.22em] text-ink disabled:opacity-50"
                >
                  {saving ? "Saving..." : form.id ? "Update Featured Reel" : "Save Featured Reel"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      goLiveAt: toLocalDateTimeInput(new Date().toISOString())
                    }))
                  }
                  className="min-h-11 rounded-full border border-gold/45 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold"
                >
                  Set Live Now
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">Scheduled Queue</p>
            <div className="mt-4 space-y-3">
              {queue.map((reel) => {
                const state = getScheduleState(reel);
                return (
                  <div key={reel.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/88">{reel.title}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-gold/80">
                          {reel.platform} | {state}
                        </p>
                        <p className="mt-2 text-[11px] text-white/55">Live: {formatSchedule(reel.goLiveAt)}</p>
                        {reel.retireAt && <p className="mt-1 text-[11px] text-white/45">Retire: {formatSchedule(reel.retireAt)}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editReel(reel)}
                          className="min-h-9 rounded-full border border-gold/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeReel(reel)}
                          className="min-h-9 rounded-full border border-rose-400/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!queue.length && <p className="text-sm text-white/60">No featured reels scheduled yet.</p>}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
