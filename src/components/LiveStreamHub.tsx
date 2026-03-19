import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, isCloudVaultEnabled, type VaultUser } from "../lib/fanVault";
import { getBrowserSupabaseClient } from "../lib/supabaseBrowser";
import { isStoreAdmin } from "../lib/storefront";
import OperatorLiveConsole from "./OperatorLiveConsole";
import LiveCompanion from "./LiveCompanion";
import { getPublicLiveStatus, type PublicLiveStatus } from "../lib/performaLive";

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
const LIVE_ALERTS_ID = "live-alerts";

const formatIcsDate = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const escapeIcsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

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
  const [publicLive, setPublicLive] = useState<PublicLiveStatus | null>(null);
  const [adminEnabled, setAdminEnabled] = useState(false);
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
  const canModerateLive = isOperator || adminEnabled;

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const current = await getCurrentUser();
      setUser(current);
      setAdminEnabled(current ? await isStoreAdmin() : false);

      if (!current) {
        setLoading(false);
        return;
      }

      const local = readLocalPreference(current.id);
      setPrefs(local);

      if (isCloudVaultEnabled) {
        const supabase = getBrowserSupabaseClient();
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

  useEffect(() => {
    const load = async () => {
      const result = await getPublicLiveStatus();
      if (result.ok) setPublicLive(result.data);
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const canSaveCloud = useMemo(() => isCloudVaultEnabled && !!user, [user]);
  const emailReminderActive = Boolean(prefs.enabled && prefs.emailAlerts);
  const smsReminderActive = Boolean(prefs.enabled && prefs.smsAlerts);

  const persist = async (next: LiveAlertPreference) => {
    if (!user) return;
    setPrefs(next);
    saveLocalPreference(user.id, next);
    setSaving(true);

    if (canSaveCloud) {
      const supabase = getBrowserSupabaseClient();
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

  const openAlertSettings = () => {
    document.getElementById(LIVE_ALERTS_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleEmailReminder = async () => {
    if (!user) {
      window.location.assign("/fan-club");
      return;
    }
    const nextEmailAlerts = !emailReminderActive;
    const nextSmsAlerts = smsReminderActive;
    await persist({
      ...prefs,
      enabled: nextEmailAlerts || nextSmsAlerts,
      emailAlerts: nextEmailAlerts,
      smsAlerts: nextSmsAlerts,
      updatedAt: new Date().toISOString()
    });
  };

  const toggleSmsReminder = async () => {
    if (!user) {
      window.location.assign("/fan-club");
      return;
    }
    if (!prefs.smsPhone.trim()) {
      setNotice("Add an SMS number below to enable text reminders.");
      openAlertSettings();
      return;
    }
    const nextSmsAlerts = !smsReminderActive;
    const nextEmailAlerts = emailReminderActive;
    await persist({
      ...prefs,
      enabled: nextEmailAlerts || nextSmsAlerts,
      emailAlerts: nextEmailAlerts,
      smsAlerts: nextSmsAlerts,
      updatedAt: new Date().toISOString()
    });
  };

  const addSessionToCalendar = () => {
    if (!publicLive?.scheduledFor) return;
    const start = new Date(publicLive.scheduledFor);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + 90 * 60_000);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//The Performa//Live Session//EN",
      "BEGIN:VEVENT",
      `UID:live-${publicLive.sessionId}@theperforma.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(publicLive.title || "The Performa Live Session")}`,
      `DESCRIPTION:${escapeIcsText("Watch live at https://theperforma.com/watch")}`,
      "URL:https://theperforma.com/watch",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `the-performa-live-${publicLive.sessionId.slice(0, 8)}.ics`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setNotice("Calendar invite downloaded.");
  };

  return (
    <div className="rounded-[2rem] border border-white/15 bg-black/50 p-5 shadow-[0_0_70px_rgba(242,84,45,0.12)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold/80">Chip Lee Pop-Up Fan Streams</p>
          {liveStatus?.status === "live" && (
            <p className="mt-2 inline-flex rounded-full border border-ember/60 bg-ember/15 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold">
              Live Now
            </p>
          )}
          <h3 className="mt-3 font-display text-2xl md:text-3xl">Live Companion Deck</h3>
          <p className="mt-3 max-w-3xl text-sm text-white/70">
            Publish into the live session on the left, keep the player centered, and let the session chat run in its own right-side window with independent scrolling.
          </p>
        </div>
        {canModerateLive && (
          <span className="rounded-full border border-gold/45 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
            Host Controls Enabled
          </span>
        )}
      </div>

      <div className="mt-6">
        <LiveCompanion
          session={publicLive}
          user={user}
          canModerate={canModerateLive}
          fallbackEmbedUrl={streamEmbedUrl}
          reminders={{
            isLoggedIn,
            saving,
            emailActive: emailReminderActive,
            smsActive: smsReminderActive,
            hasSmsPhone: Boolean(prefs.smsPhone.trim()),
            settingsHref: `#${LIVE_ALERTS_ID}`,
            onAddToCalendar: addSessionToCalendar,
            onToggleEmail: () => void toggleEmailReminder(),
            onToggleSms: () => void toggleSmsReminder(),
            onOpenSettings: openAlertSettings
          }}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <aside id={LIVE_ALERTS_ID} className="rounded-2xl border border-white/15 bg-black/45 p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">On-Air Alerts</p>
          {loading && <p className="mt-3 text-sm text-white/65">Loading your alert settings...</p>}
          {!loading && !isLoggedIn && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white/70">Register or log in to Fan Vault for live-on-air notifications.</p>
              <a href="/fan-club" className="inline-flex min-h-11 items-center rounded-full bg-ember px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-ink">
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
                  className="h-4 w-4 shrink-0 accent-ember"
                />
                Enable live alerts
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={prefs.emailAlerts}
                  onChange={(event) => void persist({ ...prefs, emailAlerts: event.target.checked, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                  className="h-4 w-4 shrink-0 accent-ember"
                />
                Email me when stream starts
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={prefs.smsAlerts}
                  onChange={(event) => void persist({ ...prefs, smsAlerts: event.target.checked, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                  className="h-4 w-4 shrink-0 accent-ember"
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
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm text-white/85 placeholder:text-white/35"
                />
              </label>
              <label className="block text-xs text-white/80">
                Preferred platform
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm text-white/85"
                  style={{ color: "#f5f5f7", backgroundColor: "#111318" }}
                  value={prefs.preferredPlatform}
                  onChange={(event) => void persist({ ...prefs, preferredPlatform: event.target.value as Platform, updatedAt: new Date().toISOString() })}
                  disabled={!prefs.enabled}
                >
                  <option value="multi" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                    All Platforms
                  </option>
                  <option value="youtube" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                    YouTube
                  </option>
                  <option value="instagram" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                    Instagram
                  </option>
                  <option value="facebook" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                    Facebook
                  </option>
                  <option value="twitch" style={{ color: "#0f1116", backgroundColor: "#ffffff" }}>
                    Twitch
                  </option>
                </select>
              </label>
              {notice && <p className="text-[11px] text-gold">{notice}</p>}
              {saving && <p className="text-[11px] text-white/55">Saving...</p>}
            </div>
          )}
        </aside>

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Simulcast Targets</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {streamPlatforms.map((platform) => (
                <a
                  key={platform.label}
                  href={platform.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:border-gold/45 hover:text-gold"
                >
                  {platform.label}
                </a>
              ))}
            </div>
          </div>
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
