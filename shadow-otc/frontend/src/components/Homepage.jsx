import { useEffect, useMemo, useRef, useState } from "react";
import { fetchOnChainDeals, fetchPlatformStats, CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS } from "../lib/contract";
import ReputationBadge from "./ReputationBadge";

/* ─── design tokens ──────────────────────────────────── */
const T = {
  bg:      "#F0F4F2",
  card:    "#ffffff",
  panel:   "#F3F6F4",
  border:  "rgba(11,107,75,0.16)",
  borderS: "rgba(11,107,75,0.28)",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBr:    "#0D7A56",
  emBg:    "#EAF4EF",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textDim: "#7B8A84",
  shadow:  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
};

/* ─── status badge config ────────────────────────────── */
const STATUS_BADGE = {
  0: { label: "Seeking",          bg: "#EAF4EF", color: "#0B6B4B", border: "rgba(11,107,75,0.28)", pulse: false },
  1: { label: "Accepted",         bg: "#EFF6FF", color: "#1d4ed8", border: "rgba(29,78,216,0.28)", pulse: false },
  2: { label: "Pending Delivery", bg: "#FFFBEB", color: "#b45309", border: "rgba(180,83,9,0.28)",  pulse: false },
  3: { label: "Verifying",        bg: "#F5F3FF", color: "#7c3aed", border: "rgba(124,58,237,0.35)", pulse: true },
  4: { label: "Completed",        bg: "#ECFDF5", color: "#059669", border: "rgba(5,150,105,0.28)", pulse: false },
  5: { label: "Failed",           bg: "#FEF2F2", color: "#dc2626", border: "rgba(220,38,38,0.28)", pulse: false },
  6: { label: "Disputed",         bg: "#FFF7ED", color: "#ea580c", border: "rgba(234,88,12,0.28)", pulse: false },
  7: { label: "Cancelled",        bg: "#F3F4F6", color: "#6b7280", border: "rgba(107,114,128,0.28)", pulse: false },
  8: { label: "Expired",          bg: "#F3F4F6", color: "#6b7280", border: "rgba(107,114,128,0.28)", pulse: false },
};

/* ─── filter tabs ────────────────────────────────────── */
const FILTERS = [
  { id: "all",       label: "All" },
  { id: "open",      label: "Seeking",   status: 0 },
  { id: "accepted",  label: "Accepted",  status: 1 },
  { id: "verifying", label: "Verifying", status: 3 },
  { id: "completed", label: "Completed", status: 4 },
];

/* ─── loading skeleton row ───────────────────────────── */
function SkelRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse"
      style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="h-8 w-8 rounded-lg flex-shrink-0" style={{ background: "#E5E7EB" }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-48 rounded" style={{ background: "#E5E7EB" }} />
        <div className="h-2.5 w-32 rounded" style={{ background: "#F3F4F6" }} />
      </div>
      <div className="h-3 w-20 rounded hidden sm:block" style={{ background: "#E5E7EB" }} />
      <div className="h-6 w-20 rounded-full" style={{ background: "#E5E7EB" }} />
      <div className="h-3 w-16 rounded hidden md:block" style={{ background: "#F3F4F6" }} />
    </div>
  );
}

/* ─── status badge ───────────────────────────────────── */
function StatusBadge({ statusId }) {
  const cfg = STATUS_BADGE[statusId] ?? STATUS_BADGE[7];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.pulse && (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: cfg.color }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
        </span>
      )}
      {cfg.label}
    </span>
  );
}

/* ─── deal row ───────────────────────────────────────── */
function DealRow({ deal, onClick }) {
  const icon  = CATEGORY_ICONS[deal.category] ?? "📦";
  const label = CATEGORY_LABELS[deal.category] ?? "Unknown";

  return (
    <div
      className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 cursor-pointer transition-colors duration-100"
      style={{ borderBottom: `1px solid ${T.border}` }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.background = T.emBg}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Category icon */}
      <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl text-base"
        style={{ background: T.panel, border: `1px solid ${T.border}` }}>
        {icon}
      </div>

      {/* Intent + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: T.text }}>
          {deal.intent || "(no description)"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: T.textDim }}>
            {label} &middot; #{deal.id}
            {deal.buyer && (
              <span className="hidden sm:inline"> &middot; {deal.buyer.slice(0,6)}…{deal.buyer.slice(-4)}</span>
            )}
          </span>
          {deal.seller && <ReputationBadge address={deal.seller} compact={true} />}
        </div>
      </div>

      {/* Amount — visible on all screens */}
      <div className="flex flex-col items-end flex-shrink-0 w-20 sm:w-24">
        <p className="text-[12px] sm:text-[13px] font-mono font-bold" style={{ color: T.em }}>
          {parseFloat(deal.payment).toFixed(3)}
        </p>
        <p className="text-[10px] font-mono" style={{ color: T.textDim }}>RITUAL</p>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <StatusBadge statusId={deal.status} />
      </div>

      {/* Chevron */}
      <svg className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: T.em }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

