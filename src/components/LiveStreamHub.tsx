import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser, isCloudVaultEnabled, type VaultUser } from "../lib/fanVault";
import OperatorLiveConsole from "./OperatorLiveConsole";

type Platform = "youtube" | "instagram" | "facebook" | "twitch" | "multi";

type LiveAlertPreference = {
  enabled: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  smsPhone: string;
  preferredPlatform: Platform;
  updatedAt: string;
};

const LOCAL_KEY_PREFIX = "the-performa-live-alerts-v1";
const LIVE_STATUS_KEY = "the-performa-live-status-v1";

const defaultPreference: LiveAlertPreference = {
  enabled: true,
  emailAlerts: true,
  smsAlerts: false,
  smsPhone: "",
  preferredPlatform: "multi",
  updatedAt: new Date().toISOString()
};

const streamPlatforms = [
  { label: "YouTube", href: "https://www.youtube.com/@chipleetheperforma/live" },
  { label: "Instagram Live", href: "https://www.instagram.com/chiplee_theperforma/" },
  { label: "Facebook Live", href: "https://www.facebook.com/people/Chipleetheperforma/61572970724635/" }
];

const streamEmbedUrl = "https://www.youtube.com/embed/PvrXChRa7LI?rel=0";

const getSupabase = () => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

const readLocalPreference = (userId: string): LiveAlertPreference => {
  try {
    const raw = localStorage.getItem(`${LOCAL_KEY_PREFIX}:${userId}`);
    if (!raw) return defaultPreference;
    return { ...defaultPreference, ...JSON.parse(raw) } as LiveAlertPreference;
  } catch {
    return defaultPreference;
  }
};

const saveLocalPreference = (userId: string, preference: LiveAlertPreference) => {
  localStorage.setItem(`${LOCAL_KEY_PREFIX}:${userId}`, JSON.stringify(preference));
};

