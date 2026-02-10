import { useMemo, useState } from "react";

type BlastStatus = "live" | "offline" | "test";
type Platform = "youtube" | "instagram" | "facebook" | "twitch" | "multi";

type DispatchLog = {
  id: string;
  createdAt: string;
  status: BlastStatus;
  title: string;
  streamUrl: string;
  platform: Platform;
  emailSent: number;
  smsSent: number;
};

const LIVE_STATUS_KEY = "the-performa-live-status-v1";
const LIVE_DISPATCH_LOG_KEY = "the-performa-live-dispatch-logs-v1";
const OPERATOR_TOKEN_KEY = "the-performa-operator-token-v1";
const OPERATOR_NAME_KEY = "the-performa-operator-name-v1";

const readDispatchLogs = (): DispatchLog[] => {
  try {
    return JSON.parse(localStorage.getItem(LIVE_DISPATCH_LOG_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function OperatorLiveConsole() {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(OPERATOR_TOKEN_KEY) || "");
  const [operator, setOperator] = useState(() => localStorage.getItem(OPERATOR_NAME_KEY) || "chip-lee");
  const [title, setTitle] = useState("Chip Lee Pop-Up Fan Stream");
  const [streamUrl, setStreamUrl] = useState("https://theperforma.com/live");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);

  const functionUrl = useMemo(() => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) return "";
    try {
      const host = new URL(supabaseUrl).host;
      const projectRef = host.split(".")[0];
      if (!projectRef) return "";
      return `https://${projectRef}.functions.supabase.co/go-live-blast`;
    } catch {
      return "";
    }
  }, []);

  const runBlast = async (status: BlastStatus) => {
    if (!functionUrl) {
      setNotice("Missing Supabase URL. Configure PUBLIC_SUPABASE_URL.");
      return;
    }
    if (!token.trim()) {
      setNotice("Enter operator token.");
      return;
    }
    setWorking(true);
    setNotice("");
    localStorage.setItem(OPERATOR_TOKEN_KEY, token.trim());
    localStorage.setItem(OPERATOR_NAME_KEY, operator.trim() || "chip-lee");

    try {
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
          "x-operator": operator.trim() || "chip-lee"
        },
        body: JSON.stringify({
          status,
          title,
          streamUrl,
          platform,
          sendEmail,
          sendSms
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(`Blast failed: ${payload?.error || response.statusText}`);
        return;
      }

      const emailSent = Number(payload?.result?.email?.sent || 0);
      const smsSent = Number(payload?.result?.sms?.sent || 0);
      const nextStatus = {
        status,
        title,
        streamUrl,
        platform,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(LIVE_STATUS_KEY, JSON.stringify(nextStatus));
      window.dispatchEvent(new Event("performa:live-status"));

      const logs = readDispatchLogs();
      logs.unshift({
        id: `dispatch_${Date.now()}`,
        createdAt: new Date().toISOString(),
        status,
        title,
        streamUrl,
        platform,
        emailSent,
        smsSent
      });
      localStorage.setItem(LIVE_DISPATCH_LOG_KEY, JSON.stringify(logs.slice(0, 40)));
      window.dispatchEvent(new Event("performa:dispatch-log"));

      setNotice(`Blast sent. Email ${emailSent}, SMS ${smsSent}.`);
    } catch {
      setNotice("Blast request failed.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-black/45 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Operator Console</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75"
        >
          {open ? "Hide" : "Open"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3">
          <input
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
            className="rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
            placeholder="Operator name"
          />
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
            placeholder="LIVE_BLAST_TOKEN"
            type="password"
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
            placeholder="Stream title"
          />
          <input
            value={streamUrl}
            onChange={(event) => setStreamUrl(event.target.value)}
            className="rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
            placeholder="Stream URL"
          />
          <label className="text-xs text-white/80">
            Platform
            <select
              className="mt-1 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
              value={platform}
              onChange={(event) => setPlatform(event.target.value as Platform)}
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="twitch">Twitch</option>
              <option value="multi">Multi</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/75">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
              Email
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} />
              SMS
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runBlast("live")}
              disabled={working}
              className="rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-ink disabled:opacity-60"
            >
              Go Live
            </button>
            <button
              type="button"
              onClick={() => void runBlast("test")}
              disabled={working}
              className="rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 disabled:opacity-60"
            >
              Test Blast
            </button>
            <button
              type="button"
              onClick={() => void runBlast("offline")}
              disabled={working}
              className="rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 disabled:opacity-60"
            >
              End Live
            </button>
          </div>
          {notice && <p className="text-[11px] text-gold">{notice}</p>}
        </div>
      )}
    </div>
  );
}

