import { useState } from "react";
import IngestCard from "./IngestCard";
import { createLiveSession, type LiveProvider } from "../lib/performaLive";

export default function PerformaLiveNewWizard() {
  const [title, setTitle] = useState("Performa Live Session");
  const [provider, setProvider] = useState<LiveProvider>("cloudflare_stream");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<{
    sessionId: string;
    ingestUrl: string;
    streamKey: string;
    ingestType: string;
  } | null>(null);

  const runCreate = async () => {
    setCreating(true);
    setNotice("");
    const response = await createLiveSession({ title: title.trim(), provider });
    setCreating(false);
    if (!response.ok) {
      setNotice(response.error);
      return;
    }
    setCreated({
      sessionId: response.data.session.id,
      ingestUrl: response.data.ingest.url,
      streamKey: response.data.ingest.streamKey,
      ingestType: response.data.session.ingest_type
    });
    setNotice("Session created. Save the stream key now.");
  };

  return (
    <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-white/15 bg-black/45 p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Create Session</p>
        <h1 className="mt-2 font-display text-3xl">Performa Live Wizard</h1>
        <p className="mt-2 text-sm text-white/70">Creates a control-plane session and provisions provider ingest. Streaming workloads remain off-site.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/75">
            Session Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-white/75">
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as LiveProvider)}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
            >
              <option value="cloudflare_stream">Cloudflare Stream (Live Inputs + Outputs)</option>
              <option value="livepeer_studio">Livepeer Studio (adapter stub)</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void runCreate()}
          disabled={creating}
          className="mt-4 min-h-11 rounded-full border border-gold/45 bg-gold/10 px-4 text-[10px] uppercase tracking-[0.2em] text-gold disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create Live Session"}
        </button>

        {notice && <p role="status" aria-live="polite" className="mt-3 text-xs text-gold">{notice}</p>}

        {created && (
          <div className="mt-6 space-y-3">
            <IngestCard ingestUrl={created.ingestUrl} streamKeyOneTime={created.streamKey} ingestType={created.ingestType} />
            <a
              href={`/live/${created.sessionId}`}
              className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/80"
            >
              Open Go Live Console
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
