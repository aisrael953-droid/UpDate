import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// IMPORTANT:
// X credentials NEVER belong in this file.
// X API calls will be handled by the UpDate backend.
//
// VITE_VAPID_PUBLIC_KEY is safe to expose to the browser.
// The matching VAPID PRIVATE KEY must remain server-side.
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

const EXPIRY_MS = 24 * 60 * 60 * 1000;
const AD_CODE = null;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0E1A",
  surface: "#111827",
  surfaceHi: "#1a2235",
  border: "#1f2d45",
  accent: "#00E676",
  accentGlow: "rgba(0,230,118,0.12)",
  text: "#F0F4FF",
  muted: "#6B7A99",
  sub: "#A0AABF",
  expiredBg: "#2a1f1f",
  expiredTxt: "#7a5a5a",
  notify: "#FF6B35",
  admin: "#7c3aed",
  danger: "#e63946",
  platforms: {
    Sportybet: "#00c45e",
    Stake: "#1a6bff",
    Bet9ja: "#e63946",
    BetKing: "#f4a261",
    "1xBet": "#c084fc",
    Unknown: "#6B7A99",
  },
};

// ─── Notification Sounds ─────────────────────────────────────────────────────
const SOUNDS = {
  "Default 🔔": {
    freq: 880,
    type: "sine",
    duration: 0.3,
  },
  "Sharp ⚡": {
    freq: 1200,
    type: "square",
    duration: 0.15,
  },
  "Deep 🥁": {
    freq: 220,
    type: "triangle",
    duration: 0.5,
  },
  "Double 🔁": {
    freq: 660,
    type: "sine",
    duration: 0.2,
    double: true,
  },
  "Alert 🚨": {
    freq: 1000,
    type: "sawtooth",
    duration: 0.25,
  },
};

function playSound(soundName) {
  try {
    const AudioCtx =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    const cfg =
      SOUNDS[soundName] || SOUNDS["Default 🔔"];

    function beep() {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = cfg.type;
      osc.frequency.value = cfg.freq;

      gain.gain.setValueAtTime(
        0.3,
        ctx.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + cfg.duration
      );

      osc.start(ctx.currentTime);
      osc.stop(
        ctx.currentTime + cfg.duration
      );
    }

    beep();

    if (cfg.double) {
      setTimeout(beep, 300);
    }
  } catch {
    // Audio is only a preview.
  }
}

// ─── Betting Detection ────────────────────────────────────────────────────────
// Kept on the frontend as a fallback/helper.
// The backend will also perform detection so that notifications
// can be generated while the app is closed.
function detectPicks(text) {
  const platformKeywords = {
    Sportybet: /sportybet/i,
    Bet9ja: /bet9ja/i,
    BetKing: /betking/i,
    Stake: /stake\.com|stake/i,
    "1xBet": /1xbet/i,
  };

  let detectedPlatform = "Unknown";

  for (const [name, regex] of Object.entries(
    platformKeywords
  )) {
    if (regex.test(text)) {
      detectedPlatform = name;
      break;
    }
  }

  const picks = [];

  const linkRegex =
    /https?:\/\/(www\.)?(stake\.com|sportybet\.com|bet9ja\.com|betking\.com|1xbet\.com)\/\S+/gi;

  (text.match(linkRegex) || []).forEach(
    (link) => {
      let platform = detectedPlatform;

      if (/stake\.com/i.test(link))
        platform = "Stake";

      if (/sportybet/i.test(link))
        platform = "Sportybet";

      if (/bet9ja/i.test(link))
        platform = "Bet9ja";

      if (/betking/i.test(link))
        platform = "BetKing";

      if (/1xbet/i.test(link))
        platform = "1xBet";

      picks.push({
        type: "link",
        value: link,
        platform,
      });
    }
  );

  const skip = new Set([
    "HTTP",
    "HTTPS",
    "THE",
    "AND",
    "FOR",
    "YOU",
    "ALL",
    "ARE",
    "NOT",
    "WIN",
    "BET",
    "ODD",
    "GAME",
  ]);

  const codeRegex =
    /\b([A-Z0-9]{4,12}(?:-[A-Z0-9]{2,8})?)\b/g;

  let m;

  while ((m = codeRegex.exec(text)) !== null) {
    const code = m[1];

    if (
      skip.has(code) ||
      !/\d/.test(code)
    ) {
      continue;
    }

    picks.push({
      type: "code",
      value: code,
      platform: detectedPlatform,
    });
  }

  const oddsMatch =
    text.match(/\b(\d{1,3}\.\d{1,2})\b/);

  const odds = oddsMatch
    ? oddsMatch[1]
    : "—";

  const note = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (picks.length === 0) {
    return [];
  }

  return picks.map((p, i) => ({
    id: `${Date.now()}-${i}`,
    ...p,
    odds,
    note,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "—";

  const d =
    Date.now() - new Date(ts).getTime();

  if (Number.isNaN(d)) return "—";

  const m = Math.floor(d / 60000);

  if (m < 60) {
    return `${Math.max(0, m)}m ago`;
  }

  const h = Math.floor(d / 3600000);

  if (h < 24) {
    return `${h}h ago`;
  }

  return `${Math.floor(d / 86400000)}d ago`;
}

function isExpired(ts) {
  return (
    Date.now() -
      new Date(ts).getTime() >
    EXPIRY_MS
  );
}

function platformColor(platform) {
  return (
    C.platforms[platform] ||
    C.platforms.Unknown
  );
}

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Push Helpers ────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(
  base64String
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 =
    (
      base64String + padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}

async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service workers are not supported on this device."
    );
  }

  return navigator.serviceWorker.register(
    "/sw.js"
  );
}

async function getPushSubscription() {
  const registration =
    await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

async function createPushSubscription() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "Push notifications are not configured yet."
    );
  }

  if (!("Notification" in window)) {
    throw new Error(
      "This browser does not support notifications."
    );
  }

  const registration =
    await registerPushServiceWorker();

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "Notification permission was not granted."
    );
  }

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY
          ),
      });
  }

  return subscription;
}

