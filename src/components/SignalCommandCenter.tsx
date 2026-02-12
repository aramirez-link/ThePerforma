import { useEffect, useMemo, useRef, useState } from "react";

type Trend = "Rising" | "Steady" | "Cooling";

type ActiveFan = {
  id: string;
  name: string;
  online: boolean;
};

type CitySignal = {
  city: string;
  score: number;
  status: string;
};

type SyncTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationSec: number;
  sourceType: "audio";
  moods?: string[];
};

type ClaudeMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  energy: number;
  trend: Trend;
  activeFans: ActiveFan[];
  citySignals: CitySignal[];
  weeklyPrompt: string;
  rankLabel: string;
  xp: number;
  progressPct: number;
  onUsePrompt: () => void;
  onDropAttend: () => void;
  inline?: boolean;
};

const ASSISTANT_KEY = "the-performa-claude-assistant-v1";
const SYNC_KEY = "the-performa-fan-sync-v1";
const SYNC_VOLUME_KEY = "the-performa-fan-sync-volume-v1";
const SYNC_MUTE_KEY = "the-performa-fan-sync-mute-v1";
const SYNC_EPOCH_KEY = "the-performa-sync-epoch-v1";

const tracks: SyncTrack[] = [
  { id: "s1", title: "Night Signal I", artist: "Performa Loop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", durationSec: 372, sourceType: "audio", moods: ["hype", "mainstage"] },
  { id: "s2", title: "Afterhours Wire", artist: "Performa Loop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", durationSec: 357, sourceType: "audio", moods: ["dark", "afterhours"] },
  { id: "s3", title: "Velvet Pressure", artist: "Performa Loop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", durationSec: 302, sourceType: "audio", moods: ["chill", "warm"] },
  { id: "s4", title: "Ignition Grid", artist: "Performa Loop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", durationSec: 345, sourceType: "audio", moods: ["hype", "festival"] },
  { id: "s5", title: "Ritual Lift", artist: "Performa Loop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", durationSec: 410, sourceType: "audio", moods: ["afterhours", "deep"] }
];

const totalCycleSec = tracks.reduce((sum, track) => sum + track.durationSec, 0);

const dayKey = () => new Date().toISOString().slice(0, 10);

const getSyncSnapshot = (epochMs: number, nowMs: number) => {
  const elapsed = Math.max(0, Math.floor((nowMs - epochMs) / 1000));
  const cyclePos = totalCycleSec > 0 ? elapsed % totalCycleSec : 0;
  let acc = 0;
  for (let i = 0; i < tracks.length; i += 1) {
    const end = acc + tracks[i].durationSec;
    if (cyclePos < end) {
      return {
        track: tracks[i],
        index: i,
        offsetSec: cyclePos - acc,
        next: tracks[(i + 1) % tracks.length]
      };
    }
    acc = end;
  }
  return { track: tracks[0], index: 0, offsetSec: 0, next: tracks[1] || tracks[0] };
};

const assistantReply = (input: string, ctx: { energy: number; trend: Trend; citySignals: CitySignal[]; track: SyncTrack }) => {
  const q = input.toLowerCase();
  if (q.includes("energy")) {
    return `Energy is at ${ctx.energy}%, trend ${ctx.trend.toLowerCase()}. Keep post cadence high for signal lift.`;
  }
  if (q.includes("stage mode") || q.includes("atlanta")) {
    const atl = ctx.citySignals.find((c) => c.city.toLowerCase().includes("atlanta"));
    return `Atlanta is ${atl?.status || "active"} now. Recommended mode: Club Ignition with a 75-90 min pressure arc.`;
  }
  const mood = ["dark", "hype", "afterhours", "chill"].find((word) => q.includes(word));
  if (mood) {
    const moodTrack = tracks.find((t) => (t.moods || []).includes(mood)) || ctx.track;
    return `For a ${mood} mood, run "${moodTrack.title}" and transition on bar 16 into a tighter low-end build.`;
  }
  return `Current sync track is "${ctx.track.title}". City lead is ${ctx.citySignals[0]?.city || "Atlanta"}. Keep captions concise and cinematic for stronger conversion.`;
};