/* ─── how it works strip ─────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: "01", title: "Lock Funds",       desc: "Buyer deposits RITUAL into a smart contract escrow — no third party holds the money.",          icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
    { n: "02", title: "Seller Accepts",   desc: "A seller sees the deal, posts optional collateral, and accepts on-chain. Both are now bound.",   icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { n: "03", title: "Agent Verifies",   desc: "After delivery is submitted, an HTTP-fetch agent checks the condition URL and evaluates the result.", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1m-6 0a2 2 0 11-4 0 2 2 0 014 0z" },
    { n: "04", title: "Auto-Release",     desc: "On pass, funds flow to the seller automatically. On fail, the buyer can reclaim. No middleman.",   icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <div className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${T.border}`, background: T.panel }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.em }}>How It Works</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: T.emBg, color: T.em, border: `1px solid ${T.border}` }}>
          4-step flow
        </span>
      </div>
      {/* gap-px + background = dividers that work at every breakpoint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px"
        style={{ background: T.border }}>
        {steps.map(s => (
          <div key={s.n}
            className="flex flex-col gap-3 px-5 py-5"
            style={{ background: T.card }}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold" style={{ color: T.textDim }}>{s.n}</span>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                  style={{ color: T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
            </div>
            <p className="text-[13px] font-bold" style={{ color: T.text }}>{s.title}</p>
            <p className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── agent activity feed ────────────────────────────── */
