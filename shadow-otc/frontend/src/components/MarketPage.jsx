import { useMemo, useState } from "react";

/* ─── design tokens (mirrored from Homepage) ─────────── */
const T = {
  card:    "#ffffff",
  panel:   "#F3F6F4",
  surface: "#E7ECE9",
  dark:    "#0F1412",
  border:  "rgba(11,107,75,0.18)",
  borderS: "rgba(11,107,75,0.25)",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textMid: "#51605A",
  textDim: "#7B8A84",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBr:    "#0D7A56",
  emBg:    "#EAF4EF",
  shadow:  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
};

const CAT_CONFIG = {
  premarket: { border: "#a78bfa", dot: "#a78bfa", bg: "rgba(167,139,250,0.10)", label: "Pre-Market" },
  airdrop:   { border: "#60a5fa", dot: "#60a5fa", bg: "rgba(96,165,250,0.10)",  label: "Airdrop"    },
  nft:       { border: "#f472b6", dot: "#f472b6", bg: "rgba(244,114,182,0.10)", label: "NFT"        },
  bundle:    { border: "#94a3b8", dot: "#94a3b8", bg: "rgba(148,163,184,0.10)", label: "Bundle"     },
};

const CATS = [
  { id: "all",       label: "All" },
  { id: "premarket", label: "Pre-Market" },
  { id: "airdrop",   label: "Airdrops" },
  { id: "nft",       label: "NFT" },
];

const SIDES = [
  { id: "all",  label: "All Sides" },
  { id: "sell", label: "Sellers"   },
  { id: "buy",  label: "Buyers"    },
];

function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60)    return `${Math.floor(d)}s ago`;
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}
function copyText(text, cb) { navigator.clipboard.writeText(text).then(() => cb && cb()); }
function shareX(text) { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=600,height=500"); }

/* ─── skeleton row ───────────────────────────────────── */
function SkelRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 animate-pulse"
      style={{ borderBottom: "1px solid rgba(11,107,75,0.14)" }}>
      <div className="h-8 w-8 rounded-lg" style={{ background: "#e5e7eb" }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-40 rounded" style={{ background: "#e5e7eb" }} />
        <div className="h-2 w-24 rounded" style={{ background: "#f3f4f6" }} />
      </div>
      <div className="h-3 w-20 rounded hidden sm:block" style={{ background: "#e5e7eb" }} />
      <div className="h-3 w-16 rounded hidden md:block" style={{ background: "#e5e7eb" }} />
      <div className="h-6 w-16 rounded-lg" style={{ background: "#e5e7eb" }} />
    </div>
  );
}

