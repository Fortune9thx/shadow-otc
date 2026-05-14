import { useState, useEffect } from "react";
import { getContract } from "../lib/contract";

/* ── design tokens ─────────────────────────────────────── */
const T = {
  bg:      "#F0F4F2",
  card:    "#ffffff",
  border:  "#D8E8E0",
  em:      "#0B6B4B",
  emLight: "#1a8a63",
  emBg:    "#EAF4EF",
  text:    "#1a2e25",
  muted:   "#6B8C7D",
  warn:    "#b45309",
  danger:  "#dc2626",
  success: "#16a34a",
};

/* ── tier helper ───────────────────────────────────────── */
function getTier(score) {
  if (score >= 90) return { label: "Elite",   color: "#7c3aed", bg: "#f3e8ff", icon: "💎" };
  if (score >= 75) return { label: "Expert",  color: "#1d4ed8", bg: "#dbeafe", icon: "⭐" };
  if (score >= 50) return { label: "Trusted", color: "#0B6B4B", bg: "#EAF4EF", icon: "✓"  };
  if (score >= 30) return { label: "Rising",  color: "#b45309", bg: "#fef3c7", icon: "↑"  };
  return              { label: "New",     color: "#6B8C7D", bg: "#F0F4F2", icon: "○"  };
}

/* ── score color ───────────────────────────────────────── */
function scoreColor(score) {
  if (score >= 90) return "#7c3aed";
  if (score >= 75) return "#1d4ed8";
  if (score >= 50) return "#0B6B4B";
  if (score >= 30) return "#b45309";
  return "#dc2626";
}

/* ── main component ────────────────────────────────────── */
export default function ReputationBadge({ address, compact = false }) {
  const [rep, setRep]         = useState(undefined); // undefined = loading, null = not found
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setRep(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const contract = getContract();
        const raw = await contract.getReputation(address).catch(() => null);
        if (cancelled) return;

        if (!raw) {
          setRep(null);
        } else {
          setRep({
            score:      Number(raw.score),
            completed:  Number(raw.completed),
            failed:     Number(raw.failed),
            disputed:   Number(raw.disputed),
            totalDeals: Number(raw.totalDeals),
          });
        }
      } catch {
        if (!cancelled) setRep(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [address]);

  /* ── loading skeleton ──────────────────────────────── */
  if (loading) {
    if (compact) {
      return (
        <span
          style={{
            display:      "inline-block",
            width:        80,
            height:       22,
            borderRadius: 999,
            background:   "#E5E7EB",
            verticalAlign: "middle",
            animation:    "repPulse 1.4s ease-in-out infinite",
          }}
        />
      );
    }
    return (
      <div
        style={{
          borderRadius: 12,
          border:       `1px solid ${T.border}`,
          background:   T.card,
          padding:      "14px 16px",
          animation:    "repPulse 1.4s ease-in-out infinite",
        }}>
        <div style={{ height: 14, width: "60%", borderRadius: 6, background: "#E5E7EB", marginBottom: 10 }} />
        <div style={{ height: 8,  width: "40%", borderRadius: 6, background: "#F3F4F6" }} />
      </div>
    );
  }

  /* ── no reputation (V2 contract / fallback) ──────── */
  if (!rep) {
    if (compact) {
      return (
        <span
          style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           4,
            padding:       "2px 10px",
            borderRadius:  999,
            background:    T.bg,
            border:        `1px solid ${T.border}`,
            color:         T.muted,
            fontSize:      11,
            fontWeight:    600,
            whiteSpace:    "nowrap",
          }}>
          ○ New · Unverified
        </span>
      );
    }
    return (
      <div
        style={{
          borderRadius: 12,
          border:       `1px solid ${T.border}`,
          background:   T.card,
          padding:      "14px 16px",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>○</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>New · Unverified</p>
            <p style={{ margin: 0, fontSize: 11, color: T.muted, marginTop: 2 }}>No on-chain reputation yet</p>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 10, color: T.muted }}>Verified on Ritual Chain</p>
      </div>
    );
  }

  /* ── resolved reputation ────────────────────────── */
  const tier  = getTier(rep.score);
  const color = scoreColor(rep.score);

  /* compact pill */
  if (compact) {
    return (
      <span
        style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           5,
          padding:       "2px 10px",
          borderRadius:  999,
          background:    tier.bg,
          border:        `1px solid ${color}33`,
          color:         tier.color,
          fontSize:      11,
          fontWeight:    600,
          whiteSpace:    "nowrap",
        }}>
        {tier.icon} {rep.score} · {tier.label}
      </span>
    );
  }

  /* full card */
  return (
    <>
      {/* keyframe for loading skeleton */}
      <style>{`
        @keyframes repPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
      `}</style>

      <div
        style={{
          borderRadius: 12,
          border:       `1px solid ${T.border}`,
          background:   T.card,
          padding:      "14px 16px",
        }}>

        {/* Score row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Tier badge */}
            <span
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          4,
                padding:      "3px 10px",
                borderRadius: 999,
                background:   tier.bg,
                border:       `1px solid ${color}33`,
                color:        tier.color,
                fontSize:     11,
                fontWeight:   700,
              }}>
              {tier.icon} {tier.label}
            </span>
          </div>

          {/* Numeric score */}
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{rep.score}</span>
            <span style={{ fontSize: 11, color: T.muted, marginLeft: 2 }}>/100</span>
          </div>
        </div>

        {/* Score bar */}
        <div
          style={{
            height:       5,
            borderRadius: 999,
            background:   T.border,
            marginBottom: 12,
            overflow:     "hidden",
          }}>
          <div
            style={{
              height:       "100%",
              borderRadius: 999,
              background:   color,
              width:        `${rep.score}%`,
              transition:   "width 0.5s ease",
            }}
          />
        </div>

        {/* Mini stat row */}
        <div
          style={{
            display:       "flex",
            gap:           12,
            fontSize:      11,
            color:         T.muted,
            marginBottom:  10,
          }}>
          <span>
            <span style={{ fontWeight: 700, color: T.success }}>{rep.completed}</span> completed
          </span>
          <span>·</span>
          <span>
            <span style={{ fontWeight: 700, color: T.danger }}>{rep.failed}</span> failed
          </span>
          <span>·</span>
          <span>
            <span style={{ fontWeight: 700, color: T.warn }}>{rep.disputed}</span> disputes
          </span>
        </div>

        {/* Footer */}
        <p style={{ margin: 0, fontSize: 10, color: T.muted }}>Verified on Ritual Chain</p>
      </div>
    </>
  );
}
