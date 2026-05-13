import { useMemo, useRef, useState } from "react";
import DealCard from "./DealCard";

/* ─── design tokens ──────────────────────────────────── */
const T = {
  /* backgrounds */
  card:    "#ffffff",
  panel:   "#F3F6F4",
  surface: "#E7ECE9",
  dark:    "#0F1412",
  darkDeep:"#0A0F0D",
  /* borders - emerald tinted */
  border:  "rgba(11,107,75,0.18)",
  borderS: "rgba(11,107,75,0.25)",
  borderW: "rgba(255,255,255,0.07)",
  /* text */
  text:    "#1B1F1D",
  textSub: "#51605A",
  textMid: "#51605A",
  textDim: "#7B8A84",
  /* text on dark */
  textDk:  "rgba(255,255,255,0.88)",
  textDkS: "rgba(255,255,255,0.50)",
  /* emerald */
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBr:    "#0D7A56",
  emBg:    "#EAF4EF",
  emBdr:   "rgba(11,107,75,0.30)",
  /* shadows */
  shadow:  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
  shadowEm:"0 0 0 1px rgba(11,107,75,0.30), 0 4px 12px rgba(11,107,75,0.12)",
};

/* ─── category tabs ──────────────────────────────────── */
const CATS = [
  { id: "all",       label: "All" },
  { id: "premarket", label: "Pre-Market" },
  { id: "airdrop",   label: "Airdrops" },
  { id: "nft",       label: "NFT" },
];

/* ─── live stats ─────────────────────────────────────── */
const STATS = [
  { label: "TOTAL_VOLUME",    value: "0 RITUAL", live: false },
  { label: "ACTIVE_LISTINGS", value: "0",         live: true  },
  { label: "AGENT_UPTIME",    value: "99.9%",     live: true  },
  { label: "SETTLEMENTS",     value: "0",         live: false },
  { label: "CHAIN_ID",        value: "1979",      live: true  },
];

/* ─── helpers ────────────────────────────────────────── */
function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60)    return `${Math.floor(d)}s ago`;
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}
function copyText(text, cb) { navigator.clipboard.writeText(text).then(() => cb && cb()); }
function shareX(text) { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank","width=600,height=500"); }

/* ─── skeleton row ───────────────────────────────────── */
function SkelRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 animate-pulse"
      style={{ borderBottom: "1px solid rgba(11,107,75,0.18)" }}>
      <div className="h-2 w-2 rounded-full" style={{ background: "#d1d5db" }} />
      <div className="h-3 w-48 rounded" style={{ background: "#e5e7eb" }} />
      <div className="flex-1" />
      <div className="h-3 w-20 rounded" style={{ background: "#e5e7eb" }} />
      <div className="h-3 w-16 rounded" style={{ background: "#e5e7eb" }} />
      <div className="h-5 w-14 rounded" style={{ background: "#e5e7eb" }} />
    </div>
  );
}

