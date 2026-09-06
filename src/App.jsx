import { useState, useEffect } from "react";

// ─── Design Tokens ───────────────────────────────────────────────────────────
// Deep navy base, electric green accent (betting/sport energy), clean whites
// Typefaces: system-ui for data legibility, bold weights for hierarchy
// Vibe: sharp, fast, Nigerian sports culture — not generic fintech

const COLORS = {
  bg: "#0A0E1A",
  surface: "#111827",
  surfaceHigh: "#1a2235",
  border: "#1f2d45",
  accent: "#00E676",
  accentDim: "#00c45e",
  accentGlow: "rgba(0,230,118,0.12)",
  text: "#F0F4FF",
  textMuted: "#6B7A99",
  textSub: "#A0AABF",
  expired: "#2a1f1f",
  expiredText: "#7a5a5a",
  notify: "#FF6B35",
  sportybet: "#00c45e",
  stake: "#1a6bff",
  bet9ja: "#e63946",
  betking: "#f4a261",
  unknown: "#6B7A99",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const now = Date.now();
const hr = 3600000;

const PUNTERS = [
  {
    id: 1,
    name: "Mr Banks",
    handle: "@mrbanks_tips",
    avatar: "MB",
    followers: 12400,
    verified: true,
    picks: [
      {
        id: 101,
        postedAt: now - 1.2 * hr,
        odds: "14.50",
        platform: "Sportybet",
        type: "code",
        value: "SB-A8K29X",
        note: "Weekend banker 🔥 trust the process",
        expired: false,
      },
      {
        id: 102,
        postedAt: now - 3.5 * hr,
        odds: "6.20",
        platform: "Stake",
        type: "link",
        value: "https://stake.com/betslip/mrb-290xkl",
        note: "Small odds, sure banker",
        expired: false,
      },
      {
        id: 103,
        postedAt: now - 26 * hr,
        odds: "22.00",
        platform: "Sportybet",
        type: "code",
        value: "SB-OLDPK7",
        note: "Yesterday's big game",
        expired: true,
      },
    ],
  },
  {
    id: 2,
    name: "Mr Bayo",
    handle: "@bayotips",
    avatar: "BY",
    followers: 8900,
    verified: true,
    picks: [
      {
        id: 201,
        postedAt: now - 0.5 * hr,
        odds: "31.00",
        platform: "Bet9ja",
        type: "code",
        value: "B9-3KL92MZ",
        note: "Multiple selections, high risk high reward 💯",
        expired: false,
      },
      {
        id: 202,
        postedAt: now - 4 * hr,
        odds: "8.75",
        platform: "Unknown",
        type: "code",
        value: "XK-229ABQ",
        note: "Posted without naming platform",
        expired: false,
      },
    ],
  },
  {
    id: 3,
    name: "Naija Predictor",
    handle: "@naijapredict",
    avatar: "NP",
    followers: 5600,
    verified: false,
    picks: [
      {
        id: 301,
        postedAt: now - 2 * hr,
        odds: "5.40",
        platform: "BetKing",
        type: "code",
        value: "BK-74XMPQ",
        note: "Safe play today, EPL games",
        expired: false,
      },
    ],
  },
];

const PUNTER_REQUESTS = [
  { id: 1, name: "Goalmaster", handle: "@goalmaster_ng", votes: 47, userVoted: false },
  { id: 2, name: "Tipster King", handle: "@tipsterking", votes: 31, userVoted: false },
  { id: 3, name: "Odds Oracle", handle: "@oddsoracle", votes: 19, userVoted: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function platformColor(platform) {
  const map = {
    Sportybet: COLORS.sportybet,
    Stake: COLORS.stake,
    Bet9ja: COLORS.bet9ja,
    BetKing: COLORS.betking,
    Unknown: COLORS.unknown,
  };
  return map[platform] || COLORS.unknown;
}

// ─── Components ───────────────────────────────────────────────────────────────

function Avatar({ initials, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${COLORS.accent}33, ${COLORS.accent}88)`,
      border: `2px solid ${COLORS.accent}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.35, color: COLORS.accent,
      flexShrink: 0, letterSpacing: 0.5,
    }}>
      {initials}
    </div>
  );
}