export default function SignalCommandCenter({
  energy,
  trend,
  activeFans,
  citySignals,
  weeklyPrompt,
  rankLabel,
  xp,
  progressPct,
  onUsePrompt,
  onDropAttend,
  inline = false
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fanSyncEnabled, setFanSyncEnabled] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [muted, setMuted] = useState(false);
  const [epochMs, setEpochMs] = useState<number>(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [assistantInput, setAssistantInput] = useState("");
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [dropAwardedDay, setDropAwardedDay] = useState("");
  const syncStartedAtRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(SYNC_KEY);
    const storedVolume = localStorage.getItem(SYNC_VOLUME_KEY);
    const storedMuted = localStorage.getItem(SYNC_MUTE_KEY);
    const storedEpoch = localStorage.getItem(SYNC_EPOCH_KEY);
    const storedMessages = localStorage.getItem(ASSISTANT_KEY);
    if (storedEnabled) setFanSyncEnabled(storedEnabled === "true");
    if (storedVolume) setVolume(Math.max(0, Math.min(1, Number(storedVolume) || 0.65)));
    if (storedMuted) setMuted(storedMuted === "true");
    if (storedEpoch) setEpochMs(Number(storedEpoch) || Date.now());
    else {
      const initial = Date.now() - 1000 * 60 * 23;
      setEpochMs(initial);
      localStorage.setItem(SYNC_EPOCH_KEY, String(initial));
    }
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages) as ClaudeMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-10));
      } catch {
        // ignore
      }
    }
    const params = new URLSearchParams(window.location.search);
    const syncParam = params.get("fanSyncEnabled");
    if (syncParam === "1" || syncParam === "true") setFanSyncEnabled(true);
    if (syncParam === "0" || syncParam === "false") setFanSyncEnabled(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(SYNC_KEY, String(fanSyncEnabled));
  }, [fanSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(SYNC_VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(SYNC_MUTE_KEY, String(muted));
  }, [muted]);

  useEffect(() => {
    localStorage.setItem(ASSISTANT_KEY, JSON.stringify(messages.slice(-10)));
  }, [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const syncSnapshot = useMemo(() => getSyncSnapshot(epochMs, nowMs), [epochMs, nowMs]);
  const progressPctSync = Math.round((syncSnapshot.offsetSec / Math.max(1, syncSnapshot.track.durationSec)) * 100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!fanSyncEnabled) {
      audio.pause();
      syncStartedAtRef.current = null;
      return;
    }

    const desired = syncSnapshot.track.url;
    const drift = Math.abs((audio.currentTime || 0) - syncSnapshot.offsetSec);
    if (audio.src !== desired) {
      audio.src = desired;
      audio.currentTime = syncSnapshot.offsetSec;
    } else if (drift > 2.2) {
      audio.currentTime = syncSnapshot.offsetSec;
    }
    audio.play().catch(() => {
      // browser autoplay gate
    });

    if (!syncStartedAtRef.current) syncStartedAtRef.current = Date.now();
  }, [fanSyncEnabled, syncSnapshot.track.url, syncSnapshot.offsetSec]);

  useEffect(() => {
    if (!fanSyncEnabled || !syncStartedAtRef.current) return;
    if (dropAwardedDay === dayKey()) return;
    const elapsedMs = Date.now() - syncStartedAtRef.current;
    if (elapsedMs >= 5 * 60 * 1000) {
      setDropAwardedDay(dayKey());
      onDropAttend();
    }
  }, [fanSyncEnabled, nowMs, dropAwardedDay, onDropAttend]);

  const sendAssistant = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ClaudeMessage = { id: `${Date.now()}-u`, role: "user", text: trimmed };
    const reply = assistantReply(trimmed, {
      energy,
      trend,
      citySignals,
      track: syncSnapshot.track
    });
    const assistantMsg: ClaudeMessage = { id: `${Date.now()}-a`, role: "assistant", text: reply };
    setMessages((current) => [...current, userMsg, assistantMsg].slice(-10));
    setAssistantInput("");
  };

  const panel = (
    <aside className="rounded-[1.6rem] border border-white/15 bg-black/45 p-4 backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.28em] text-gold/85">Signal Command Center</p>

      <section className="mt-4 rounded-2xl border border-white/15 bg-black/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Now Playing</p>
          <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em] ${fanSyncEnabled ? "border-gold/55 text-gold" : "border-white/25 text-white/65"}`}>
            {fanSyncEnabled ? "Sync Live" : "Personal"}
          </span>
        </div>
        <label className="mt-2 flex items-center justify-between text-xs text-white/75">
          <span>Fan Sync Mode</span>
          <input type="checkbox" checked={fanSyncEnabled} onChange={(e) => setFanSyncEnabled(e.target.checked)} />
        </label>
        {fanSyncEnabled ? (
          <div className="mt-3">
            <p className="text-sm text-white/85">{syncSnapshot.track.title}</p>
            <p className="text-[11px] text-white/55">{syncSnapshot.track.artist} · Next: {syncSnapshot.next.title}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-all duration-500" style={{ width: `${progressPctSync}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setMuted((v) => !v)} className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
                {muted ? "Unmute" : "Mute"}
              </button>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full" />
            </div>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/15 bg-black/40">
            <iframe
              src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/chipleetheperforma"
              title="SoundCloud mini player"
              className="h-[120px] w-full"
              allow="autoplay"
              loading="lazy"
            />
          </div>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Live Room Pulse</p>
        <p className="mt-2 text-sm text-white/90">Energy tonight: {energy}%</p>
        <p className="text-[11px] text-white/55">Trend: {trend}</p>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Active Fans</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeFans.slice(0, 8).map((fan) => (
            <span key={fan.id} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-[10px] ${fan.online ? "border-gold/60 text-gold" : "border-white/25 text-white/65"}`} title={fan.name}>
              {fan.name.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/55">{activeFans.filter((fan) => fan.online).length} online</p>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">City Signals</p>
        <div className="mt-2 space-y-2">
          {citySignals.slice(0, 5).map((city) => (
            <div key={city.city}>
              <div className="flex items-center justify-between text-[11px] text-white/72">
                <span>{city.city}</span>
                <span>{city.status}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${city.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Signal Level</p>
        <p className="mt-2 text-sm text-white/90">{rankLabel}</p>
        <p className="text-[11px] text-white/55">XP: {xp}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Weekly Prompt</p>
        <p className="mt-2 text-sm text-white/80">{weeklyPrompt}</p>
        <button type="button" onClick={onUsePrompt} className="mt-3 min-h-10 rounded-full border border-gold/45 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-gold">
          Post Today's Prompt
        </button>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Ask Claude (Performa AI)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "What's tonight's energy?",
            "Suggest a track for this mood",
            "What Stage Mode fits Atlanta?"
          ].map((prompt) => (
            <button key={prompt} type="button" onClick={() => sendAssistant(prompt)} className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/70">
              {prompt}
            </button>
          ))}
        </div>
        <div className="mt-3 max-h-40 space-y-2 overflow-auto rounded-xl border border-white/10 bg-black/35 p-2">
          {messages.length === 0 && <p className="text-[11px] text-white/50">Assistant ready.</p>}
          {messages.map((message) => (
            <p key={message.id} className={`text-[11px] ${message.role === "assistant" ? "text-gold/90" : "text-white/80"}`}>
              {message.role === "assistant" ? "Claude: " : "You: "}
              {message.text}
            </p>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            placeholder="Ask Performa AI..."
            className="min-h-10 flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-xs text-white"
          />
          <button type="button" onClick={() => sendAssistant(assistantInput)} className="min-h-10 rounded-full border border-gold/45 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-gold">
            Send
          </button>
        </div>
      </section>
    </aside>
  );

  if (inline) return panel;

  return (
    <>
      <div className="hidden lg:block">
        <div className="fixed right-[max(1rem,calc((100vw-72rem)/2+1rem))] top-24 z-30 w-[340px] max-h-[calc(100vh-7rem)] overflow-auto">
          {panel}
        </div>
      </div>
      <div className="lg:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="min-h-11 rounded-full border border-white/25 bg-black/45 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/80">
          Open Command Center
        </button>
        {drawerOpen && (
          <div className="fixed inset-0 z-[90] bg-black/70 p-4">
            <div className="mx-auto max-h-[92vh] w-full max-w-md overflow-auto">
              <div className="mb-3 flex justify-end">
                <button type="button" onClick={() => setDrawerOpen(false)} className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/80">
                  Close
                </button>
              </div>
              {panel}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