/* ─── market table row ───────────────────────────────── */
function MarketRow({ deal, onView, onCopyLink, onShareX, isCopied }) {
  const CAT_DOT = { premarket:"#a78bfa", airdrop:"#60a5fa", nft:"#818cf8", bundle:"#6b7280" };
  const TRUST = {
    verified:    { text: "#064e3b",      bg: "#ecfdf5",   border: "#6ee7b7" },
    "high-trust":{ text: "#111827", bg: "#111827", border: "#374151" },
    new:         { text: "#6b7280", bg: T.panel,  border: T.border },
  };
  const dot   = CAT_DOT[deal.category]    || CAT_DOT.bundle;
  const trust = TRUST[deal.sellerTrust]   || TRUST.new;
  const discount = deal.discount ?? (deal.marketPrice && deal.price
    ? Math.round(((deal.marketPrice - deal.price) / deal.marketPrice) * 100) : null);

  return (
    <div className="group flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-100"
      style={{ borderBottom: "1px solid rgba(11,107,75,0.18)" }}
      onClick={onView}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.05)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div className="flex-shrink-0 h-2 w-2 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{deal.asset}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono uppercase" style={{ color: T.textDim }}>
            {deal.category}
          </span>
          {deal.vesting && (
            <span className="text-[10px] font-mono" style={{ color: T.textDim }}>· {deal.vesting}</span>
          )}
        </div>
      </div>
      <div className="hidden sm:block w-28 text-right">
        <p className="text-[12px]" style={{ color: T.textMid }}>{deal.quantity || "-"}</p>
      </div>
      <div className="hidden md:block w-14 text-right">
        {discount > 0
          ? <span className="text-[11px] font-mono" style={{ color: "#dc2626" }}>-{discount}%</span>
          : <span className="text-[11px]" style={{ color: T.textDim }}>-</span>}
      </div>
      <div className="w-28 text-right flex-shrink-0">
        <p className="text-[13px] font-mono font-bold" style={{ color: T.em }}>
          {deal.price} <span className="text-[10px] font-normal" style={{ color: T.textDim }}>RITUAL</span>
        </p>
      </div>
      <div className="hidden lg:flex w-20 justify-end flex-shrink-0">
        <span className="text-[9px] font-mono px-2 py-0.5 rounded"
          style={{ background: trust.bg, border: `1px solid ${trust.border}`, color: trust.text }}>
          {(deal.sellerTrust || "NEW").toUpperCase().replace("-","_")}
        </span>
      </div>
      <div className="flex-shrink-0">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={deal.side === "sell"
            ? { background: "#ecfdf5", border: `1px solid ${"#6ee7b7"}`, color: T.em }
            : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
          {deal.side === "sell" ? "SELL" : "BUY"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onCopyLink(e); }}
          className="h-6 w-6 flex items-center justify-center rounded transition-all"
          style={{ background: isCopied ? "#ecfdf5" : "transparent", border: `1px solid ${isCopied ? "#6ee7b7" : T.border}` }}>
          {isCopied
            ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.em }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: T.textDim }}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
        </button>
        <button onClick={e => { e.stopPropagation(); onShareX(e); }}
          className="h-6 w-6 flex items-center justify-center rounded"
          style={{ border: "1px solid rgba(11,107,75,0.18)" }}>
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill={"#6b7280"}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── empty market state ─────────────────────────────── */
function EmptyMarket({ onCreate, onJoin, onStartRoom }) {
  return (
    <div className="text-center" style={{ background: "rgba(0,0,0,0.015)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)" }}>

      {/* ── EKG heartbeat — Shadow OTC signature visual ── */}
      <div className="relative px-6 pt-10 pb-0">
        <div className="relative mx-auto" style={{ maxWidth: 560, height: 80 }}>
          {/* Grid lines */}
          <svg viewBox="0 0 560 80" className="absolute inset-0 w-full h-full" fill="none">
            {[80, 160, 240, 320, 400, 480].map(x => (
              <line key={x} x1={x} y1="10" x2={x} y2="70"
                stroke="rgba(11,107,75,0.07)" strokeWidth="0.6" strokeDasharray="2 4"/>
            ))}
            <line x1="0" y1="40" x2="560" y2="40"
              stroke="rgba(11,107,75,0.08)" strokeWidth="0.7"/>
          </svg>
          {/* Animated EKG path */}
          <svg viewBox="0 0 560 80" className="absolute inset-0 w-full h-full" fill="none">
            <path
              d="M 0 40 L 140 40 L 165 40 L 183 14 L 200 66 L 218 24 L 236 52 L 254 40 L 560 40"
              stroke="rgba(11,107,75,0.45)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="900"
              strokeDashoffset="900"
              style={{ animation: "hbDraw 4s ease-out infinite" }}
            />
            {/* Glow duplicate for depth */}
            <path
              d="M 0 40 L 140 40 L 165 40 L 183 14 L 200 66 L 218 24 L 236 52 L 254 40 L 560 40"
              stroke="rgba(11,107,75,0.15)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="900"
              strokeDashoffset="900"
              style={{ animation: "hbDraw 4s ease-out infinite" }}
            />
          </svg>
        </div>
        {/* Chain status label */}
        <div className="flex items-center gap-2 justify-center mt-2 mb-1">
          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ background: T.emBr, animation: "nodeBreath 2.4s ease-in-out infinite" }}/>
          <p className="text-[9px] font-mono uppercase tracking-[0.22em]" style={{ color: "rgba(11,107,75,0.55)" }}>
            CHAIN_ID_1979 // AWAITING_FIRST_LISTING
          </p>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="px-5 pt-5 pb-10">
        <p className="text-[13px] mb-6" style={{ color: "#51605A" }}>
          No active listings detected. Market activity initializes with verified counterparties.
        </p>
        <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
          <button onClick={onCreate}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: "#0B6B4B", boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Post First Listing
          </button>
          <button onClick={onJoin}
            className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(11,107,75,0.20)", color: "#2d3340", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            Request Early Access
          </button>
          <button onClick={onStartRoom}
            className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(11,107,75,0.20)", color: "#2d3340", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            Open OTC Room
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── recent settlements panel ───────────────────────── */
function RecentSettlements({ settlements = [] }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "#0F1412", border: "1px solid rgba(11,107,75,0.25)", boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}>
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid rgba(11,107,75,0.18)" }}>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>Recent Settlements</p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Completed deals verified on Ritual Chain</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
          style={{ background: "rgba(11,107,75,0.18)", border: "1px solid rgba(11,107,75,0.35)" }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#4ade80" }}>Live</span>
        </div>
      </div>
      {settlements.length === 0 ? (
        <div className="px-5 py-8 text-center">
          {[0,1,2].map(i => (
            <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-3 mb-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", opacity: 1 - i * 0.25 }}>
              <div className="h-7 w-7 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-2/5 rounded" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="h-2 w-1/5 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
              <div className="h-5 w-20 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
          ))}
          <p className="text-[13px] font-semibold mt-3" style={{ color: "rgba(255,255,255,0.60)" }}>No settlements yet</p>
          <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Completed deals appear here automatically. No data is fabricated.</p>
        </div>
      ) : settlements.slice(0,6).map((s,i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 transition-colors"
          style={{ borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(11,107,75,0.25)", border: "1px solid rgba(11,107,75,0.40)" }}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#4ade80" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold flex-1 truncate" style={{ color: "rgba(255,255,255,0.88)" }}>{s.asset}</p>
          <p className="text-[12px] font-mono font-semibold" style={{ color: "#4ade80" }}>{s.amount} RITUAL</p>
          <p className="text-[11px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{timeAgo(s.completedAt || Date.now())}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── most requested panel ───────────────────────────── */
function MostRequested({ requests = [], onCreate }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1a14 0%, #0a1510 60%, #091410 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}>
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>Most Requested Assets</p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Real buy-side demand from the network</p>
        </div>
        <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}>
          {requests.length > 0 ? "Live" : "No data"}
        </span>
      </div>
      {requests.length === 0 ? (
        <div className="px-5 py-8 text-center">
          {[0,1,2].map(i => (
            <div key={i} className="flex items-center gap-5 rounded-xl px-4 py-3.5 mb-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", opacity: 1 - i * 0.22 }}>
              <div className="h-3 w-4 rounded" style={{ background: "rgba(255,255,255,0.12)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-2/5 rounded" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="h-2 w-1/5 rounded" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div className="h-6 w-16 rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
          ))}
          <p className="text-[13px] font-semibold mt-3" style={{ color: "rgba(255,255,255,0.60)" }}>No demand signals yet</p>
          <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Populates when traders post buy orders. No data is fabricated.</p>
        </div>
      ) : requests.map((r,i) => (
        <div key={i} className="group flex items-center gap-5 px-5 py-3.5 transition-colors"
          style={{ borderBottom: i < requests.length-1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span className="w-5 flex-shrink-0 text-[11px] font-mono font-bold" style={{ color: "rgba(255,255,255,0.30)" }}>
            {String(i+1).padStart(2,"0")}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.88)" }}>{r.asset}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>{r.category}</p>
          </div>
          <span className="text-[12px] font-mono font-bold" style={{ color: "#4ade80" }}>{r.count}</span>
          <button onClick={onCreate}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            style={{ background: "rgba(11,107,75,0.30)", border: "1px solid rgba(11,107,75,0.50)", color: "#4ade80" }}>
            Fill
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── main homepage ──────────────────────────────────── */
export default function Homepage({
  deals = [], settlements = [], requests = [],
  loading = false, wallet,
  onConnect, onDealClick, onCreateListing,
  onJoinEarlyAccess, onDashboard, onStartOTCRoom,
}) {
  const [query, setQuery]       = useState("");
  const [cat, setCat]           = useState("all");
  const [focused, setFocused]   = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const has = deals.length > 0;

  const shown = useMemo(() => deals.filter(d => {
    if (cat !== "all" && d.category !== cat) return false;
    if (query && !(d.asset||"").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [deals, query, cat]);

  function handleCopyLink(deal, e) {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#listing=${deal.id}`;
    copyText(url, () => { setCopiedId(deal.id); setTimeout(() => setCopiedId(null), 2200); });
  }
  function handleShareX(deal, e) {
    e.stopPropagation();
    shareX(`${deal.asset} - ${deal.price} RITUAL\nAI-verified OTC on Ritual Chain\nshadow-otc.vercel.app\n#ShadowOTC #RitualChain`);
  }
  function handleSearch(e) {
    e.preventDefault();
    const el = document.getElementById("listings-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen antialiased">

      {/* ── TOPBAR ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-13"
        style={{
          background: "linear-gradient(180deg, rgba(230,235,233,0.96) 0%, rgba(221,227,224,0.94) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(11,107,75,0.18)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-13 max-w-7xl items-center px-5 py-2.5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-8">
            {/* Shadow OTC logo */}
            <img
              src="/logo.png"
              alt="Shadow OTC"
              className="flex-shrink-0 rounded-lg object-cover"
              style={{ width: 32, height: 32, boxShadow: "0 0 0 1px rgba(11,107,75,0.30), 0 2px 8px rgba(0,0,0,0.20)" }}
            />
            <span className="text-[14px] font-bold tracking-tight" style={{ color: T.text }}>
              Shadow<span style={{ color: T.emMid }}>OTC</span>
            </span>
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "#ecfdf5", border: `1px solid ${"#6ee7b7"}`, color: T.em }}>
              Testnet
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {[
              { label: "Market",    fn: () => { const el = document.getElementById("listings-section"); if(el) el.scrollIntoView({behavior:"smooth"}); } },
              { label: "My Deals",  fn: onDashboard },
              { label: "OTC Rooms", fn: onStartOTCRoom },
            ].map(item => (
              <button key={item.label} onClick={item.fn}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors"
                style={{ color: T.textMid }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textMid; e.currentTarget.style.background = "transparent"; }}>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right - Connect Wallet (light) + Post Listing (dark emerald) */}
          <div className="ml-auto flex items-center gap-2.5">
            {wallet ? (
              <button onClick={onDashboard}
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all"
                style={{ background: "#f7f8fa", border: "1px solid rgba(11,107,75,0.18)", color: "#2d3340", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.emBr }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }} />
                </span>
                {wallet.slice(0,6)}...{wallet.slice(-4)}
              </button>
            ) : (
              <button onClick={onConnect}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
                style={{ background: "#f7f8fa", border: "1px solid rgba(11,107,75,0.18)", color: "#2d3340", boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)"; }}>
                Connect Wallet
              </button>
            )}
            <button onClick={onCreateListing}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{
                background: "#0B6B4B",
                boxShadow: "0 4px 12px rgba(11,107,75,0.15)",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(5,150,105,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(11,107,75,0.15)"; }}>
              + Post Listing
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative flex flex-col items-center pt-12 pb-10 overflow-hidden">

        {/* ── OTC network topology (signature visual) ── */}
        <div className="pointer-events-none absolute inset-0 w-full h-full select-none" aria-hidden="true">
          <svg className="w-full h-full" viewBox="0 0 1400 280" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* ── Bridge lines (animated dashes — data in transit) ── */}
            <line x1="265" y1="82" x2="540" y2="118" stroke="rgba(11,107,75,0.09)" strokeWidth="0.8" strokeDasharray="5 9" style={{animation:"dashFlow 3.2s linear infinite"}}/>
            <line x1="540" y1="118" x2="700" y2="210" stroke="rgba(11,107,75,0.07)" strokeWidth="0.7" strokeDasharray="5 9" style={{animation:"dashFlow 4.1s linear infinite"}}/>
            <line x1="700" y1="210" x2="860" y2="95"  stroke="rgba(11,107,75,0.07)" strokeWidth="0.7" strokeDasharray="5 9" style={{animation:"dashFlow 3.7s linear infinite"}}/>
            <line x1="860" y1="95"  x2="1110" y2="188" stroke="rgba(11,107,75,0.09)" strokeWidth="0.8" strokeDasharray="5 9" style={{animation:"dashFlow 2.9s linear infinite"}}/>

            {/* ── Left cluster: solid lines ── */}
            <line x1="60"  y1="100" x2="265" y2="82"  stroke="rgba(11,107,75,0.20)" strokeWidth="1"/>
            <line x1="150" y1="182" x2="265" y2="82"  stroke="rgba(11,107,75,0.14)" strokeWidth="0.8"/>
            <line x1="265" y1="82"  x2="340" y2="210" stroke="rgba(11,107,75,0.15)" strokeWidth="0.9"/>
            <line x1="150" y1="182" x2="195" y2="258" stroke="rgba(11,107,75,0.10)" strokeWidth="0.7"/>
            <line x1="340" y1="210" x2="195" y2="258" stroke="rgba(11,107,75,0.10)" strokeWidth="0.7"/>

            {/* ── Right cluster: solid lines ── */}
            <line x1="1110" y1="188" x2="1175" y2="78"  stroke="rgba(11,107,75,0.20)" strokeWidth="1"/>
            <line x1="1110" y1="188" x2="1255" y2="205" stroke="rgba(11,107,75,0.15)" strokeWidth="0.9"/>
            <line x1="1175" y1="78"  x2="1330" y2="105" stroke="rgba(11,107,75,0.14)" strokeWidth="0.8"/>
            <line x1="1255" y1="205" x2="1215" y2="268" stroke="rgba(11,107,75,0.10)" strokeWidth="0.7"/>
            <line x1="1330" y1="105" x2="1255" y2="205" stroke="rgba(11,107,75,0.10)" strokeWidth="0.7"/>

            {/* ── Left cluster: nodes ── */}
            <circle cx="60"  cy="100" r="3"   fill="rgba(11,107,75,0.12)" stroke="rgba(11,107,75,0.28)" strokeWidth="1"   style={{animation:"nodeBreath 4.2s ease-in-out infinite"}}/>
            <circle cx="150" cy="182" r="2"   fill="rgba(11,107,75,0.08)" stroke="rgba(11,107,75,0.20)" strokeWidth="0.8" style={{animation:"nodeBreath 5.1s ease-in-out infinite 1.1s"}}/>
            <circle cx="265" cy="82"  r="5.5" fill="rgba(11,107,75,0.14)" stroke="rgba(11,107,75,0.34)" strokeWidth="1"   style={{animation:"nodeBreath 3.6s ease-in-out infinite 0.4s"}}/>
            <circle cx="340" cy="210" r="2.5" fill="rgba(11,107,75,0.09)" stroke="rgba(11,107,75,0.22)" strokeWidth="0.8" style={{animation:"nodeBreath 4.8s ease-in-out infinite 2.0s"}}/>
            <circle cx="195" cy="258" r="2"   fill="rgba(11,107,75,0.07)" stroke="rgba(11,107,75,0.16)" strokeWidth="0.7" style={{animation:"nodeBreath 6.0s ease-in-out infinite 1.6s"}}/>

            {/* ── Bridge nodes (very faint) ── */}
            <circle cx="540" cy="118" r="1.5" fill="rgba(11,107,75,0.06)" stroke="rgba(11,107,75,0.14)" strokeWidth="0.6" style={{animation:"nodeBreath 5.3s ease-in-out infinite 0.7s"}}/>
            <circle cx="700" cy="210" r="1.5" fill="rgba(11,107,75,0.05)" stroke="rgba(11,107,75,0.11)" strokeWidth="0.6" style={{animation:"nodeBreath 4.1s ease-in-out infinite 2.4s"}}/>
            <circle cx="860" cy="95"  r="1.5" fill="rgba(11,107,75,0.06)" stroke="rgba(11,107,75,0.14)" strokeWidth="0.6" style={{animation:"nodeBreath 5.7s ease-in-out infinite 1.3s"}}/>

            {/* ── Right cluster: nodes ── */}
            <circle cx="1110" cy="188" r="5.5" fill="rgba(11,107,75,0.14)" stroke="rgba(11,107,75,0.34)" strokeWidth="1"   style={{animation:"nodeBreath 3.6s ease-in-out infinite 0.2s"}}/>
            <circle cx="1175" cy="78"  r="2.5" fill="rgba(11,107,75,0.09)" stroke="rgba(11,107,75,0.22)" strokeWidth="0.8" style={{animation:"nodeBreath 4.5s ease-in-out infinite 1.9s"}}/>
            <circle cx="1255" cy="205" r="2"   fill="rgba(11,107,75,0.08)" stroke="rgba(11,107,75,0.20)" strokeWidth="0.8" style={{animation:"nodeBreath 5.0s ease-in-out infinite 0.5s"}}/>
            <circle cx="1330" cy="105" r="3"   fill="rgba(11,107,75,0.12)" stroke="rgba(11,107,75,0.28)" strokeWidth="1"   style={{animation:"nodeBreath 4.0s ease-in-out infinite 2.3s"}}/>
            <circle cx="1215" cy="268" r="2"   fill="rgba(11,107,75,0.07)" stroke="rgba(11,107,75,0.16)" strokeWidth="0.7" style={{animation:"nodeBreath 6.2s ease-in-out infinite 1.0s"}}/>
          </svg>
        </div>

        {/* ── Radial glow behind headline ── */}
        <div className="pointer-events-none absolute" aria-hidden="true"
          style={{
            width: "700px", height: "320px",
            top: "50%", left: "50%",
            transform: "translate(-50%, -40%)",
            background: "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(11,107,75,0.10) 0%, transparent 70%)",
          }}/>

        <div className="relative z-10 w-full max-w-2xl px-5">
          {/* Status tag */}
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-2 rounded-lg px-3.5 py-1.5"
              style={{ background: "rgba(255,255,255,0.70)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.emBr }} />
              <span className="text-[10px] font-medium tracking-[0.16em] uppercase" style={{ color: T.textMid }}>
                Live on Ritual Testnet — Chain ID 1979
              </span>
            </div>
          </div>

          {/* Hero headline */}
          <div className="text-center mb-8 px-2">
            <h1 className="text-[34px] font-bold tracking-tight leading-[1.15] mb-3"
              style={{ color: T.text, letterSpacing: "-0.02em" }}>
              Institutional OTC<br />
              <span style={{ color: T.em }}>on Ritual Chain</span>
            </h1>
            <p className="text-[14px] leading-relaxed max-w-lg mx-auto" style={{ color: T.textSub }}>
              Discover, negotiate and settle pre-market allocations, airdrops and NFT deals — verified on-chain with autonomous AI agents.
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch}>
            <div className="relative rounded-2xl transition-all duration-200"
              style={{
                background: focused ? "#ffffff" : "rgba(255,255,255,0.80)",
                border: focused ? `1px solid ${"#047857"}` : "1px solid rgba(11,107,75,0.18)",
                boxShadow: focused
                  ? "0 0 0 1px rgba(11,107,75,0.30), 0 4px 12px rgba(11,107,75,0.12), inset 0 1px 2px rgba(0,0,0,0.04)"
                  : "inset 0 1px 2px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
              }}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  style={{ color: focused ? T.emMid : T.textMid }}>
                  <circle cx="11" cy="11" r="8" strokeWidth={1.5} /><path d="M21 21l-4.3-4.3" strokeWidth={1.5} />
                </svg>
                <div className="w-px h-4" style={{ background: T.border }} />
              </div>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                type="text"
                placeholder="Search assets, allocations, deal types..."
                className="w-full border-0 bg-transparent focus:outline-none focus:ring-0"
                style={{ color: "#0f1117", padding: "14px 120px 14px 52px", fontSize: "14px" }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {query && (
                  <button type="button" onClick={() => setQuery("")}
                    className="text-[10px] font-mono px-2 py-1 rounded"
                    style={{ color: "#6b7280", border: "1px solid rgba(11,107,75,0.18)" }}>
                    ESC
                  </button>
                )}
                <button type="submit"
                  className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all"
                  style={{ background: "#0B6B4B", boxShadow: "0 2px 8px rgba(5,150,105,0.30)" }}>
                  Search
                </button>
              </div>
            </div>
          </form>

          {/* Hints */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[10px]" style={{ color: T.textDim }}>Try:</span>
            {["Pre-Market","Airdrops","NFT Spots"].map(h => (
              <button key={h} onClick={() => setQuery(h)}
                className="text-[11px] font-medium rounded-lg px-2.5 py-1 transition-all"
                style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(11,107,75,0.15)", color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(11,107,75,0.30)"; e.currentTarget.style.color = T.em; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(11,107,75,0.15)"; e.currentTarget.style.color = T.textSub; }}>
                {h}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK STATS ROW ──────────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 mb-6">
        <div className="flex items-center rounded-xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(11,107,75,0.20)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.90), 0 4px 16px rgba(0,0,0,0.07), inset 0 2px 0 rgba(11,107,75,0.16)",
          }}>
          {STATS.map((s, i) => (
            <div key={s.label}
              className="flex-1 flex flex-col items-center py-4 px-4"
              style={{ borderRight: i < STATS.length-1 ? "1px solid rgba(11,107,75,0.14)" : "none" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] font-mono uppercase tracking-[0.14em]" style={{ color: "#7B8A84", fontWeight: 700 }}>
                  {s.label}
                </span>
                {s.live && (
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: T.emBr, animation: "nodeBreath 2.4s ease-in-out infinite" }}/>
                )}
              </div>
              <span className="text-[17px] font-mono font-bold tabular-nums"
                style={{ color: s.value === "99.9%" || s.value === "1979" ? T.em : T.text, letterSpacing: "-0.01em" }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-5 pb-20">

        {/* Market header */}
        <div id="listings-section" className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em]" style={{ color: T.textSub }}>
              {has ? `Market - ${shown.length} Listings` : "Market - Empty"}
            </span>
            {has && (
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.emBr }} />
                <span className="text-[10px] font-semibold" style={{ color: T.emMid }}>Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="rounded-lg px-3 py-1 text-[11px] font-medium transition-all"
                style={cat === c.id ? {
                  background: "#0B6B4B", color: "#fff", boxShadow: "0 4px 12px rgba(11,107,75,0.18)",
                } : {
                  background: "linear-gradient(180deg,#ffffff,#F6F8F7)", border: "1px solid rgba(11,107,75,0.22)", color: "#4a5568", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market table */}
        <div className="rounded-xl overflow-hidden mb-4"
          style={{ background: "linear-gradient(180deg, #ffffff 0%, #F6F8F7 100%)", border: "1px solid rgba(11,107,75,0.22)", boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(11,107,75,0.06)" }}>
          {/* Table header */}
          <div className="flex items-center gap-3 px-5 py-2.5"
            style={{ borderBottom: "1px solid rgba(11,107,75,0.22)", background: "rgba(0,0,0,0.03)" }}>
            <div className="w-3.5 flex-shrink-0" />
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Asset</span>
            <span className="hidden sm:block w-28 text-right text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Quantity</span>
            <span className="hidden md:block w-14 text-right text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Discount</span>
            <span className="w-28 text-right text-[9px] font-semibold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Price</span>
            <span className="hidden lg:block w-20 text-right text-[9px] font-semibold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Trust</span>
            <span className="w-10 text-right text-[9px] font-semibold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Side</span>
            <div className="w-14 flex-shrink-0" />
          </div>

          {/* Rows */}
          {loading ? (
            [...Array(4)].map((_, i) => <SkelRow key={i} />)
          ) : !has ? (
            <EmptyMarket onCreate={onCreateListing} onJoin={onJoinEarlyAccess} onStartRoom={onStartOTCRoom} />
          ) : shown.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px]" style={{ color: T.textMid }}>No results - try a different query</p>
            </div>
          ) : (
            shown.map(deal => (
              <MarketRow
                key={deal.id}
                deal={deal}
                onView={() => onDealClick?.(deal)}
                onCopyLink={e => handleCopyLink(deal, e)}
                onShareX={e => handleShareX(deal, e)}
                isCopied={copiedId === deal.id}
              />
            ))
          )}
        </div>

        {/* Bottom panels - settlements and most requested */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-4">
            <RecentSettlements settlements={settlements} />
            <MostRequested requests={requests} onCreate={onCreateListing} />
          </div>
        )}

        {/* OTC Room CTA - dark panel */}
        <div className="relative overflow-hidden rounded-xl mb-4"
          style={{ background: "linear-gradient(135deg, #0d1a14 0%, #0a1510 60%, #091410 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "radial-gradient(ellipse 100% 100% at 100% 0%, rgba(11,107,75,0.25) 0%, transparent 70%)" }} />
          <div className="relative flex flex-col gap-5 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                  style={{ color: T.emBr }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.emBr }}>OTC Rooms</p>
              </div>
              <h3 className="text-[17px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.90)" }}>
                Already have a counterparty?
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)" }}>
                Create a private OTC Room. Share an invite link, negotiate directly, and settle securely on-chain. Separate from public listings.
              </p>
            </div>
            <button onClick={onStartOTCRoom}
              className="flex-shrink-0 flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-semibold transition-all"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.28)", color: "#059669" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.22)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Open OTC Room
            </button>
          </div>
        </div>

        {/* Public Listing CTA - dark panel */}
        <div className="relative overflow-hidden rounded-xl"
          style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 70% at -5% 50%, rgba(11,107,75,0.18) 0%, rgba(11,107,75,0.06) 50%, transparent 75%)" }} />
          <div className="relative flex flex-col gap-5 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "rgba(16,185,129,0.60)" }}>
                Public Listing
              </p>
              <h3 className="text-[17px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.88)" }}>
                List publicly on the marketplace
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.40)" }}>
                Post a sell or buy order that any trader can discover, interact with, and settle on-chain.
              </p>
            </div>
            <button onClick={onCreateListing}
              className="flex-shrink-0 flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all"
              style={{ background: "#0B6B4B", boxShadow: "0 2px 14px rgba(5,150,105,0.35), inset 0 1px 0 rgba(255,255,255,0.12)" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Post a Listing
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