function PlatformBadge({ platform }) {
  const color = platformColor(platform);
  return (
    <span style={{
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color: color,
      borderRadius: 6, padding: "2px 10px",
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      {platform}
    </span>
  );
}

function PickCard({ pick, expired }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(pick.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const bg = expired ? COLORS.expired : COLORS.surfaceHigh;
  const textColor = expired ? COLORS.expiredText : COLORS.text;
  const mutedColor = expired ? "#5a4040" : COLORS.textMuted;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${expired ? "#3a2a2a" : COLORS.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 10,
      position: "relative",
      opacity: expired ? 0.7 : 1,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <PlatformBadge platform={pick.platform} />
        <span style={{
          background: expired ? "#3a2a2a" : COLORS.accentGlow,
          border: `1px solid ${expired ? "#5a3a3a" : COLORS.accent + "44"}`,
          color: expired ? COLORS.expiredText : COLORS.accent,
          borderRadius: 6, padding: "2px 10px",
          fontSize: 11, fontWeight: 700,
        }}>
          {pick.type === "code" ? "CODE" : "LINK"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: mutedColor }}>
          {timeAgo(pick.postedAt)}
        </span>
      </div>

      {/* Note */}
      {pick.note && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: expired ? mutedColor : COLORS.textSub, fontStyle: "italic" }}>
          "{pick.note}"
        </p>
      )}

      {/* Odds */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: mutedColor }}>Odds</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: expired ? COLORS.expiredText : COLORS.accent, letterSpacing: -0.5 }}>
          {pick.odds}
        </span>
      </div>

      {/* Code / Link */}
      <div style={{
        background: expired ? "#1f1010" : "#0d1520",
        border: `1px solid ${expired ? "#3a2020" : COLORS.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: 14, fontWeight: 700,
          color: textColor, wordBreak: "break-all", flex: 1,
        }}>
          {pick.value}
        </span>
        {!expired && (
          <button onClick={copy} style={{
            background: copied ? COLORS.accent : COLORS.accentGlow,
            border: `1px solid ${COLORS.accent}55`,
            color: copied ? COLORS.bg : COLORS.accent,
            borderRadius: 6, padding: "5px 12px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            flexShrink: 0, transition: "all 0.2s",
          }}>
            {copied ? "Copied!" : pick.type === "link" ? "Open" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function PunterPage({ punter, onBack }) {
  const [tab, setTab] = useState("active");
  const active = punter.picks.filter(p => !p.expired);
  const past = punter.picks.filter(p => p.expired);

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: COLORS.textMuted,
          fontSize: 13, cursor: "pointer", padding: "4px 0", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar initials={punter.avatar} size={52} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{punter.name}</span>
              {punter.verified && (
                <span style={{ color: COLORS.accent, fontSize: 14 }}>✓</span>
              )}
            </div>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{punter.handle}</span>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
              {punter.followers.toLocaleString()} followers on X
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}` }}>
        {[["active", `Active Picks (${active.length})`], ["past", `Past Picks (${past.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "12px", background: "none",
            border: "none", borderBottom: tab === key ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            color: tab === key ? COLORS.accent : COLORS.textMuted,
            fontWeight: tab === key ? 700 : 400, fontSize: 13, cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Picks */}
      <div style={{ padding: 16 }}>
        {tab === "active" && (
          active.length === 0
            ? <p style={{ color: COLORS.textMuted, textAlign: "center", marginTop: 40 }}>No active picks right now.</p>
            : active.map(p => <PickCard key={p.id} pick={p} expired={false} />)
        )}
        {tab === "past" && (
          past.length === 0
            ? <p style={{ color: COLORS.textMuted, textAlign: "center", marginTop: 40 }}>No past picks yet.</p>
            : past.map(p => <PickCard key={p.id} pick={p} expired={true} />)
        )}
      </div>
    </div>
  );
}

function PuntersTab({ onSelectPunter }) {
  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <h2 style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 600, marginBottom: 16, letterSpacing: 0.3 }}>
        FOLLOWED PUNTERS
      </h2>
      {PUNTERS.map(punter => {
        const active = punter.picks.filter(p => !p.expired);
        const hasNew = active.some(p => Date.now() - p.postedAt < 2 * hr);
        return (
          <div key={punter.id} onClick={() => onSelectPunter(punter)} style={{
            background: COLORS.surface,
            border: `1px solid ${hasNew ? COLORS.accent + "44" : COLORS.border}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 12,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
            boxShadow: hasNew ? `0 0 0 1px ${COLORS.accent}22` : "none",
          }}>
            <div style={{ position: "relative" }}>
              <Avatar initials={punter.avatar} />
              {hasNew && (
                <div style={{
                  position: "absolute", top: -2, right: -2,
                  width: 10, height: 10, borderRadius: "50%",
                  background: COLORS.notify, border: `2px solid ${COLORS.bg}`,
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{punter.name}</span>
                {punter.verified && <span style={{ color: COLORS.accent, fontSize: 12 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{punter.handle}</span>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                background: active.length > 0 ? COLORS.accentGlow : "transparent",
                border: `1px solid ${active.length > 0 ? COLORS.accent + "44" : COLORS.border}`,
                borderRadius: 20, padding: "3px 10px",
                fontSize: 12, fontWeight: 700,
                color: active.length > 0 ? COLORS.accent : COLORS.textMuted,
              }}>
                {active.length} active
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                {active.length > 0 ? timeAgo(Math.max(...active.map(p => p.postedAt))) : "No picks"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequestsTab() {
  const [requests, setRequests] = useState(PUNTER_REQUESTS);
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function vote(id) {
    setRequests(prev => prev.map(r =>
      r.id === id && !r.userVoted
        ? { ...r, votes: r.votes + 1, userVoted: true }
        : r
    ).sort((a, b) => b.votes - a.votes));
  }

  function submit() {
    if (!newName.trim() || !newHandle.trim()) return;
    const req = {
      id: Date.now(), name: newName.trim(),
      handle: newHandle.startsWith("@") ? newHandle.trim() : "@" + newHandle.trim(),
      votes: 1, userVoted: true,
    };
    setRequests(prev => [req, ...prev].sort((a, b) => b.votes - a.votes));
    setNewName(""); setNewHandle(""); setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  }

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      {/* Suggest form */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 14, padding: 16, marginBottom: 20,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, margin: "0 0 12px" }}>
          Suggest a Punter
        </h3>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Punter name"
          style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontSize: 14,
            marginBottom: 8, boxSizing: "border-box", outline: "none",
          }}
        />
        <input
          value={newHandle} onChange={e => setNewHandle(e.target.value)}
          placeholder="X handle (e.g. @mrbanks)"
          style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontSize: 14,
            marginBottom: 12, boxSizing: "border-box", outline: "none",
          }}
        />
        <button onClick={submit} style={{
          width: "100%", background: COLORS.accent, border: "none",
          borderRadius: 8, padding: "11px", color: COLORS.bg,
          fontWeight: 800, fontSize: 14, cursor: "pointer",
        }}>
          {submitted ? "Submitted! ✓" : "Submit Request"}
        </button>
      </div>

      {/* Leaderboard */}
      <h2 style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 600, marginBottom: 12, letterSpacing: 0.3 }}>
        MOST REQUESTED
      </h2>
      {requests.map((r, i) => (
        <div key={r.id} style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.textMuted, width: 20 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{r.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{r.handle}</div>
          </div>
          <button onClick={() => vote(r.id)} style={{
            background: r.userVoted ? COLORS.accentGlow : "transparent",
            border: `1px solid ${r.userVoted ? COLORS.accent + "66" : COLORS.border}`,
            borderRadius: 20, padding: "5px 12px",
            color: r.userVoted ? COLORS.accent : COLORS.textMuted,
            fontSize: 13, fontWeight: 700, cursor: r.userVoted ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            ↑ {r.votes}
          </button>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const notifs = [
    { id: 1, punter: "Mr Banks", msg: "posted a new pick on Sportybet — odds 14.50", time: "1h ago", read: false },
    { id: 2, punter: "Mr Bayo", msg: "posted 2 new picks", time: "30m ago", read: false },
    { id: 3, punter: "Naija Predictor", msg: "posted a pick on BetKing — odds 5.40", time: "2h ago", read: true },
    { id: 4, punter: "Mr Banks", msg: "posted a pick on Stake", time: "3h ago", read: true },
  ];

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <h2 style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 600, marginBottom: 16, letterSpacing: 0.3 }}>
        NOTIFICATIONS
      </h2>
      {notifs.map(n => (
        <div key={n.id} style={{
          background: n.read ? COLORS.surface : COLORS.surfaceHigh,
          border: `1px solid ${n.read ? COLORS.border : COLORS.accent + "33"}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 10,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          {!n.read && (
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: COLORS.notify, flexShrink: 0, marginTop: 5,
            }} />
          )}
          {n.read && <div style={{ width: 8, flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: COLORS.accent, fontSize: 14 }}>{n.punter} </span>
            <span style={{ color: COLORS.textSub, fontSize: 14 }}>{n.msg}</span>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function UpDate() {
  const [tab, setTab] = useState("punters");
  const [selectedPunter, setSelectedPunter] = useState(null);
  const [notifCount] = useState(2);

  const NAV = [
    { id: "punters", label: "Punters", icon: "👥" },
    { id: "notifications", label: "Alerts", icon: "🔔", badge: notifCount },
    { id: "requests", label: "Requests", icon: "✙" },
  ];

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", maxWidth: 430,
      margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif",
      color: COLORS.text, position: "relative",
    }}>
      {/* Top bar */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: COLORS.bg, zIndex: 10,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: COLORS.text, letterSpacing: -1 }}>Up</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: COLORS.accent, letterSpacing: -1 }}>Date</span>
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>Live picks from top punters</div>
        </div>
        <div style={{
          background: COLORS.accentGlow, border: `1px solid ${COLORS.accent}44`,
          borderRadius: 20, padding: "4px 12px",
          fontSize: 11, fontWeight: 700, color: COLORS.accent,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, display: "inline-block" }} />
          LIVE
        </div>
      </div>

      {/* Content */}
      <div style={{ overflowY: "auto" }}>
        {selectedPunter ? (
          <PunterPage punter={selectedPunter} onBack={() => setSelectedPunter(null)} />
        ) : tab === "punters" ? (
          <PuntersTab onSelectPunter={setSelectedPunter} />
        ) : tab === "notifications" ? (
          <NotificationsTab />
        ) : (
          <RequestsTab />
        )}
      </div>

      {/* Bottom Nav */}
      {!selectedPunter && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
          display: "flex", zIndex: 20,
        }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              flex: 1, padding: "12px 0 10px",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              borderTop: tab === n.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            }}>
              <div style={{ position: "relative" }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                {n.badge > 0 && tab !== n.id && (
                  <div style={{
                    position: "absolute", top: -4, right: -6,
                    background: COLORS.notify, borderRadius: 10,
                    width: 16, height: 16, fontSize: 9, fontWeight: 700,
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${COLORS.surface}`,
                  }}>
                    {n.badge}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, color: tab === n.id ? COLORS.accent : COLORS.textMuted, fontWeight: tab === n.id ? 700 : 400 }}>
                {n.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
