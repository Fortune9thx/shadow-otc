import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchOnChainDeals, fetchPlatformStats,
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
} from "../lib/contract";
import ReputationBadge from "./ReputationBadge";

/* ─── design tokens ──────────────────────────────────────── */
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

/* ─── status badge ────────────────────────────────────────── */
const STATUS_STYLE = {
  0: { bg: "#EAF4EF", color: "#0B6B4B", border: "rgba(11,107,75,0.28)",  label: "Open"             },
  1: { bg: "#EFF6FF", color: "#1d4ed8", border: "rgba(29,78,216,0.28)",  label: "Accepted"         },
  2: { bg: "#FFFBEB", color: "#b45309", border: "rgba(180,83,9,0.28)",   label: "Pending Delivery" },
  3: { bg: "#F5F3FF", color: "#7c3aed", border: "rgba(124,58,237,0.35)", label: "Verifying"        },
  4: { bg: "#ECFDF5", color: "#059669", border: "rgba(5,150,105,0.28)",  label: "Completed"        },
  5: { bg: "#FEF2F2", color: "#dc2626", border: "rgba(220,38,38,0.28)",  label: "Failed"           },
  6: { bg: "#FFF7ED", color: "#ea580c", border: "rgba(234,88,12,0.28)",  label: "Disputed"         },
  7: { bg: "#F3F4F6", color: "#6b7280", border: "rgba(107,114,128,0.28)",label: "Cancelled"        },
  8: { bg: "#F3F4F6", color: "#6b7280", border: "rgba(107,114,128,0.28)",label: "Expired"          },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE[7];
  const pulse = status === 3;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: s.color }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
        </span>
      )}
      {s.label}
    </span>
  );
}

/* ─── deadline helper ─────────────────────────────────────── */
function countdown(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return { text: "Expired", expired: true };
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return { text: `${h}h left`, expired: false };
  return { text: `${Math.floor(h / 24)}d left`, expired: false };
}

/* ─── skeleton ────────────────────────────────────────────── */
function SkelRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse"
      style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="h-9 w-9 rounded-xl flex-shrink-0" style={{ background: "#E5E7EB" }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-52 rounded" style={{ background: "#E5E7EB" }} />
        <div className="h-2.5 w-36 rounded" style={{ background: "#F3F4F6" }} />
      </div>
      <div className="h-3 w-24 rounded hidden sm:block" style={{ background: "#E5E7EB" }} />
      <div className="h-6 w-20 rounded-full" style={{ background: "#E5E7EB" }} />
      <div className="h-3 w-16 rounded hidden md:block" style={{ background: "#F3F4F6" }} />
    </div>
  );
}

/* ─── deal row ────────────────────────────────────────────── */
function DealRow({ deal, wallet, onClick }) {
  const icon  = CATEGORY_ICONS[deal.category] ?? "📦";
  const label = CATEGORY_LABELS[deal.category] ?? "Unknown";
  const cd    = countdown(deal.deadline);
  const w     = wallet?.toLowerCase();
  const isMine = (deal.buyer?.toLowerCase() === w) || (deal.seller?.toLowerCase() === w);

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
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px]" style={{ color: T.textDim }}>
            {label} &middot; #{deal.id}
            {deal.buyer && (
              <span className="hidden sm:inline">
                {" "}&middot; {deal.buyer.slice(0,6)}…{deal.buyer.slice(-4)}
              </span>
            )}
          </span>
          {isMine && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: T.emBg, color: T.em, border: `1px solid ${T.border}` }}>
              MINE
            </span>
          )}
          {deal.seller && <ReputationBadge address={deal.seller} compact={true} />}
        </div>
      </div>

      {/* Amount — show on all screens */}
      <div className="flex flex-col items-end flex-shrink-0 w-20 sm:w-24">
        <p className="text-[12px] sm:text-[13px] font-mono font-bold" style={{ color: T.em }}>
          {parseFloat(deal.payment).toFixed(3)}
        </p>
        <p className="text-[10px] font-mono" style={{ color: T.textDim }}>RITUAL</p>
      </div>

      {/* Status */}
      <StatusBadge status={deal.status} />

      {/* Deadline — only show when not yet expired */}
      {!cd.expired && (
        <div className="hidden md:block text-right flex-shrink-0 w-16">
          <p className="text-[11px] font-mono" style={{ color: T.textDim }}>{cd.text}</p>
        </div>
      )}

      {/* Chevron */}
      <svg className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: T.em }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

/* ─── sort options ────────────────────────────────────────── */
const SORT_OPTS = [
  { id: "newest",   label: "Newest first"  },
  { id: "amount",   label: "Highest amount"},
  { id: "deadline", label: "Soonest deadline"},
];