export default function LiveStreamHub() {
  const [user, setUser] = useState<VaultUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [prefs, setPrefs] = useState<LiveAlertPreference>(defaultPreference);
  const [liveStatus, setLiveStatus] = useState<{ status: string; updatedAt?: string } | null>(null);
  const operatorAllowlist = useMemo(
    () =>
      String(import.meta.env.PUBLIC_OPERATOR_EMAILS || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const isLoggedIn = Boolean(user);
  const isOperator = Boolean(user?.email && operatorAllowlist.includes(user.email.toLowerCase()));

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const current = await getCurrentUser();
      setUser(current);

      if (!current) {
        setLoading(false);
        return;
      }

      const local = readLocalPreference(current.id);
      setPrefs(local);

      if (isCloudVaultEnabled) {
        const supabase = getSupabase();
        if (supabase) {
          const { data } = await supabase
            .from("fan_live_subscriptions")
            .select("enabled,email_alerts,sms_alerts,sms_phone,preferred_platform,updated_at")
            .eq("user_id", current.id)
            .maybeSingle();

          if (data) {
            setPrefs({
              enabled: Boolean(data.enabled),
              emailAlerts: Boolean(data.email_alerts),
              smsAlerts: Boolean(data.sms_alerts),
              smsPhone: data.sms_phone ? String(data.sms_phone) : "",
              preferredPlatform: (data.preferred_platform as Platform) || "multi",
              updatedAt: data.updated_at || new Date().toISOString()
            });
          }
        }
      }

      setLoading(false);
    };

    void init();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const syncStatus = () => {
      try {
        const raw = localStorage.getItem(LIVE_STATUS_KEY);
        setLiveStatus(raw ? JSON.parse(raw) : null);
      } catch {
        setLiveStatus(null);
      }
    };
    syncStatus();
    window.addEventListener("performa:live-status", syncStatus);
    window.addEventListener("storage", syncStatus);
    return () => {
      window.removeEventListener("performa:live-status", syncStatus);
      window.removeEventListener("storage", syncStatus);
    };
  }, []);

  const canSaveCloud = useMemo(() => isCloudVaultEnabled && !!user, [user]);

  const persist = async (next: LiveAlertPreference) => {
    if (!user) return;
    setPrefs(next);
    saveLocalPreference(user.id, next);
    setSaving(true);

    if (canSaveCloud) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("fan_live_subscriptions").upsert(
          {
            user_id: user.id,
            enabled: next.enabled,
            email_alerts: next.emailAlerts,
            sms_alerts: next.smsAlerts,
            sms_phone: next.smsPhone || null,
            preferred_platform: next.preferredPlatform,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id" }
        );
      }
    }

    setSaving(false);
    setNotice("Live alert preferences saved.");
  };

  return (
    <div className="rounded-[2rem] border border-white/15 bg-black/50 p-5 md:p-7 shadow-[0_0_70px_rgba(242,84,45,0.12)]">
      <p className="text-[10px] uppercase tracking-[0.32em] text-gold/80">Chip Lee Pop-Up Fan Streams</p>
      {liveStatus?.status === "live" && (
        <p className="mt-2 inline-flex rounded-full border border-ember/60 bg-ember/15 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold">
          Live Now
        </p>
      )}
      <h3 className="mt-3 font-display text-2xl md:text-3xl">Live Stream Command Deck</h3>
      <p className="mt-3 max-w-3xl text-sm text-white/70">
        Go live directly from the portal, trigger fan alerts for registered users, and simulcast your stream feed out to major platforms.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/45">
          <div className="aspect-video w-full">
            <iframe
              className="h-full w-full"
              src={streamEmbedUrl}
              title="Chip Lee Pop-Up Fan Stream"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3">
            <p className="text-xs text-white/65">Set this embed to the current live URL before going on air for pop-up stream sessions.</p>
            <a href="/watch" className="rounded-full border border-white/25 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/80">
              Open Watch
            </a>
          </div>
        </div>

        <aside className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">On-Air Alerts</p>
          {loading && <p className="mt-3 text-sm text-white/65">Loading your alert settings...</p>}
          {!loading && !isLoggedIn && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white/70">Register or log in to Fan Vault for live-on-air notifications.</p>
              <a href="/fan-club" className="inline-flex rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-ink">
                Open Fan Vault
              </a>
            </div>
          )}
          {!loading && isLoggedIn && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white/75">{user?.name}, control how you get notified when Chip Lee is on air.</p>
              <label className="flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={prefs.enabled}
                  onChange={(event) => void persist({ ...prefs, enabled: event.target.checked, updatedAt: new Date().toISOString() })}
                />
                Enable live alerts
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={prefs.emailAlerts}
                  onChange={(event) => void persist({ ...prefs, emailAlerts: event.target.checked, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                />
                Email me when stream starts
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={prefs.smsAlerts}
                  onChange={(event) => void persist({ ...prefs, smsAlerts: event.target.checked, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                />
                SMS priority ping
              </label>
              <label className="block text-xs text-white/80">
                SMS phone
                <input
                  type="tel"
                  value={prefs.smsPhone}
                  onChange={(event) => setPrefs((prev) => ({ ...prev, smsPhone: event.target.value }))}
                  onBlur={() => void persist({ ...prefs, smsPhone: prefs.smsPhone.trim(), updatedAt: new Date().toISOString() })}
                  placeholder="+1 404 555 0123"
                  disabled={!prefs.enabled || !prefs.smsAlerts}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85 placeholder:text-white/35"
                />
              </label>
              <label className="block text-xs text-white/80">
                Preferred platform
                <select
                  className="mt-1 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85"
                  style={{ color: "#f5f5f7", backgroundColor: "#111318" }}
                  value={prefs.preferredPlatform}
                  onChange={(event) => void persist({ ...prefs, preferredPlatform: event.target.value as Platform, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                >
                  <option value="multi" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>All Platforms</option>
                  <option value="youtube" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>YouTube</option>
                  <option value="instagram" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>Instagram</option>
                  <option value="facebook" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>Facebook</option>
                  <option value="twitch" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>Twitch</option>
                </select>
              </label>
              {notice && <p className="text-[11px] text-gold">{notice}</p>}
              {saving && <p className="text-[11px] text-white/55">Saving...</p>}
              <p className="text-[11px] text-white/45">
                Tip: connect Zapier/Make to your stream status and this alert list for automated blast notifications.
              </p>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Simulcast Targets</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {streamPlatforms.map((platform) => (
            <a
              key={platform.label}
              href={platform.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:border-gold/45 hover:text-gold"
            >
              {platform.label}
            </a>
          ))}
        </div>
      </div>

      {isOperator && (
        <div className="mt-5">
          <OperatorLiveConsole />
        </div>
      )}
    </div>
  );
}
