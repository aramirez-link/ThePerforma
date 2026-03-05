import { useEffect, useState } from "react";
import {
  getLiveUser,
  isPerformaLiveCloudEnabled,
  loadLiveSessions,
  signInLiveWithMagicLink,
  signOutLive,
  type LiveSession
} from "../lib/performaLive";

export default function PerformaLiveSessionsPanel() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    const user = await getLiveUser();
    setUserEmail(user?.email || "");
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const response = await loadLiveSessions();
    if (response.ok) setSessions(response.data);
    else setNotice(response.error);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!isPerformaLiveCloudEnabled) {
    return (
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-white/15 bg-black/45 p-5">
          <p className="text-sm text-white/70">Performa Live control plane requires `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-white/15 bg-black/45 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Creator Control Plane</p>
            <h2 className="mt-2 font-display text-2xl">Performa Live Sessions</h2>
          </div>
          {userEmail && (
            <button
              type="button"
              onClick={() => void signOutLive().then(refresh)}
              className="min-h-10 rounded-full border border-white/25 px-4 text-[10px] uppercase tracking-[0.2em] text-white/75"
            >
              Sign Out
            </button>
          )}
        </div>

        {!userEmail && (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="creator@email.com"
              className="min-h-11 rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                void signInLiveWithMagicLink(email).then((result) => {
                  setNotice(result.ok ? "Magic link sent. Check inbox." : result.error);
                })
              }
              className="min-h-11 rounded-full border border-gold/45 bg-gold/10 px-4 text-[10px] uppercase tracking-[0.2em] text-gold"
            >
              Send Magic Link
            </button>
          </div>
        )}

        {userEmail && (
          <div className="mt-4">
            <p className="text-xs text-white/70">Signed in as {userEmail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/live/new" className="min-h-10 rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold">
                New Session
              </a>
              <button
                type="button"
                onClick={() => void refresh()}
                className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {loading && <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />}
              {!loading && !sessions.length && <p className="text-sm text-white/65">No sessions yet.</p>}
              {sessions.map((session) => (
                <a key={session.id} href={`/live/${session.id}`} className="block rounded-xl border border-white/15 bg-black/35 p-3 hover:border-gold/35">
                  <p className="text-sm text-white">{session.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    {session.status} · {new Date(session.created_at).toLocaleString()}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {notice && <p role="status" aria-live="polite" className="mt-3 text-xs text-gold">{notice}</p>}
      </div>
    </section>
  );
}