async function savePushSubscription(
  subscription
) {
  const response = await fetch(
    "/api/push/subscribe",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription,
      }),
    }
  );

  if (!response.ok) {
    let message =
      "Could not save push subscription.";

    try {
      const data =
        await response.json();

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  return response.json();
}

// ─── Ad Banner ────────────────────────────────────────────────────────────────
function AdBanner() {
  return (
    <div
      style={{
        margin: "0 0 16px",
        background:
          "linear-gradient(135deg,#1a1a2e,#16213e)",
        border: `1px dashed ${C.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 60,
      }}
    >
      {AD_CODE ? (
        <div
          dangerouslySetInnerHTML={{
            __html: AD_CODE,
          }}
          style={{ width: "100%" }}
        />
      ) : (
        <>
          <div>
            <div
              style={{
                fontSize: 10,
                color: C.muted,
                marginBottom: 2,
              }}
            >
              SPONSORED
            </div>

            <div
              style={{
                fontSize: 13,
                color: C.sub,
              }}
            >
              Your ad will appear here
            </div>

            <div
              style={{
                fontSize: 11,
                color: C.muted,
              }}
            >
              Sign up on Adsterra or Monetag
            </div>
          </div>

          <div
            style={{
              background: C.accentGlow,
              border: `1px solid ${C.accent}44`,
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 11,
              color: C.accent,
              fontWeight: 700,
            }}
          >
            AD
          </div>
        </>
      )}
    </div>
  );
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Avatar({
  text,
  size = 40,
  followed,
}) {
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(135deg,${C.accent}33,${C.accent}88)`,
          border: `2px solid ${
            followed
              ? C.accent
              : C.accent + "55"
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: size * 0.34,
          color: C.accent,
        }}
      >
        {text}
      </div>

      {followed && (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            background: C.accent,
            borderRadius: "50%",
            width: 12,
            height: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 7,
            color: C.bg,
            fontWeight: 900,
            border: `2px solid ${C.bg}`,
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span
      style={{
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        borderRadius: 6,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  type = "text",
  style = {},
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      placeholder={placeholder}
      style={{
        width: "100%",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        color: C.text,
        fontSize: 14,
        boxSizing: "border-box",
        outline: "none",
        ...style,
      }}
    />
  );
}

function Btn({
  onClick,
  children,
  color = C.accent,
  textColor = C.bg,
  disabled = false,
  style = {},
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: color,
        border: "none",
        borderRadius: 8,
        padding: "11px 16px",
        color: textColor,
        fontWeight: 800,
        fontSize: 14,
        cursor: disabled
          ? "default"
          : "pointer",
        opacity: disabled ? 0.7 : 1,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Push Notification Banner ─────────────────────────────────────────────────
function PushBanner({
  pushEnabled,
  pushLoading,
  pushError,
  onEnable,
}) {
  if (pushEnabled) {
    return (
      <div
        style={{
          marginBottom: 16,
          padding: "11px 14px",
          borderRadius: 10,
          background: C.accentGlow,
          border: `1px solid ${C.accent}33`,
          color: C.accent,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        ✓ Pick notifications are enabled
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 24,
          }}
        >
          🔔
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: C.text,
              marginBottom: 4,
            }}
          >
            Never miss a pick
          </div>

          <div
            style={{
              fontSize: 11,
              color: C.muted,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            Enable push notifications to receive
            alerts when your followed punters post
            new betting picks.
          </div>

          <Btn
            onClick={onEnable}
            disabled={pushLoading}
            style={{
              padding: "9px 12px",
              fontSize: 12,
            }}
          >
            {pushLoading
              ? "Enabling..."
              : "Enable Push Notifications"}
          </Btn>

          {pushError && (
            <div
              style={{
                color: "#ff8080",
                fontSize: 11,
                marginTop: 8,
              }}
            >
              {pushError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pick Card ────────────────────────────────────────────────────────────────
function PickCard({
  pick,
  tweetedAt,
  expired,
}) {
  const [copied, setCopied] =
    useState(false);

  const exp =
    expired || isExpired(tweetedAt);

  function copy() {
    if (!pick.value) return;

    navigator.clipboard?.writeText(
      pick.value
    );

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      1800
    );
  }

  function openLink() {
    if (pick.type !== "link") {
      copy();
      return;
    }

    window.open(
      pick.value,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div
      style={{
        background: exp
          ? C.expiredBg
          : C.surfaceHi,
        border: `1px solid ${
          exp
            ? "#3a2a2a"
            : C.border
        }`,
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 10,
        opacity: exp ? 0.7 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <Badge
          label={pick.platform}
          color={platformColor(
            pick.platform
          )}
        />

        <Badge
          label={
            pick.type === "code"
              ? "CODE"
              : "LINK"
          }
          color={
            exp
              ? C.expiredTxt
              : C.accent
          }
        />

        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: exp
              ? "#5a4040"
              : C.muted,
          }}
        >
          {timeAgo(tweetedAt)}
        </span>
      </div>

      {pick.note && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            color: exp
              ? "#5a4040"
              : C.sub,
            fontStyle: "italic",
          }}
        >
          "{pick.note}"
        </p>
      )}

      {pick.odds !== "—" && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: exp
                ? "#5a4040"
                : C.muted,
            }}
          >
            Odds
          </span>

          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: exp
                ? C.expiredTxt
                : C.accent,
              letterSpacing: -0.5,
            }}
          >
            {pick.odds}
          </span>
        </div>
      )}

      <div
        style={{
          background: exp
            ? "#1f1010"
            : "#0d1520",
          border: `1px solid ${
            exp
              ? "#3a2020"
              : C.border
          }`,
          borderRadius: 8,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            color: exp
              ? C.expiredTxt
              : C.text,
            wordBreak: "break-all",
            flex: 1,
          }}
        >
          {pick.value}
        </span>

        {!exp && (
          <button
            onClick={
              pick.type === "link"
                ? openLink
                : copy
            }
            style={{
              background: copied
                ? C.accent
                : C.accentGlow,
              border: `1px solid ${C.accent}55`,
              color: copied
                ? C.bg
                : C.accent,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {copied
              ? "Copied!"
              : pick.type === "link"
              ? "Open"
              : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Punter Profile Page ──────────────────────────────────────────────────────
function PunterPage({
  punter,
  followed,
  onFollow,
  onUnfollow,
  notifSettings,
  onUpdateNotif,
  onBack,
}) {
  const [tab, setTab] =
    useState("active");

  const [
    showNotifSettings,
    setShowNotifSettings,
  ] = useState(false);

  const allPicks =
    punter.tweets.flatMap((tw) =>
      (tw.picks || []).map((p) => ({
        ...p,
        tweetedAt:
          tw.created_at,
      }))
    );

  const active = allPicks.filter(
    (p) => !isExpired(p.tweetedAt)
  );

  const past = allPicks.filter(
    (p) => isExpired(p.tweetedAt)
  );

  const settings =
    notifSettings[punter.handle] || {
      enabled: true,
      sound: "Default 🔔",
    };

  return (
    <div
      style={{
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: C.muted,
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 0",
            marginBottom: 12,
          }}
        >
          ← Back
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Avatar
            text={initials(
              punter.displayName
            )}
            size={52}
            followed={followed}
          />

          <div
            style={{
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                }}
              >
                {punter.displayName}
              </span>

              {punter.verified && (
                <span
                  style={{
                    color: C.accent,
                  }}
                >
                  ✓
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: 12,
                color: C.muted,
              }}
            >
              @{punter.handle}
            </span>

            {punter.followers && (
              <div
                style={{
                  fontSize: 12,
                  color: C.muted,
                  marginTop: 2,
                }}
              >
                {Number(
                  punter.followers
                ).toLocaleString()}{" "}
                followers on X
              </div>
            )}
          </div>

          <button
            onClick={
              followed
                ? onUnfollow
                : onFollow
            }
            style={{
              background: followed
                ? "transparent"
                : C.accent,
              border: `1px solid ${
                followed
                  ? C.border
                  : C.accent
              }`,
              borderRadius: 20,
              padding: "6px 14px",
              color: followed
                ? C.muted
                : C.bg,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {followed
              ? "Following ✓"
              : "Follow"}
          </button>
        </div>

        {followed && (
          <div
            style={{
              marginTop: 14,
            }}
          >
            <button
              onClick={() =>
                setShowNotifSettings(
                  (v) => !v
                )
              }
              style={{
                background:
                  C.accentGlow,
                border: `1px solid ${C.accent}33`,
                borderRadius: 8,
                padding: "7px 14px",
                color: C.accent,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              🔔 Notification Settings{" "}
              {showNotifSettings
                ? "▲"
                : "▼"}
            </button>

            {showNotifSettings && (
              <div
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    Notifications for{" "}
                    {punter.displayName}
                  </span>

                  <div
                    onClick={() =>
                      onUpdateNotif(
                        punter.handle,
                        {
                          ...settings,
                          enabled:
                            !settings.enabled,
                        }
                      )
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background:
                        settings.enabled
                          ? C.accent
                          : C.border,
                      cursor: "pointer",
                      position: "relative",
                      transition:
                        "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        position:
                          "absolute",
                        top: 2,
                        left: settings.enabled
                          ? 22
                          : 2,
                        width: 20,
                        height: 20,
                        borderRadius:
                          "50%",
                        background:
                          "#fff",
                        transition:
                          "left 0.2s",
                      }}
                    />
                  </div>
                </div>

                {settings.enabled && (
                  <>
                    <p
                      style={{
                        fontSize: 12,
                        color: C.muted,
                        margin:
                          "0 0 8px",
                      }}
                    >
                      Notification sound
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap:
                          "wrap",
                        gap: 6,
                      }}
                    >
                      {Object.keys(
                        SOUNDS
                      ).map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            onUpdateNotif(
                              punter.handle,
                              {
                                ...settings,
                                sound: s,
                              }
                            );

                            playSound(s);
                          }}
                          style={{
                            background:
                              settings.sound ===
                              s
                                ? C.accentGlow
                                : "transparent",
                            border: `1px solid ${
                              settings.sound ===
                              s
                                ? C.accent
                                : C.border
                            }`,
                            borderRadius: 20,
                            padding:
                              "5px 12px",
                            color:
                              settings.sound ===
                              s
                                ? C.accent
                                : C.muted,
                            fontSize: 12,
                            fontWeight:
                              settings.sound ===
                              s
                                ? 700
                                : 400,
                            cursor:
                              "pointer",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <p
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        margin:
                          "8px 0 0",
                      }}
                    >
                      Tap a sound to
                      preview it
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding:
            "12px 16px 0",
        }}
      >
        <AdBanner />
      </div>

      <div
        style={{
          display: "flex",
          borderBottom:
            `1px solid ${C.border}`,
        }}
      >
        {[
          [
            "active",
            `Active (${active.length})`,
          ],
          [
            "past",
            `Past Picks (${past.length})`,
          ],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() =>
              setTab(k)
            }
            style={{
              flex: 1,
              padding: 12,
              background: "none",
              border: "none",
              borderBottom:
                tab === k
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              color:
                tab === k
                  ? C.accent
                  : C.muted,
              fontWeight:
                tab === k
                  ? 700
                  : 400,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: 16,
        }}
      >
        {tab === "active" &&
          (active.length === 0 ? (
            <p
              style={{
                color: C.muted,
                textAlign:
                  "center",
                marginTop: 40,
              }}
            >
              No active picks right
              now.
            </p>
          ) : (
            active.map((p) => (
              <PickCard
                key={p.id}
                pick={p}
                tweetedAt={
                  p.tweetedAt
                }
              />
            ))
          ))}

        {tab === "past" &&
          (past.length === 0 ? (
            <p
              style={{
                color: C.muted,
                textAlign:
                  "center",
                marginTop: 40,
              }}
            >
              No past picks yet.
            </p>
          ) : (
            past.map((p) => (
              <PickCard
                key={p.id}
                pick={p}
                tweetedAt={
                  p.tweetedAt
                }
                expired
              />
            ))
          ))}
      </div>
    </div>
  );
}

// ─── Punters Tab ──────────────────────────────────────────────────────────────
function PuntersTab({
  punters,
  followed,
  loading,
  onSelect,
  pushEnabled,
  pushLoading,
  pushError,
  onEnablePush,
}) {
  const [filter, setFilter] =
    useState("all");

  const shown =
    filter === "following"
      ? punters.filter((p) =>
          followed.has(p.handle)
        )
      : punters;

  if (loading) {
    return (
      <div
        style={{
          padding: "16px 16px 80px",
        }}
      >
        <AdBanner />

        <PushBanner
          pushEnabled={
            pushEnabled
          }
          pushLoading={
            pushLoading
          }
          pushError={
            pushError
          }
          onEnable={
            onEnablePush
          }
        />

        <div
          style={{
            textAlign: "center",
            paddingTop: 40,
            color: C.muted,
          }}
        >
          <div
            style={{
              fontSize: 28,
              marginBottom: 12,
            }}
          >
            ⟳
          </div>

          Loading UpDate...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding:
          "16px 16px 80px",
      }}
    >
      <AdBanner />

      <PushBanner
        pushEnabled={
          pushEnabled
        }
        pushLoading={
          pushLoading
        }
        pushError={
          pushError
        }
        onEnable={
          onEnablePush
        }
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          ["all", "All Punters"],
          ["following", "Following"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() =>
              setFilter(k)
            }
            style={{
              flex: 1,
              padding: 8,
              background:
                filter === k
                  ? C.accentGlow
                  : "transparent",
              border: `1px solid ${
                filter === k
                  ? C.accent + "55"
                  : C.border
              }`,
              borderRadius: 20,
              color:
                filter === k
                  ? C.accent
                  : C.muted,
              fontSize: 12,
              fontWeight:
                filter === k
                  ? 700
                  : 400,
              cursor: "pointer",
            }}
          >
            {label}

            {k === "following"
              ? ` (${followed.size})`
              : ""}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p
          style={{
            color: C.muted,
            textAlign: "center",
            marginTop: 40,
          }}
        >
          You're not following
          anyone yet. Tap a punter to
          follow them.
        </p>
      )}

      {shown.map((punter) => {
        const allPicks =
          punter.tweets.flatMap(
            (tw) =>
              (tw.picks || []).map(
                (p) => ({
                  ...p,
                  tweetedAt:
                    tw.created_at,
                })
              )
          );

        const active =
          allPicks.filter(
            (p) =>
              !isExpired(
                p.tweetedAt
              )
          );

        const hasNew =
          active.some(
            (p) =>
              Date.now() -
                new Date(
                  p.tweetedAt
                ).getTime() <
              2 * 3600000
          );

        const latest =
          active.length
            ? active.reduce(
                (a, b) =>
                  new Date(
                    a.tweetedAt
                  ) >
                  new Date(
                    b.tweetedAt
                  )
                    ? a
                    : b
              )
            : null;

        const isFollowed =
          followed.has(
            punter.handle
          );

        return (
          <div
            key={punter.handle}
            onClick={() =>
              onSelect(punter)
            }
            style={{
              background: C.surface,
              border: `1px solid ${
                hasNew
                  ? C.accent + "44"
                  : C.border
              }`,
              borderRadius: 14,
              padding:
                "14px 16px",
              marginBottom: 12,
              cursor: "pointer",
              display: "flex",
              alignItems:
                "center",
              gap: 12,
              boxShadow: hasNew
                ? `0 0 0 1px ${C.accent}22`
                : "none",
            }}
          >
            <div
              style={{
                position:
                  "relative",
              }}
            >
              <Avatar
                text={initials(
                  punter.displayName
                )}
                followed={
                  isFollowed
                }
              />

              {hasNew && (
                <div
                  style={{
                    position:
                      "absolute",
                    top: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius:
                      "50%",
                    background:
                      C.notify,
                    border: `2px solid ${C.bg}`,
                  }}
                />
              )}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: C.text,
                  }}
                >
                  {punter.displayName}
                </span>

                {isFollowed && (
                  <span
                    style={{
                      fontSize: 10,
                      color: C.accent,
                      background:
                        C.accentGlow,
                      border: `1px solid ${C.accent}33`,
                      borderRadius: 10,
                      padding:
                        "1px 6px",
                    }}
                  >
                    Following
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: C.muted,
                }}
              >
                @{punter.handle}
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  background:
                    active.length >
                    0
                      ? C.accentGlow
                      : "transparent",
                  border: `1px solid ${
                    active.length >
                    0
                      ? C.accent +
                        "44"
                      : C.border
                  }`,
                  borderRadius: 20,
                  padding:
                    "3px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    active.length >
                    0
                      ? C.accent
                      : C.muted,
                }}
              >
                {active.length}{" "}
                active
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginTop: 4,
                }}
              >
                {latest
                  ? timeAgo(
                      latest.tweetedAt
                    )
                  : "No picks"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab({
  notifications,
}) {
  return (
    <div
      style={{
        padding:
          "16px 16px 80px",
      }}
    >
      <AdBanner />

      <p
        style={{
          fontSize: 13,
          color: C.muted,
          marginBottom: 16,
        }}
      >
        RECENT ALERTS
      </p>

      {notifications.length === 0 ? (
        <p
          style={{
            color: C.muted,
            textAlign: "center",
            marginTop: 40,
          }}
        >
          No alerts yet. Follow
          punters to get notified when
          they post.
        </p>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            style={{
              background: n.read
                ? C.surface
                : C.surfaceHi,
              border: `1px solid ${
                n.read
                  ? C.border
                  : C.accent + "33"
              }`,
              borderRadius: 12,
              padding:
                "12px 14px",
              marginBottom: 10,
              display: "flex",
              gap: 10,
              alignItems:
                "flex-start",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius:
                  "50%",
                flexShrink: 0,
                marginTop: 5,
                background: n.read
                  ? "transparent"
                  : C.notify,
              }}
            />

            <div
              style={{
                flex: 1,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: C.accent,
                  fontSize: 14,
                }}
              >
                {n.punter}{" "}
              </span>

              <span
                style={{
                  color: C.sub,
                  fontSize: 14,
                }}
              >
                {n.msg}
              </span>

              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginTop: 4,
                }}
              >
                {timeAgo(n.ts)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────
function RequestsTab() {
  const [requests, setRequests] =
    useState([
      {
        id: 1,
        name: "Goalmaster",
        handle: "@goalmaster_ng",
        votes: 47,
        voted: false,
      },
      {
        id: 2,
        name: "Tipster King",
        handle: "@tipsterking",
        votes: 31,
        voted: false,
      },
      {
        id: 3,
        name: "Odds Oracle",
        handle: "@oddsoracle",
        votes: 19,
        voted: false,
      },
    ]);

  const [name, setName] =
    useState("");

  const [handle, setHandle] =
    useState("");

  const [done, setDone] =
    useState(false);

  function vote(id) {
    setRequests((prev) =>
      prev
        .map((r) =>
          r.id === id &&
          !r.voted
            ? {
                ...r,
                votes:
                  r.votes + 1,
                voted: true,
              }
            : r
        )
        .sort(
          (a, b) =>
            b.votes - a.votes
        )
    );
  }

  function submit() {
    if (
      !name.trim() ||
      !handle.trim()
    ) {
      return;
    }

    setRequests((prev) =>
      [
        {
          id: Date.now(),
          name: name.trim(),
          handle:
            handle.startsWith("@")
              ? handle
              : "@" + handle,
          votes: 1,
          voted: true,
        },
        ...prev,
      ].sort(
        (a, b) =>
          b.votes - a.votes
      )
    );

    setName("");
    setHandle("");
    setDone(true);

    setTimeout(
      () => setDone(false),
      2500
    );
  }

  return (
    <div
      style={{
        padding:
          "16px 16px 80px",
      }}
    >
      <AdBanner />

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.text,
            margin:
              "0 0 12px",
          }}
        >
          Suggest a Punter
        </h3>

        <Inp
          value={name}
          onChange={setName}
          placeholder="Punter name"
          style={{
            marginBottom: 8,
          }}
        />

        <Inp
          value={handle}
          onChange={setHandle}
          placeholder="X handle (@example)"
          style={{
            marginBottom: 12,
          }}
        />

        <Btn onClick={submit}>
          {done
            ? "Submitted! ✓"
            : "Submit Request"}
        </Btn>
      </div>

      <p
        style={{
          fontSize: 13,
          color: C.muted,
          marginBottom: 12,
        }}
      >
        MOST REQUESTED
      </p>

      {requests.map((r, i) => (
        <div
          key={r.id}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding:
              "12px 14px",
            marginBottom: 10,
            display: "flex",
            alignItems:
              "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: C.muted,
              width: 20,
            }}
          >
            {i + 1}
          </span>

          <div
            style={{
              flex: 1,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: C.text,
              }}
            >
              {r.name}
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
              }}
            >
              {r.handle}
            </div>
          </div>

          <button
            onClick={() =>
              vote(r.id)
            }
            style={{
              background: r.voted
                ? C.accentGlow
                : "transparent",
              border: `1px solid ${
                r.voted
                  ? C.accent + "66"
                  : C.border
              }`,
              borderRadius: 20,
              padding:
                "5px 12px",
              color: r.voted
                ? C.accent
                : C.muted,
              fontSize: 13,
              fontWeight: 700,
              cursor: r.voted
                ? "default"
                : "pointer",
            }}
          >
            ↑ {r.votes}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Admin Login ──────────────────────────────────────────────────────────────
function AdminLogin({
  onSuccess,
}) {
  const [pw, setPw] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [err, setErr] =
    useState("");

  async function attempt() {
    if (!pw.trim()) {
      setErr(
        "Enter the admin password."
      );
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const response =
        await fetch(
          "/api/admin/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              password: pw,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Wrong password"
        );
      }

      const data =
        await response.json();

      if (!data.success) {
        throw new Error(
          "Wrong password"
        );
      }

      onSuccess(data);
    } catch (error) {
      setErr(
        error?.message ||
          "Unable to authenticate."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 32,
        display: "flex",
        flexDirection:
          "column",
        alignItems:
          "center",
        gap: 16,
        paddingTop: 80,
      }}
    >
      <div
        style={{
          fontSize: 40,
        }}
      >
        🔐
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: 18,
          color: C.text,
        }}
      >
        Admin Access
      </div>

      <Inp
        value={pw}
        onChange={setPw}
        placeholder="Enter admin password"
        type="password"
        style={{
          textAlign: "center",
        }}
      />

      {err && (
        <p
          style={{
            color: "#ff8080",
            fontSize: 13,
            margin: 0,
            textAlign: "center",
          }}
        >
          {err}
        </p>
      )}

      <Btn
        onClick={attempt}
        color={C.admin}
        textColor="#fff"
        disabled={loading}
      >
        {loading
          ? "Checking..."
          : "Enter"}
      </Btn>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({
  punters,
  onAdd,
  onRemove,
  onClose,
  adminSession,
}) {
  const [newHandle, setNewHandle] =
    useState("");

  const [newName, setNewName] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleAdd() {
    const handle =
      newHandle
        .replace("@", "")
        .trim();

    const name =
      newName.trim();

    if (!handle || !name) {
      setError(
        "Please fill in both fields."
      );
      return;
    }

    if (
      punters.find(
        (p) =>
          p.handle.toLowerCase() ===
          handle.toLowerCase()
      )
    ) {
      setError(
        "Already added."
      );
      return;
    }

    setAdding(true);
    setError("");

    try {
      await onAdd({
        handle,
        displayName: name,
      });

      setNewHandle("");
      setNewName("");

      setSuccess(
        `@${handle} added successfully.`
      );

      setTimeout(
        () => setSuccess(""),
        3000
      );
    } catch (error) {
      setError(
        error?.message ||
          "Could not add punter."
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      style={{
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: C.muted,
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          ← Back
        </button>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background:
                `${C.admin}22`,
              border:
                `1px solid ${C.admin}55`,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              fontSize: 18,
            }}
          >
            ⚙️
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: C.text,
              }}
            >
              Admin Panel
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
              }}
            >
              Manage UpDate punters
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 16,
        }}
      >
        <div
          style={{
            background: C.surface,
            border:
              `1px solid ${C.admin}44`,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              margin:
                "0 0 14px",
            }}
          >
            Add New Punter
          </h3>

          <Inp
            value={newName}
            onChange={setNewName}
            placeholder="Display name (e.g. Mr Banks)"
            style={{
              marginBottom: 8,
            }}
          />

          <Inp
            value={newHandle}
            onChange={setNewHandle}
            placeholder="X handle (e.g. @Mrbankstips)"
            style={{
              marginBottom: 12,
            }}
          />

          {error && (
            <p
              style={{
                color: "#ff8080",
                fontSize: 12,
                margin:
                  "0 0 10px",
              }}
            >
              {error}
            </p>
          )}

          {success && (
            <p
              style={{
                color: C.accent,
                fontSize: 12,
                margin:
                  "0 0 10px",
              }}
            >
              {success}
            </p>
          )}

          <Btn
            onClick={handleAdd}
            color={C.admin}
            textColor="#fff"
            disabled={
              adding ||
              !adminSession
            }
          >
            {adding
              ? "Adding..."
              : "Add Punter"}
          </Btn>
        </div>

        <p
          style={{
            fontSize: 13,
            color: C.muted,
            marginBottom: 12,
          }}
        >
          CURRENT PUNTERS (
          {punters.length})
        </p>

        {punters.map((p) => (
          <div
            key={p.handle}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding:
                "12px 14px",
              marginBottom: 10,
              display: "flex",
              alignItems:
                "center",
              gap: 12,
            }}
          >
            <Avatar
              text={initials(
                p.displayName
              )}
              size={36}
            />

            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: C.text,
                }}
              >
                {p.displayName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: C.muted,
                }}
              >
                @{p.handle}
              </div>
            </div>

            <button
              onClick={() =>
                onRemove(p.handle)
              }
              style={{
                background:
                  "#2a1515",
                border:
                  "1px solid #5a2020",
                borderRadius: 8,
                padding:
                  "5px 12px",
                color:
                  "#ff8080",
                fontSize: 12,
                fontWeight: 700,
                cursor:
                  "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}

        <div
          style={{
            background: C.surface,
            border:
              `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 16,
            marginTop: 20,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              margin:
                "0 0 6px",
            }}
          >
            Ad Setup
          </h3>

          <p
            style={{
              fontSize: 12,
              color: C.muted,
              margin:
                "0 0 10px",
            }}
          >
            Ad integration will be
            connected separately.
            Do not paste third-party
            scripts directly into
            this React component.
          </p>

          <div
            style={{
              background: C.bg,
              border:
                `1px solid ${C.border}`,
              borderRadius: 8,
              padding:
                "10px 12px",
              fontFamily:
                "monospace",
              fontSize: 11,
              color: C.muted,
            }}
          >
            Ad integration:
            server/config stage
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function UpDate() {
  const [tab, setTab] =
    useState("punters");

  const [punters, setPunters] =
    useState([
      {
        handle: "39billion",
        displayName:
          "39 Billion",
        tweets: [],
        followers: null,
        verified: false,
        userId: null,
      },
      {
        handle: "mrbayoa1",
        displayName:
          "Mr Bayo",
        tweets: [],
        followers: null,
        verified: false,
        userId: null,
      },
      {
        handle: "Mrbankstips",
        displayName:
          "Mr Banks",
        tweets: [],
        followers: null,
        verified: false,
        userId: null,
      },
    ]);

  const [followed, setFollowed] =
    useState(new Set());

  const [notifSettings, setNotifSettings] =
    useState({});

  const [notifications, setNotifications] =
    useState([]);

  const [selected, setSelected] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [lastFetch, setLastFetch] =
    useState(null);

  const [apiError, setApiError] =
    useState(null);

  const [showAdmin, setShowAdmin] =
    useState(false);

  const [adminAuthed, setAdminAuthed] =
    useState(false);

  const [adminSession, setAdminSession] =
    useState(null);

  const [logoTaps, setLogoTaps] =
    useState(0);

  const [pushEnabled, setPushEnabled] =
    useState(false);

  const [pushLoading, setPushLoading] =
    useState(false);

  const [pushError, setPushError] =
    useState("");

  // ─── Register service worker ───────────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    registerPushServiceWorker()
      .then(async () => {
        const subscription =
          await getPushSubscription();

        if (subscription) {
          setPushEnabled(true);
        }
      })
      .catch((error) => {
        console.error(
          "Service worker registration failed:",
          error
        );
      });
  }, []);

  // ─── Enable real push notifications ────────────────────────────────────────
  const enablePushNotifications =
    useCallback(async () => {
      setPushLoading(true);
      setPushError("");

      try {
        const subscription =
          await createPushSubscription();

        await savePushSubscription(
          subscription.toJSON()
        );

        setPushEnabled(true);
      } catch (error) {
        console.error(error);

        setPushError(
          error?.message ||
            "Unable to enable push notifications."
        );
      } finally {
        setPushLoading(false);
      }
    }, []);

  // ─── Load punters/picks from backend ───────────────────────────────────────
  const loadBackendData =
    useCallback(async () => {
      setApiError(null);

      try {
        const response =
          await fetch(
            "/api/punters",
            {
              method: "GET",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            `Backend returned ${response.status}`
          );
        }

        const data =
          await response.json();

        if (
          Array.isArray(
            data.punters
          )
        ) {
          setPunters(
            data.punters.map(
              (p) => ({
                handle:
                  p.handle,
                displayName:
                  p.displayName ||
                  p.name ||
                  p.handle,
                tweets:
                  Array.isArray(
                    p.tweets
                  )
                    ? p.tweets
                    : [],
                followers:
                  p.followers ??
                  null,
                verified:
                  Boolean(
                    p.verified
                  ),
                userId:
                  p.userId ||
                  null,
              })
            )
          );
        }

        if (
          Array.isArray(
            data.notifications
          )
        ) {
          setNotifications(
            data.notifications
          );
        }

        setLastFetch(
          new Date()
        );
      } catch (error) {
        console.error(
          "Unable to load UpDate backend:",
          error
        );

        // This is intentionally not treated as an X API error.
        // X is now server-side.
        setApiError(
          "UpDate backend is not connected yet."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  // ─── Logo admin trigger ────────────────────────────────────────────────────
  function handleLogoTap() {
    setLogoTaps((n) => {
      const next = n + 1;

      if (next >= 5) {
        setShowAdmin(true);
        return 0;
      }

      return next;
    });
  }

  // ─── Follow system ─────────────────────────────────────────────────────────
  async function follow(handle) {
    setFollowed((prev) => {
      const s = new Set(prev);
      s.add(handle);
      return s;
    });

    try {
      await fetch(
        "/api/follows",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            handle,
            action: "follow",
          }),
        }
      );
    } catch {
      // Backend persistence will be
      // implemented with the account system.
    }
  }

  async function unfollow(handle) {
    setFollowed((prev) => {
      const s = new Set(prev);
      s.delete(handle);
      return s;
    });

    try {
      await fetch(
        "/api/follows",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            handle,
            action: "unfollow",
          }),
        }
      );
    } catch {
      // Backend persistence will be
      // implemented with the account system.
    }
  }

  function updateNotif(
    handle,
    settings
  ) {
    setNotifSettings((prev) => ({
      ...prev,
      [handle]: settings,
    }));

    fetch(
      "/api/notification-settings",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          handle,
          ...settings,
        }),
      }
    ).catch(() => {
      // Backend persistence will be
      // finalized with the user account system.
    });
  }

  // ─── Admin functions ───────────────────────────────────────────────────────
  async function addPunter(p) {
    if (!adminSession) {
      throw new Error(
        "Admin session expired."
      );
    }

    const response =
      await fetch(
        "/api/admin/punters",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${adminSession}`,
          },
          body: JSON.stringify({
            handle: p.handle,
            displayName:
              p.displayName,
          }),
        }
      );

    if (!response.ok) {
      let message =
        "Could not add punter.";

      try {
        const data =
          await response.json();

        if (data?.error) {
          message = data.error;
        }
      } catch {
        // Keep default message.
      }

      throw new Error(message);
    }

    const data =
      await response.json();

    if (data?.punter) {
      setPunters((prev) => [
        ...prev,
        {
          ...data.punter,
          tweets:
            data.punter.tweets ||
            [],
        },
      ]);
    } else {
      await loadBackendData();
    }
  }

  async function removePunter(handle) {
    if (!adminSession) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/admin/punters/${encodeURIComponent(
            handle
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${adminSession}`,
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not remove punter."
        );
      }

      setPunters((prev) =>
        prev.filter(
          (p) =>
            p.handle !== handle
        )
      );
    } catch (error) {
      setApiError(
        error?.message ||
          "Could not remove punter."
      );
    }
  }

  function handleAdminSuccess(data) {
    setAdminAuthed(true);

    if (data?.token) {
      setAdminSession(data.token);
    }
  }

  // ─── Notification badge ────────────────────────────────────────────────────
  const unread =
    notifications.filter(
      (n) => !n.read
    ).length;

  const NAV = [
    {
      id: "punters",
      label: "Punters",
      icon: "👥",
    },
    {
      id: "notifications",
      label: "Alerts",
      icon: "🔔",
      badge: unread,
    },
    {
      id: "requests",
      label: "Requests",
      icon: "✙",
    },
  ];

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        fontFamily:
          "'Inter', system-ui, sans-serif",
        color: C.text,
      }}
    >
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:
            "16px 16px 12px",
          borderBottom:
            `1px solid ${C.border}`,
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "space-between",
          position: "sticky",
          top: 0,
          background: C.bg,
          zIndex: 10,
        }}
      >
        <div
          onClick={handleLogoTap}
          style={{
            cursor: "default",
            userSelect: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "baseline",
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: C.text,
                letterSpacing: -1,
              }}
            >
              Up
            </span>

            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: C.accent,
                letterSpacing: -1,
              }}
            >
              Date
            </span>
          </div>

          <div
            style={{
              fontSize: 11,
              color: C.muted,
            }}
          >
            {lastFetch
              ? `Updated ${timeAgo(
                  lastFetch
                )}`
              : "Connecting to UpDate..."}
          </div>
        </div>

        <div
          style={{
            background:
              C.accentGlow,
            border:
              `1px solid ${C.accent}44`,
            borderRadius: 20,
            padding:
              "4px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: C.accent,
            display: "flex",
            alignItems:
              "center",
            gap: 5,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background:
                C.accent,
              display:
                "inline-block",
            }}
          />

          LIVE
        </div>
      </div>

      {/* ─── Backend Error ───────────────────────────────────────────────── */}
      {apiError && (
        <div
          style={{
            background: "#2a1515",
            borderBottom:
              "1px solid #5a2020",
            padding:
              "10px 16px",
            fontSize: 12,
            color: "#ff8080",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 10,
          }}
        >
          <span>{apiError}</span>

          <button
            onClick={
              loadBackendData
            }
            style={{
              background: "none",
              border: "none",
              color: C.accent,
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      {showAdmin ? (
        adminAuthed ? (
          <AdminPanel
            punters={punters}
            onAdd={addPunter}
            onRemove={
              removePunter
            }
            onClose={() => {
              setShowAdmin(false);
              setAdminAuthed(false);
              setAdminSession(null);
            }}
            adminSession={
              adminSession
            }
          />
        ) : (
          <AdminLogin
            onSuccess={
              handleAdminSuccess
            }
          />
        )
      ) : selected ? (
        <PunterPage
          punter={selected}
          followed={followed.has(
            selected.handle
          )}
          onFollow={() =>
            follow(
              selected.handle
            )
          }
          onUnfollow={() =>
            unfollow(
              selected.handle
            )
          }
          notifSettings={
            notifSettings
          }
          onUpdateNotif={
            updateNotif
          }
          onBack={() =>
            setSelected(null)
          }
        />
      ) : tab === "punters" ? (
        <PuntersTab
          punters={punters}
          followed={followed}
          loading={loading}
          onSelect={setSelected}
          pushEnabled={
            pushEnabled
          }
          pushLoading={
            pushLoading
          }
          pushError={
            pushError
          }
          onEnable={
            enablePushNotifications
          }
        />
      ) : tab ===
        "notifications" ? (
        <AlertsTab
          notifications={
            notifications
          }
        />
      ) : (
        <RequestsTab />
      )}

      {/* ─── Bottom Navigation ───────────────────────────────────────────── */}
      {!selected &&
        !showAdmin && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform:
                "translateX(-50%)",
              width: "100%",
              maxWidth: 430,
              background:
                C.surface,
              borderTop:
                `1px solid ${C.border}`,
              display: "flex",
              zIndex: 20,
            }}
          >
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() =>
                  setTab(n.id)
                }
                style={{
                  flex: 1,
                  padding:
                    "12px 0 10px",
                  background:
                    "none",
                  border: "none",
                  cursor:
                    "pointer",
                  display: "flex",
                  flexDirection:
                    "column",
                  alignItems:
                    "center",
                  gap: 3,
                  borderTop:
                    tab === n.id
                      ? `2px solid ${C.accent}`
                      : "2px solid transparent",
                }}
              >
                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {n.icon}
                  </span>

                  {n.badge > 0 &&
                    tab !==
                      n.id && (
                      <div
                        style={{
                          position:
                            "absolute",
                          top: -4,
                          right: -6,
                          background:
                            C.notify,
                          borderRadius: 10,
                          width: 16,
                          height: 16,
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#fff",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          border: `1px solid ${C.surface}`,
                        }}
                      >
                        {n.badge}
                      </div>
                    )}
                </div>

                <span
                  style={{
                    fontSize: 10,
                    color:
                      tab === n.id
                        ? C.accent
                        : C.muted,
                    fontWeight:
                      tab === n.id
                        ? 700
                        : 400,
                  }}
                >
                  {n.label}
                </span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
    }