/* ─── market row ─────────────────────────────────────── */
function MarketRow({ deal, onView, onCopyLink, onShareX, isCopied }) {
  const cat   = CAT_CONFIG[deal.category] || CAT_CONFIG.bundle;
  const TRUST = {
    verified:    { text: "#064e3b", bg: "#ecfdf5",  border: "#6ee7b7" },
    "high-trust":{ text: "#e2e8f0", bg: "#1e293b",  border: "#334155" },
    new:         { text: "#6b7280", bg: T.panel,    border: T.border  },
  };
  const trust = TRUST[deal.sellerTrust] || TRUST.new;
  const discount = deal.discount ?? (deal.marketPrice && deal.price
    ? Math.round(((deal.marketPrice - deal.price) / deal.marketPrice) * 100) : null);

  return (
    <div className="group relative flex items-center gap-4 pr-5 py-3.5 cursor-pointer transition-colors duration-100"
      style={{ borderBottom: "1px solid rgba(11,107,75,0.12)", paddingLeft: "20px" }}
      onClick={onView}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.04)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Category accent bar */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
        style={{ background: cat.border, opacity: 0.80 }} />

      {/* Asset icon placeholder */}
      <div className="flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center font-bold text-[13px]"
        style={{ background: cat.bg, color: cat.dot, border: `1px solid ${cat.dot}30` }}>
        {(deal.asset || "?").charAt(0).toUpperCase()}
      </div>

      {/* Asset info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-bold" style={{ color: T.text }}>{deal.asset}</p>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: cat.bg, color: cat.dot, border: `1px solid ${cat.dot}22` }}>
            {cat.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {deal.vesting && (
            <span className="text-[11px] font-mono" style={{ color: T.textDim }}>
              🔒 {deal.vesting}
            </span>
          )}
          {deal.createdAt && (
            <span className="text-[10px]" style={{ color: T.textDim }}>
              {timeAgo(deal.createdAt)}
            </span>
          )}
          <span className="text-[10px] font-mono" style={{ color: T.textDim }}>
            {deal.network || "Ritual Testnet"}
          </span>
        </div>
      </div>

      {/* Quantity */}
      <div className="hidden sm:block w-28 text-right flex-shrink-0">
        <p className="text-[12px] font-mono font-medium" style={{ color: T.textMid }}>{deal.quantity || "—"}</p>
        <p className="text-[9px] mt-0.5" style={{ color: T.textDim }}>qty</p>
      </div>

      {/* Discount */}
      <div className="hidden md:block w-24 text-right flex-shrink-0">
        {discount > 0 ? (
          <div>
            <span className="text-[13px] font-mono font-bold" style={{ color: "#dc2626" }}>-{discount}%</span>
            <p className="text-[9px] mt-0.5" style={{ color: T.textDim }}>below market</p>
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: T.textDim }}>—</span>
        )}
      </div>

      {/* Price */}
      <div className="w-32 text-right flex-shrink-0">
        <p className="text-[15px] font-mono font-bold" style={{ color: T.em }}>{deal.price}</p>
        <p className="text-[9px] font-mono mt-0.5" style={{ color: T.textDim }}>RITUAL</p>
      </div>

      {/* Trust */}
      <div className="hidden lg:flex w-24 justify-end flex-shrink-0">
        <span className="text-[9px] font-mono px-2 py-0.5 rounded"
          style={{ background: trust.bg, border: `1px solid ${trust.border}`, color: trust.text }}>
          {(deal.sellerTrust || "NEW").toUpperCase().replace("-","_")}
        </span>
      </div>

      {/* Side */}
      <div className="flex-shrink-0">
        <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg"
          style={deal.side === "sell"
            ? { background: "#ecfdf5", border: "1px solid #6ee7b7", color: T.em }
            : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
          {deal.side === "sell" ? "SELL" : "BUY"}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onCopyLink(e); }}
          className="h-7 w-7 flex items-center justify-center rounded-lg transition-all"
          style={{ background: isCopied ? "#ecfdf5" : "rgba(255,255,255,0.7)", border: `1px solid ${isCopied ? "#6ee7b7" : T.border}` }}>
          {isCopied
            ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.em }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: T.textDim }}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>}
        </button>
        <button onClick={e => { e.stopPropagation(); onShareX(e); }}
          className="h-7 w-7 flex items-center justify-center rounded-lg"
          style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,107,75,0.18)" }}>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#6b7280">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────── */
function EmptyState({ onCreateListing }) {
  return (
    <div className="py-20 flex flex-col items-center text-center px-6">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: T.emBg, border: `1px solid rgba(11,107,75,0.20)` }}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: T.em }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>
        </svg>
      </div>
      <p className="text-[15px] font-semibold mb-2" style={{ color: T.text }}>No listings match your filter</p>
      <p className="text-[13px] mb-6 max-w-xs" style={{ color: T.textSub }}>
        Try clearing your search or switching to a different category.
      </p>
      <button onClick={onCreateListing}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
        style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Post First Listing
      </button>
    </div>
  );
}