/* ─── main component ─────────────────────────────────────── */
export default function MarketPage({
  wallet,
  onConnect,
  onBack,
  onDealClick,
  onCreateListing,
  onDashboard,
  onStartOTCRoom,
}) {
  const [deals, setDeals]           = useState([]);
  const [platform, setPlatform]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");   // "all" | 0-11 integer
  const [statusFilter, setStatus]   = useState("open");  // "all"|"open"|"active"|"done"
  const [sort, setSort]             = useState("newest");
  const [lastSync, setLastSync]     = useState(null);
  const [mobileFilters, setMobF]    = useState(false);
  const intervalRef                 = useRef(null);

  /* ── load ─────────────────────────────────────────────── */
  async function loadDeals() {
    try {
      const [chainDeals, stats] = await Promise.all([
        fetchOnChainDeals().catch(() => []),
        fetchPlatformStats().catch(() => null),
      ]);
      setDeals(chainDeals);
      setPlatform(stats);
      setLastSync(Date.now());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeals();
    intervalRef.current = setInterval(loadDeals, 30_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  /* ── filter + sort ────────────────────────────────────── */
  const shown = useMemo(() => {
    let list = [...deals];

    // Status filter
    if (statusFilter === "open")   list = list.filter(d => d.status === 0);
    if (statusFilter === "active") list = list.filter(d => d.status >= 0 && d.status <= 3);
    if (statusFilter === "done")   list = list.filter(d => d.status >= 4);

    // Category filter
    if (catFilter !== "all") list = list.filter(d => d.category === Number(catFilter));

    // Search
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(d =>
      (d.intent || "").toLowerCase().includes(q) ||
      (d.buyer  || "").toLowerCase().includes(q) ||
      String(d.id).includes(q)
    );

    // Sort
    if (sort === "newest")   list.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "amount")   list.sort((a, b) => parseFloat(b.payment) - parseFloat(a.payment));
    if (sort === "deadline") list.sort((a, b) => a.deadline - b.deadline);

    return list;
  }, [deals, statusFilter, catFilter, search, sort]);

  const openCount   = deals.filter(d => d.status === 0).length;
  const activeCount = deals.filter(d => d.status >= 0 && d.status <= 3).length;

  /* ── sync label ───────────────────────────────────────── */
  function syncLabel() {
    if (!lastSync) return "";
    const s = Math.floor((Date.now() - lastSync) / 1000);
    if (s < 5)  return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  /* ── category tabs — only show categories that have deals ─ */
  const usedCats = useMemo(() => {
    const used = new Set(deals.map(d => d.category));
    return [{ id: "all", label: "All categories", icon: "🏷️" },
      ...Array.from(used).sort().map(c => ({
        id: c, label: CATEGORY_LABELS[c] ?? "Unknown", icon: CATEGORY_ICONS[c] ?? "📦",
      }))];
  }, [deals]);

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40"
        style={{
          background: "linear-gradient(180deg,rgba(230,235,233,0.97) 0%,rgba(221,227,224,0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.80), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">

          {/* Back */}
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-all flex-shrink-0"
            style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = T.emBg}
            onMouseLeave={e => e.currentTarget.style.background = T.panel}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title */}
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold" style={{ color: T.text }}>Market</span>
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: T.emBg, border: `1px solid ${T.border}`, color: T.em }}>
              Live on-chain
            </span>
            {openCount > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: T.emBg, color: T.em, border: `1px solid ${T.border}` }}>
                {openCount} open
              </span>
            )}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Refresh */}
            <button onClick={() => { setLoading(true); loadDeals(); }}
              className="h-11 w-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
              style={{ background: T.panel, border: `1px solid ${T.border}` }}
              title="Refresh">
              <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ color: T.em }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* My Deals */}
            {wallet && (
              <button onClick={onDashboard}
                className="hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all"
                style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.textSub }}>
                My Deals
              </button>
            )}

            {/* OTC Room */}
            {wallet && (
              <button onClick={onStartOTCRoom}
                className="hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all"
                style={{ background: T.emBg, border: `1px solid ${T.border}`, color: T.em }}>
                🔒 OTC Room
              </button>
            )}

            {/* Connect / wallet pill */}
            {wallet ? (
              <button onClick={onDashboard}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium"
                style={{ background: "#f7f8fa", border: `1px solid ${T.border}`, color: "#2d3340" }}>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ background: T.emBr }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }} />
                </span>
                <span className="hidden sm:inline">{wallet.slice(0,6)}…{wallet.slice(-4)}</span>
              </button>
            ) : (
              <button onClick={onConnect}
                className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{ background: "#f7f8fa", border: `1px solid ${T.border}`, color: "#2d3340" }}>
                Connect
              </button>
            )}

            {/* Create deal */}
            <button onClick={onCreateListing}
              className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white transition-all active:scale-[0.98] flex items-center gap-1.5"
              style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.15)" }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden xs:inline">Create</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        {/* ── Platform stats strip ─────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Deals",  value: platform ? platform.total     : deals.length,        live: false },
            { label: "Open Now",     value: openCount,                                            live: true  },
            { label: "Completed",    value: platform ? platform.completed : deals.filter(d=>d.status===4).length, live: false },
            { label: "RITUAL Locked",value: platform
                ? parseFloat(platform.locked).toFixed(2)
                : deals.filter(d=>d.status<=3).reduce((a,d)=>a+parseFloat(d.payment||0),0).toFixed(2),
              live: true },
            { label: "Chain ID",     value: "1979",                                               live: true  },
          ].map((s, i) => (
            <div key={s.label}
              className="rounded-xl flex flex-col items-center py-3 px-2 text-center"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.10em]"
                  style={{ color: T.textDim }}>{s.label}</span>
                {s.live && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: T.emBr, animation: "pulse 2s infinite" }} />}
              </div>
              <span className="text-[16px] sm:text-[18px] font-mono font-bold tabular-nums"
                style={{ color: s.live ? T.em : T.text }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* ── Search + filters ─────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

          {/* Search bar */}
          <div className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: `1px solid ${T.border}` }}>
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} style={{ color: T.textDim }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by intent, wallet, or deal ID…"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[13px]"
              style={{ fontSize: 16, color: T.text }}
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="text-[11px] px-2 py-0.5 rounded-lg transition-colors"
                style={{ color: T.textDim, background: T.panel }}>clear</button>
            )}

            {/* Mobile filter toggle */}
            <button onClick={() => setMobF(v => !v)}
              className="sm:hidden h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: mobileFilters ? T.emBg : T.panel, border: `1px solid ${T.border}` }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                strokeWidth={2} style={{ color: T.em }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
            </button>
          </div>

          {/* Filter row (desktop always visible, mobile collapsible) */}
          <div className={`${mobileFilters ? "flex" : "hidden sm:flex"} flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3`}
            style={{ borderBottom: `1px solid ${T.border}`, background: T.panel }}>

            {/* Status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all",    label: "All"    },
                { id: "open",   label: `Open${openCount > 0 ? ` (${openCount})` : ""}` },
                { id: "active", label: `Active${activeCount > 0 ? ` (${activeCount})` : ""}` },
                { id: "done",   label: "Done"   },
              ].map(f => (
                <button key={f.id} onClick={() => setStatus(f.id)}
                  className="rounded-lg px-3 py-2 text-[12px] font-semibold transition-all"
                  style={statusFilter === f.id
                    ? { background: T.em, color: "#fff" }
                    : { background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="sm:ml-auto flex items-center gap-2">
              <span className="text-[10px] font-medium" style={{ color: T.textDim }}>Sort:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-[11px] rounded-lg px-2 py-1 outline-none cursor-pointer"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
                {SORT_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5"
            style={{ scrollbarWidth: "none" }}>
            {usedCats.map(c => (
              <button key={String(c.id)} onClick={() => setCatFilter(String(c.id) === catFilter ? "all" : String(c.id))}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-all flex-shrink-0 whitespace-nowrap"
                style={String(c.id) === catFilter
                  ? { background: T.em, color: "#fff", border: `1px solid ${T.em}` }
                  : { background: T.panel, color: T.textSub, border: `1px solid ${T.border}` }}>
                <span className="text-[12px]">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Deal list ─────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

          {/* List header */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.panel }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: T.textSub }}>On-Chain Deals</span>
              {!loading && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.emBr }} />
                  <span className="text-[10px] font-semibold" style={{ color: T.em }}>
                    {shown.length} shown
                  </span>
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono" style={{ color: T.textDim }}>
              synced {syncLabel()}
            </span>
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkelRow key={i} />)
          ) : shown.length === 0 ? (
            <div className="py-16 text-center px-6">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  strokeWidth={1.5} style={{ color: T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <p className="text-[15px] font-bold mb-1" style={{ color: T.text }}>No deals found</p>
              <p className="text-[13px] mb-6" style={{ color: T.textSub }}>
                {search ? `No results for "${search}"` : "Try a different filter"}
              </p>
              <button onClick={() => { setSearch(""); setStatus("all"); setCatFilter("all"); }}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all"
                style={{ background: T.emBg, color: T.em, border: `1px solid ${T.border}` }}>
                Clear filters
              </button>
            </div>
          ) : (
            shown.map(deal => (
              <DealRow
                key={deal.id}
                deal={deal}
                wallet={wallet}
                onClick={() => onDealClick?.(deal)}
              />
            ))
          )}

          {/* Footer */}
          {!loading && shown.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${T.border}`, background: T.panel }}>
              <span className="text-[11px]" style={{ color: T.textDim }}>
                Showing {shown.length} of {deals.length} total deals
              </span>
              <button onClick={() => { setLoading(true); loadDeals(); }}
                className="px-3 py-2 text-[11px] font-semibold transition-all"
                style={{ color: T.em }}>
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* ── Seller onboarding tip (only when no wallet) ──── */}
        {!wallet && (
          <div className="rounded-2xl px-5 py-4 flex items-start gap-4"
            style={{ background: T.emBg, border: `1px solid ${T.borderS}` }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">🤖</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold mb-0.5" style={{ color: T.emMid }}>
                Get matched automatically
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>
                Connect your wallet, then message <strong>@ShadowOTC_bot</strong> on Telegram to register as a seller and get instant alerts when a matching deal goes live.
              </p>
            </div>
            <button onClick={onConnect}
              className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white flex-shrink-0 transition-all"
              style={{ background: T.em }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              Connect
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