function AgentFeed() {
  const [lines, setLines]     = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomRef             = useRef(null);
  const containerRef          = useRef(null);
  const BASE = "https://shadow-otc.onrender.com";

  async function fetchActivity() {
    try {
      const res = await fetch(`${BASE}/agent-activity`);
      if (!res.ok) throw new Error("no data");
      const data = await res.json();
      // Backend returns { activity: [{dealId, msg, ts}, ...] }
      const raw = Array.isArray(data)
        ? data
        : (data.activity ?? data.logs ?? data.lines ?? []);
      if (raw.length) {
        // Normalize: items may be strings or {dealId, msg, ts} objects
        // Security: truncate each line to 200 chars to prevent layout attacks (issue #7)
        const MAX_LINE = 200;
        const formatted = raw.slice(-20).map(item => {
          const line = typeof item === "string"
            ? item
            : `[Deal #${item.dealId}] ${item.msg}`;
          return String(line).slice(0, MAX_LINE);
        });
        setLines(formatted);
      }
    } catch {
      // backend may be down; show placeholder
      setLines(prev => prev.length ? prev : [
        "Agent online — waiting for deals to verify",
        "Connected to Ritual Testnet",
        "No activity yet — create a deal to see live logs here",
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Scroll INSIDE the terminal only — never trigger a full-page scroll
    if (distFromBottom < 120) {
      container.scrollTop = container.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: "#0F1412", border: "1px solid rgba(11,107,75,0.25)", boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid rgba(11,107,75,0.20)" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
          <span className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.88)" }}>
            Agent Activity Feed
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.20)" }}>
            Live
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.30)" }}>
          auto-refresh 10s
        </span>
      </div>

      {/* Terminal body */}
      <div ref={containerRef} className="overflow-y-auto px-4 sm:px-5 py-4 font-mono text-[11px] leading-relaxed"
        style={{ minHeight: 80, maxHeight: 140, color: "#4ade80" }}>
        {loading ? (
          <span style={{ color: "rgba(74,222,128,0.50)" }}>Connecting to agent...</span>
        ) : lines.length === 0 ? (
          <span style={{ color: "rgba(74,222,128,0.50)" }}>No recent activity.</span>
        ) : lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span style={{ color: "rgba(74,222,128,0.45)" }}>&gt;&nbsp;</span>
            {l}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────── */
function EmptyState({ onCreateDeal }) {
  return (
    <div className="py-16 text-center px-6">
      <div className="mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center"
        style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          style={{ color: T.em }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold mb-2" style={{ color: T.text }}>No intents posted yet</h3>
      <p className="text-[13px] mb-8 max-w-sm mx-auto leading-relaxed" style={{ color: T.textSub }}>
        Be the first to post an intent. Describe what you're looking for and how much you'll pay in RITUAL — sellers with the goods will respond.
      </p>
      <button onClick={onCreateDeal}
        className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
        style={{ background: T.em, boxShadow: "0 4px 14px rgba(11,107,75,0.20)" }}
        onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
        onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Post Your First Intent
      </button>
    </div>
  );
}

/* ─── live stats bar ─────────────────────────────────── */
function StatsBar({ deals, platformStats }) {
  const total  = platformStats ? String(platformStats.total) : String(deals.length);
  const done   = platformStats ? String(platformStats.completed) : String(deals.filter(d => d.status === 4).length);
  const active = String(deals.filter(d => d.status >= 0 && d.status <= 3).length);
  const locked = platformStats
    ? parseFloat(platformStats.locked).toFixed(3)
    : deals.filter(d => d.status <= 3)
        .reduce((acc, d) => acc + parseFloat(d.payment || "0"), 0)
        .toFixed(3);

  const mobileStats = [
    { label: "Total Deals", value: total,  live: false },
    { label: "Active",      value: active, live: true  },
    { label: "Completed",   value: done,   live: false },
    { label: "Locked",      value: locked, live: true, unit: "RITUAL" },
  ];
  const desktopStats = [
    { label: "TOTAL DEALS",   value: total,   live: false },
    { label: "ACTIVE",        value: active,  live: true  },
    { label: "COMPLETED",     value: done,    live: false },
    { label: "LOCKED RITUAL", value: locked,  live: true  },
    { label: "CHAIN ID",      value: "1979",  live: true  },
  ];

  const wrapStyle = {
    border: `1px solid ${T.border}`,
    boxShadow: "0 1px 0 rgba(255,255,255,0.90), 0 4px 16px rgba(0,0,0,0.06)",
  };

  return (
    <div className="mb-6">
      {/* Mobile: 2×2 grid */}
      <div className="sm:hidden grid grid-cols-2 gap-px rounded-xl overflow-hidden"
        style={{ ...wrapStyle, background: T.border }}>
        {mobileStats.map(s => (
          <div key={s.label} className="flex flex-col items-center py-5 px-4"
            style={{ background: "rgba(255,255,255,0.90)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: T.textDim }}>
                {s.label}
              </span>
              {s.live && (
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: T.emBr, animation: "nodeBreath 2.4s ease-in-out infinite" }} />
              )}
            </div>
            <span className="text-[24px] font-mono font-bold tabular-nums leading-none"
              style={{ color: s.live ? T.em : T.text }}>
              {s.value}
            </span>
            {s.unit && (
              <span className="text-[10px] font-mono mt-1.5" style={{ color: T.textDim }}>{s.unit}</span>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: horizontal row */}
      <div className="hidden sm:flex items-center rounded-xl overflow-hidden"
        style={{ ...wrapStyle, background: "rgba(255,255,255,0.78)" }}>
        {desktopStats.map((s, i) => (
          <div key={s.label}
            className="flex-1 flex flex-col items-center py-4 px-3"
            style={{ borderRight: i < desktopStats.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em]" style={{ color: T.textDim }}>
                {s.label}
              </span>
              {s.live && (
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: T.emBr, animation: "nodeBreath 2.4s ease-in-out infinite" }} />
              )}
            </div>
            <span className="text-[17px] font-mono font-bold tabular-nums"
              style={{ color: s.live ? T.em : T.text, letterSpacing: "-0.01em" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────── */
export default function Homepage({
  wallet,
  onConnect,
  onDisconnect,
  onDealClick,
  onCreateListing,
  onDashboard,
  onStartOTCRoom,
  onMarket,
}) {
  const [deals, setDeals]             = useState([]);
  const [platformStats, setPlatform]  = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [mobileNav, setMobileNav]     = useState(false);
  const [walletMenu, setWalletMenu]   = useState(false);
  const [addrCopied, setAddrCopied]   = useState(false);
  const walletMenuRef                 = useRef(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => !!localStorage.getItem("shadowotc_welcome_v1")
  );

  /* close wallet menu on outside click */
  useEffect(() => {
    if (!walletMenu) return;
    function handler(e) {
      if (!walletMenuRef.current?.contains(e.target)) setWalletMenu(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [walletMenu]);

  /* fetch on mount */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOnChainDeals().catch(() => []),
      fetchPlatformStats().catch(() => null),
    ]).then(([chainDeals, stats]) => {
      setDeals(chainDeals);
      setPlatform(stats);
    }).finally(() => setLoading(false));
  }, []);

  /* filtered list */
  const shown = useMemo(() => {
    if (filter === "all") return deals;
    const tab = FILTERS.find(f => f.id === filter);
    return tab ? deals.filter(d => d.status === tab.status) : deals;
  }, [deals, filter]);

  const hasDeals = deals.length > 0;

  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>

      {/* ── keyframe styles ── */}
      <style>{`
        @keyframes nodeBreath {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:0.55;transform:scale(0.85)}
        }
        @keyframes dashFlow {
          from{stroke-dashoffset:0}
          to{stroke-dashoffset:-100}
        }
      `}</style>

      {/* ═══════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40"
        style={{
          background: "linear-gradient(180deg,rgba(230,235,233,0.97) 0%,rgba(221,227,224,0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.80), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo.png" alt="Shadow OTC"
              className="flex-shrink-0 rounded-lg object-cover"
              style={{ width: 30, height: 30, boxShadow: "0 0 0 1px rgba(11,107,75,0.30),0 2px 8px rgba(0,0,0,0.18)" }}
            />
            <span className="text-[14px] font-bold tracking-tight" style={{ color: T.text }}>
              Shadow<span style={{ color: T.emMid }}>OTC</span>
            </span>
            <span className="hidden sm:inline rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", color: T.em }}>
              Ritual Testnet
            </span>
            <span className="sm:hidden rounded-md px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", color: T.em }}>
              Testnet
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 ml-6">
            {[
              { label: "Market",    fn: onMarket },
              { label: "My Deals",  fn: onDashboard },
              { label: "OTC Rooms", fn: onStartOTCRoom },
            ].map(item => (
              <button key={item.label} onClick={item.fn}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors"
                style={{ color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.background = "transparent"; }}>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right — order: Create Deal → Wallet → Hamburger */}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onCreateListing}
              className="rounded-xl px-3 py-1.5 sm:px-4 text-[12px] sm:text-[13px] font-semibold text-white transition-all active:scale-[0.98] flex items-center gap-1.5"
              style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.15)" }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden xs:inline sm:inline">Post Intent</span>
              <span className="sm:hidden">Intent</span>
            </button>

            {wallet ? (
              <div className="relative" ref={walletMenuRef}>
                <button
                  onClick={() => setWalletMenu(v => !v)}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-all"
                  style={{
                    background: walletMenu ? T.emBg : "#f7f8fa",
                    border: `1px solid ${walletMenu ? T.borderS : T.border}`,
                    color: "#2d3340",
                  }}>
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ background: T.emBr }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }} />
                  </span>
                  <span className="hidden sm:inline">{wallet.slice(0,6)}...{wallet.slice(-4)}</span>
                  <span className="sm:hidden text-[11px] font-semibold" style={{ color: T.em }}>Connected</span>
                  <svg className="h-3 w-3 ml-0.5 hidden sm:block transition-transform"
                    style={{ transform: walletMenu ? "rotate(180deg)" : "rotate(0)" }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {walletMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl overflow-hidden"
                    style={{
                      background: "#fff",
                      border: `1px solid ${T.border}`,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                      zIndex: 100,
                    }}>
                    {/* Identity header */}
                    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}`, background: T.panel }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                            style={{ background: T.emBr }} />
                          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }} />
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.em }}>
                          Connected
                        </span>
                      </div>
                      <p className="text-[12px] font-mono font-semibold" style={{ color: T.text }}>
                        {wallet.slice(0, 8)}…{wallet.slice(-6)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: T.textDim }}>
                        Ritual Testnet · Chain 1979
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                      {[
                        {
                          label: addrCopied ? "Copied!" : "Copy Address",
                          icon: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
                          color: addrCopied ? T.em : T.textSub,
                          fn: () => {
                            navigator.clipboard.writeText(wallet).catch(() => {});
                            setAddrCopied(true);
                            setTimeout(() => setAddrCopied(false), 2000);
                          },
                        },
                        {
                          label: "View on Explorer",
                          icon: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
                          color: T.textSub,
                          href: `https://explorer.ritualfoundation.org/address/${wallet}`,
                        },
                        {
                          label: "My Deals",
                          icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                          color: T.textSub,
                          fn: () => { onDashboard?.(); setWalletMenu(false); },
                        },
                        {
                          label: "Disconnect",
                          icon: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
                          color: "#dc2626",
                          hoverBg: "#fff1f2",
                          fn: () => { onDisconnect?.(); setWalletMenu(false); },
                        },
                      ].map(item => {
                        const El = item.href ? "a" : "button";
                        const extra = item.href
                          ? { href: item.href, target: "_blank", rel: "noreferrer" }
                          : { type: "button", onClick: item.fn };
                        return (
                          <El key={item.label} {...extra}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-left transition-colors"
                            style={{ color: item.color, textDecoration: "none" }}
                            onMouseEnter={e => e.currentTarget.style.background = item.hoverBg ?? T.panel}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                              stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                            </svg>
                            {item.label}
                          </El>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={onConnect}
                className="hidden sm:block rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{ background: "#f7f8fa", border: `1px solid ${T.border}`, color: "#2d3340" }}>
                Connect Wallet
              </button>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileNav(v => !v)}
              className="md:hidden flex flex-col items-center justify-center h-11 w-11 rounded-xl transition-all flex-shrink-0"
              style={{
                background: mobileNav ? "rgba(11,107,75,0.10)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${T.border}`,
              }}>
              {mobileNav ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  style={{ color: T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  style={{ color: T.textSub }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNav && (
          <div className="md:hidden"
            style={{ borderTop: `1px solid ${T.border}`, background: "rgba(230,235,233,0.98)", backdropFilter: "blur(20px)" }}>
            <div className="px-4 pt-4 pb-3 flex flex-col gap-1">

              {/* ── Profile card ── */}
              {(() => {
                const h1 = Math.floor((wallet ? parseInt(wallet.slice(2, 4), 16) : 160) * 1.41) % 360;
                const h2 = (h1 + 120) % 360;
                const avatarBg = `linear-gradient(135deg,hsl(${h1},65%,44%),hsl(${h2},60%,35%))`;
                return (
                  <div className="mb-3 rounded-2xl p-3.5 flex items-center gap-3"
                    style={{ background: "rgba(11,107,75,0.07)", border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                      style={{
                        width: 46, height: 46,
                        background: wallet ? avatarBg : `linear-gradient(135deg,#0B6B4B,#084C38)`,
                        border: "2.5px solid rgba(255,255,255,0.45)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                        fontSize: 18,
                      }}>
                      {wallet ? wallet.slice(2, 3).toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: T.text }}>
                        {wallet ? `${wallet.slice(0,6)}...${wallet.slice(-4)}` : "Not connected"}
                      </p>
                      <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: T.textDim }}>
                        {wallet ? "Ritual Testnet · Chain 1979" : "Connect wallet to start"}
                      </p>
                    </div>
                    {wallet ? (
                      <button onClick={() => { onDashboard?.(); setMobileNav(false); }}
                        className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-[0.96]"
                        style={{ background: T.em, color: "#fff", boxShadow: "0 2px 8px rgba(11,107,75,0.22)" }}>
                        Profile →
                      </button>
                    ) : (
                      <button onClick={() => { onConnect?.(); setMobileNav(false); }}
                        className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-all"
                        style={{ background: T.em, color: "#fff" }}>
                        Connect
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* ── Nav items ── */}
              {[
                { label: "Market",         fn: () => { onMarket?.();       setMobileNav(false); }, icon: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" },
                { label: "My Deals",       fn: () => { onDashboard?.();    setMobileNav(false); }, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { label: "OTC Rooms",      fn: () => { onStartOTCRoom?.(); setMobileNav(false); }, icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
                ...(!wallet ? [{ label: "Connect Wallet", fn: () => { onConnect?.(); setMobileNav(false); }, icon: "M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9" }] : []),
              ].map(item => (
                <button key={item.label} onClick={item.fn}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-left transition-all w-full"
                  style={{ color: T.text }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                      style={{ color: T.em }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-14 sm:pb-10">
        {/* Background network nodes */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <svg className="w-full h-full" viewBox="0 0 1400 240" preserveAspectRatio="xMidYMid slice" fill="none">
            <line x1="265" y1="70" x2="540" y2="100" stroke="rgba(11,107,75,0.08)" strokeWidth="0.8" strokeDasharray="5 9"
              style={{ animation: "dashFlow 3.2s linear infinite" }} />
            <line x1="540" y1="100" x2="700" y2="180" stroke="rgba(11,107,75,0.06)" strokeWidth="0.7" strokeDasharray="5 9"
              style={{ animation: "dashFlow 4.1s linear infinite" }} />
            <line x1="700" y1="180" x2="860" y2="80"  stroke="rgba(11,107,75,0.06)" strokeWidth="0.7" strokeDasharray="5 9"
              style={{ animation: "dashFlow 3.7s linear infinite" }} />
            <line x1="860" y1="80"  x2="1110" y2="160" stroke="rgba(11,107,75,0.08)" strokeWidth="0.8" strokeDasharray="5 9"
              style={{ animation: "dashFlow 2.9s linear infinite" }} />
            <circle cx="265" cy="70"  r="4"   fill="rgba(11,107,75,0.10)" stroke="rgba(11,107,75,0.28)" strokeWidth="1"
              style={{ animation: "nodeBreath 3.6s ease-in-out infinite" }} />
            <circle cx="540" cy="100" r="2.5" fill="rgba(11,107,75,0.07)" stroke="rgba(11,107,75,0.18)" strokeWidth="0.8"
              style={{ animation: "nodeBreath 5.1s ease-in-out infinite 1s" }} />
            <circle cx="700" cy="180" r="2"   fill="rgba(11,107,75,0.05)" stroke="rgba(11,107,75,0.14)" strokeWidth="0.7"
              style={{ animation: "nodeBreath 4.5s ease-in-out infinite 2s" }} />
            <circle cx="860" cy="80"  r="2.5" fill="rgba(11,107,75,0.07)" stroke="rgba(11,107,75,0.18)" strokeWidth="0.8"
              style={{ animation: "nodeBreath 5.7s ease-in-out infinite 0.7s" }} />
            <circle cx="1110" cy="160" r="4"  fill="rgba(11,107,75,0.10)" stroke="rgba(11,107,75,0.28)" strokeWidth="1"
              style={{ animation: "nodeBreath 3.6s ease-in-out infinite 0.3s" }} />
          </svg>
        </div>

        {/* Radial glow */}
        <div className="pointer-events-none absolute" aria-hidden="true"
          style={{
            width: "700px", height: "280px",
            top: "50%", left: "50%",
            transform: "translate(-50%,-40%)",
            background: "radial-gradient(ellipse 55% 55% at 50% 50%,rgba(11,107,75,0.08) 0%,transparent 70%)",
          }} />

        <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
          {/* Chain tag */}
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-2 rounded-lg px-3.5 py-1.5"
              style={{ background: "rgba(255,255,255,0.70)", border: `1px solid ${T.border}`,
                       boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.emBr }} />
              <span className="text-[10px] font-medium tracking-[0.16em] uppercase" style={{ color: T.textSub }}>
                Live on Ritual Testnet — Chain ID 1979
              </span>
            </div>
          </div>

          <h1 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-[1.15] mb-4"
            style={{ color: T.text, letterSpacing: "-0.02em" }}>
            Autonomous OTC on<br />
            <span style={{ color: T.em }}>Ritual Chain</span>
          </h1>

          <p className="text-[13px] sm:text-[14px] leading-relaxed max-w-lg mx-auto mb-7" style={{ color: T.textSub }}>
            Post what you want, lock funds in escrow. A seller responds, delivers proof, and an AI agent releases payment automatically. No middleman, no trust required.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto px-2 sm:px-0">
            <button onClick={onCreateListing}
              className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: T.em, boxShadow: "0 4px 14px rgba(11,107,75,0.20)" }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Post Intent
            </button>
            <button onClick={onDashboard}
              className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium transition-all"
              style={{ background: "rgba(255,255,255,0.75)", border: `1px solid ${T.border}`, color: T.text }}>
              My Deals
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 pb-20">

        {/* Welcome banner */}
        {!welcomeDismissed && (
          <div className="mb-6 rounded-2xl px-5 py-4 relative"
            style={{ background: T.emBg, border: `1px solid rgba(11,107,75,0.28)`, boxShadow: T.shadow }}>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "#fff", border: `1px solid rgba(11,107,75,0.18)` }}>🤝</div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold mb-1" style={{ color: T.emMid }}>
                  New here? Welcome to Shadow OTC
                </p>
                <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.textSub }}>
                  This runs on <strong>Ritual Testnet</strong> (Chain ID 1979). You need MetaMask + testnet RITUAL tokens to post deals.{" "}
                  <a href="https://faucet.ritualfoundation.org" target="_blank" rel="noopener noreferrer"
                    style={{ color: T.em, fontWeight: 600, textDecoration: "none" }}>Get free testnet RITUAL →</a>
                </p>
                <div className="flex flex-wrap gap-2">
                  {["1 · Connect MetaMask", "2 · Get testnet RITUAL", "3 · Post an intent", "4 · AI settles it"].map(s => (
                    <span key={s} className="text-[11px] font-medium rounded-lg px-2.5 py-1.5"
                      style={{ background: "#fff", border: `1px solid rgba(11,107,75,0.16)`, color: T.textSub }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => { setWelcomeDismissed(true); localStorage.setItem("shadowotc_welcome_v1","1"); }}
                className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(11,107,75,0.10)", color: T.em }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <StatsBar deals={deals} platformStats={platformStats} />

        {/* How it works */}
        <HowItWorks />

        {/* Agent activity feed */}
        <AgentFeed />

        {/* ── Deal list ───────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.emBr }} />
            <span className="text-[11px] font-mono" style={{ color: T.textDim }}>
              Ritual Testnet · Chain 1979 · ShadowOTCV3
            </span>
          </div>
          <a href="https://explorer.ritualfoundation.org/address/0x644417E2fC010E03E129a35761FF603e69Cc52aC"
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-medium flex items-center gap-1"
            style={{ color: T.em, textDecoration: "none" }}>
            View contract
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

          {/* Table header + filters */}
          <div className="flex flex-col gap-3 px-4 sm:px-5 py-4"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.panel }}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: T.textSub }}>
                Live Intent Board
              </span>
              {!loading && hasDeals && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.emBr }} />
                  <span className="text-[11px] font-semibold" style={{ color: T.em }}>
                    {shown.length} listed
                  </span>
                </div>
              )}
            </div>

            {/* Filter pills — horizontal scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              {FILTERS.map(f => (
                <button key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  style={filter === f.id
                    ? { background: T.em, color: "#fff", boxShadow: "0 2px 8px rgba(11,107,75,0.18)" }
                    : { background: T.card, border: `1px solid ${T.borderS}`, color: T.textSub }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers (desktop) */}
          {!loading && hasDeals && (
            <div className="hidden sm:flex items-center gap-4 px-5 py-2.5"
              style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(0,0,0,0.02)" }}>
              <div className="w-9 flex-shrink-0" />
              <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Deal / Intent</span>
              <span className="hidden sm:block w-24 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Amount</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Status</span>
              <div className="w-4" />
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => <SkelRow key={i} />)}
            </>
          ) : shown.length === 0 ? (
            <EmptyState onCreateDeal={onCreateListing} />
          ) : (
            shown.map(deal => (
              <DealRow
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick?.(deal)}
              />
            ))
          )}
        </div>

        {/* Bottom OTC Room CTA */}
        <div className="mt-6 relative overflow-hidden rounded-2xl"
          style={{ background: "linear-gradient(135deg,#0d1a14 0%,#0a1510 60%,#091410 100%)",
                   border: "1px solid rgba(11,107,75,0.25)" }}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "radial-gradient(ellipse 100% 100% at 100% 0%,rgba(11,107,75,0.22) 0%,transparent 70%)" }} />
          <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: "rgba(74,222,128,0.70)" }}>Private OTC</p>
              <h3 className="text-[17px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.90)" }}>
                Already have a counterparty?
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>
                Create a private OTC Room, share an invite link, and settle on-chain without public listings.
              </p>
            </div>
            <button onClick={onStartOTCRoom}
              className="flex-shrink-0 flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-[14px] font-semibold transition-all w-full sm:w-auto"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.28)", color: "#34d399" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.25)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.15)"}>
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Open OTC Room
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