/* ─── discount info banner ───────────────────────────── */
function DiscountInfoBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden mb-4"
      style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(11,107,75,0.16)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(11,107,75,0.10)", border: "1px solid rgba(11,107,75,0.20)" }}>
            <span className="text-[11px] font-bold" style={{ color: T.em }}>?</span>
          </div>
          <span className="text-[12px] font-semibold" style={{ color: T.textMid }}>
            What does the Discount column mean?
          </span>
        </div>
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.textDim }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📉", title: "% Below Market", body: "The discount is how much cheaper the listing price is compared to the public market price of that asset. A -20% discount means the seller is offering 20% below the going rate." },
              { icon: "🔍", title: "Why It Matters", body: "OTC deals move faster than CEX/DEX listings, but quality varies. A high discount can mean a motivated seller — or an asset with strings attached like a vesting cliff." },
              { icon: "⚠️", title: "Always Verify", body: "Discounts are seller-declared. Cross-check the market price independently before executing any trade. Shadow OTC does not verify pricing data." },
            ].map(item => (
              <div key={item.title} className="rounded-xl p-4"
                style={{ background: "rgba(11,107,75,0.04)", border: "1px solid rgba(11,107,75,0.12)" }}>
                <p className="text-[18px] mb-2">{item.icon}</p>
                <p className="text-[12px] font-semibold mb-1" style={{ color: T.text }}>{item.title}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── main market page ───────────────────────────────── */
export default function MarketPage({
  deals = [], loading = false, wallet,
  onConnect, onBack, onDealClick, onCreateListing,
  onDashboard, onStartOTCRoom,
}) {
  const [query, setQuery]       = useState("");
  const [cat, setCat]           = useState("all");
  const [side, setSide]         = useState("all");
  const [focused, setFocused]   = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const shown = useMemo(() => deals.filter(d => {
    if (cat  !== "all" && d.category !== cat)  return false;
    if (side !== "all" && d.side     !== side) return false;
    if (query && !(d.asset || "").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [deals, query, cat, side]);

  function handleCopyLink(deal, e) {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#listing=${deal.id}`;
    copyText(url, () => { setCopiedId(deal.id); setTimeout(() => setCopiedId(null), 2200); });
  }
  function handleShareX(deal, e) {
    e.stopPropagation();
    shareX(`${deal.asset} - ${deal.price} RITUAL\nAI-verified OTC on Ritual Chain\nshadow-otc.vercel.app\n#ShadowOTC #RitualChain`);
  }

  const sellCount = deals.filter(d => d.side === "sell").length;
  const buyCount  = deals.filter(d => d.side === "buy").length;

  return (
    <div className="min-h-screen antialiased">

      {/* ── NAV ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40"
        style={{
          background: "linear-gradient(180deg, rgba(230,235,233,0.96) 0%, rgba(221,227,224,0.94) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(11,107,75,0.18)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-13 max-w-7xl items-center px-5 py-2.5">
          {/* Back + Logo */}
          <div className="flex items-center gap-3 mr-8">
            <button onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors"
              style={{ color: T.textMid, border: "1px solid rgba(11,107,75,0.14)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <img src="/logo.png" alt="Shadow OTC" className="rounded-lg object-cover flex-shrink-0"
              style={{ width: 28, height: 28, boxShadow: "0 0 0 1px rgba(11,107,75,0.30), 0 2px 6px rgba(0,0,0,0.15)" }}/>
            <span className="text-[14px] font-bold tracking-tight" style={{ color: T.text }}>
              Shadow<span style={{ color: T.emMid }}>OTC</span>
            </span>
          </div>

          {/* Page title */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: T.text }}>Market</span>
            <span className="text-[12px] font-mono rounded px-1.5 py-0.5"
              style={{ background: "rgba(11,107,75,0.10)", color: T.em, border: "1px solid rgba(11,107,75,0.18)" }}>
              {loading ? "…" : deals.length} listings
            </span>
          </div>

          {/* Right */}
          <div className="ml-auto flex items-center gap-2.5">
            {wallet ? (
              <button onClick={onDashboard}
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all"
                style={{ background: "#f7f8fa", border: "1px solid rgba(11,107,75,0.18)", color: "#2d3340" }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.emBr }}/>
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }}/>
                </span>
                {wallet.slice(0,6)}...{wallet.slice(-4)}
              </button>
            ) : (
              <button onClick={onConnect}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
                style={{ background: "#f7f8fa", border: "1px solid rgba(11,107,75,0.18)", color: "#2d3340" }}>
                Connect Wallet
              </button>
            )}
            <button onClick={onCreateListing}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.15)" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}>
              + Post Listing
            </button>
          </div>
        </div>
      </header>

      {/* ── PAGE BODY ──────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-5 pt-8 pb-20">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight mb-1" style={{ color: T.text, letterSpacing: "-0.02em" }}>
            OTC Market
          </h1>
          <p className="text-[13px]" style={{ color: T.textSub }}>
            Live pre-market allocations, airdrops and NFT deals — verified on Ritual Chain.
          </p>
        </div>

        {/* Summary strip */}
        {!loading && deals.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap mb-5">
            {[
              { label: "Total Listings", value: deals.length, color: T.em },
              { label: "Sellers", value: sellCount, color: "#0B6B4B" },
              { label: "Buyers", value: buyCount, color: "#1d4ed8" },
              { label: "Showing", value: shown.length, color: T.textMid },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(11,107,75,0.14)" }}>
                <span className="text-[13px] font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[11px]" style={{ color: T.textDim }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Discount info accordion */}
        <DiscountInfoBanner />

        {/* Search + Filters row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 rounded-xl transition-all"
            style={{
              background: focused ? "#ffffff" : "rgba(255,255,255,0.80)",
              border: focused ? `1px solid #047857` : "1px solid rgba(11,107,75,0.18)",
              boxShadow: focused ? "0 0 0 1px rgba(11,107,75,0.25), 0 4px 12px rgba(11,107,75,0.08)" : "inset 0 1px 2px rgba(0,0,0,0.04)",
            }}>
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                style={{ color: focused ? T.em : T.textMid }}>
                <circle cx="11" cy="11" r="8" strokeWidth={1.5}/><path d="M21 21l-4.3-4.3" strokeWidth={1.5}/>
              </svg>
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search assets, deal types..."
              className="w-full border-0 bg-transparent focus:outline-none focus:ring-0"
              style={{ color: "#0f1117", padding: "11px 40px 11px 40px", fontSize: "13px" }}
            />
            {query && (
              <button onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ color: "#6b7280", border: "1px solid rgba(11,107,75,0.16)" }}>
                ✕
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="rounded-lg px-3 py-2 text-[12px] font-medium transition-all"
                style={cat === c.id
                  ? { background: T.em, color: "#fff", boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }
                  : { background: "linear-gradient(180deg,#ffffff,#F6F8F7)", border: "1px solid rgba(11,107,75,0.22)", color: "#4a5568" }}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Side filter */}
          <div className="flex items-center gap-1.5">
            {SIDES.map(s => (
              <button key={s.id} onClick={() => setSide(s.id)}
                className="rounded-lg px-3 py-2 text-[12px] font-medium transition-all"
                style={side === s.id
                  ? { background: s.id === "sell" ? "#ecfdf5" : s.id === "buy" ? "#eff6ff" : T.em,
                      color: s.id === "sell" ? T.em : s.id === "buy" ? "#1d4ed8" : "#fff",
                      border: s.id === "sell" ? "1px solid #6ee7b7" : s.id === "buy" ? "1px solid #bfdbfe" : "none" }
                  : { background: "linear-gradient(180deg,#ffffff,#F6F8F7)", border: "1px solid rgba(11,107,75,0.22)", color: "#4a5568" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market table */}
        <div className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #F6F8F7 100%)",
            border: "1px solid rgba(11,107,75,0.22)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
          }}>
          {/* Table header */}
          <div className="flex items-center gap-4 px-6 py-3"
            style={{ borderBottom: "1px solid rgba(11,107,75,0.18)", background: "rgba(0,0,0,0.025)" }}>
            <span className="flex-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Asset</span>
            <span className="hidden sm:block w-28 text-right text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Quantity</span>
            <span className="hidden md:block w-24 text-right text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textDim }}>Discount</span>
            <span className="w-32 text-right text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Price</span>
            <span className="hidden lg:block w-24 text-right text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Trust</span>
            <span className="w-16 text-right text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: T.textDim }}>Side</span>
            <div className="w-16 flex-shrink-0"/>
          </div>

          {/* Rows */}
          {loading ? (
            [...Array(6)].map((_,i) => <SkelRow key={i}/>)
          ) : shown.length === 0 ? (
            <EmptyState onCreateListing={onCreateListing}/>
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

        {/* Footer note */}
        {!loading && shown.length > 0 && (
          <p className="text-center text-[11px] mt-4" style={{ color: T.textDim }}>
            {shown.length} listing{shown.length !== 1 ? "s" : ""} — All deals are peer-to-peer and settled on Ritual Chain (Chain ID 1979).
            Shadow OTC does not hold custody.
          </p>
        )}
      </main>
    </div>
  );
}
