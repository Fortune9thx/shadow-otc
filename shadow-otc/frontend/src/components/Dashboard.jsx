import { useMemo, useState } from "react";

/* ─── design tokens ──────────────────────────────────── */
const T = {
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBr:    "#0D7A56",
  emBg:    "#EAF4EF",
  emBdr:   "rgba(11,107,75,0.22)",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textDim: "#7B8A84",
  border:  "rgba(11,107,75,0.16)",
  card:    "#ffffff",
  surface: "#F3F6F4",
};

const STATUS_CONFIG = {
  active:    { label: "Active",    bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  pending:   { label: "Pending",   bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  completed: { label: "Completed", bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  disputed:  { label: "Disputed",  bg: "#fff1f2", color: "#be123c", border: "#fda4af" },
};

const CAT_CONFIG = {
  premarket: { icon: "🚀", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
  airdrop:   { icon: "🪂", color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  nft:       { icon: "🖼️", color: "#f472b6", bg: "rgba(244,114,182,0.10)" },
  bundle:    { icon: "📦", color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
};

function timeAgo(ts) {
  if (!ts) return "—";
  const d = (Date.now() - ts) / 1000;
  if (d < 60)    return `${Math.floor(d)}s ago`;
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}
function timeUntil(ts) {
  const d = (ts - Date.now()) / 1000;
  if (d <= 0) return "Unlocked";
  if (d < 86400) return `${Math.floor(d/3600)}h`;
  return `${Math.floor(d/86400)} days`;
}

/* ─── stat card ─────────────────────────────────────── */
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: T.textDim }}>{label}</div>
      <div className="text-[24px] sm:text-[26px] font-bold tracking-tight" style={{ color: accent || T.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: T.textDim }}>{sub}</div>}
    </div>
  );
}

/* ─── deal row ───────────────────────────────────────── */
function DealRow({ deal, onView }) {
  const status = STATUS_CONFIG[deal.status?.toLowerCase()] || STATUS_CONFIG.active;
  const cat    = CAT_CONFIG[deal.category] || CAT_CONFIG.bundle;

  return (
    <div onClick={() => onView?.(deal)}
      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors"
      style={{ borderBottom: `1px solid rgba(11,107,75,0.10)` }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.03)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Category icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base"
        style={{ background: cat.bg, border: `1px solid ${cat.color}22` }}>
        {cat.icon}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{deal.asset}</span>
          <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={deal.side === "buy"
              ? { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }
              : { background: "#ecfdf5", color: T.em,     border: "1px solid #6ee7b7" }}>
            {(deal.side || "—").toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] font-mono" style={{ color: T.textDim }}>{deal.quantity || "—"}</span>
          <span style={{ color: T.border }}>·</span>
          <span className="text-[11px]" style={{ color: T.textDim }}>{timeAgo(deal.createdAt)}</span>
          {/* Counterparty hidden on very small screens */}
          {deal.counterparty && (
            <>
              <span className="hidden sm:inline" style={{ color: T.border }}>·</span>
              <span className="hidden sm:inline text-[11px] font-mono" style={{ color: T.textDim }}>{deal.counterparty}</span>
            </>
          )}
        </div>
      </div>

      {/* Price — hidden on xs */}
      <div className="hidden sm:block text-right flex-shrink-0">
        <div className="text-[13px] font-bold font-mono" style={{ color: T.em }}>{deal.price}</div>
        <div className="text-[9px]" style={{ color: T.textDim }}>RITUAL</div>
      </div>

      {/* Status */}
      <span className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold"
        style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
        {status.label}
      </span>

      {/* Chevron */}
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        style={{ color: T.textDim }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────── */
function EmptyState({ icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="mb-3 text-4xl opacity-25">{icon}</div>
      <p className="text-[13px] font-semibold mb-1" style={{ color: T.text }}>{title}</p>
      <p className="text-[12px] max-w-xs" style={{ color: T.textDim }}>{body}</p>
    </div>
  );
}

/* ─── deal drawer (slide-in) ─────────────────────────── */
function DealDrawer({ deal, onClose }) {
  if (!deal) return null;
  const status = STATUS_CONFIG[deal.status?.toLowerCase()] || STATUS_CONFIG.active;
  const cat    = CAT_CONFIG[deal.category] || CAT_CONFIG.bundle;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <div className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-3xl sm:bottom-auto sm:right-0 sm:top-0 sm:left-auto sm:w-full sm:max-w-md sm:rounded-none"
        style={{ background: T.card, boxShadow: "0 -4px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(11,107,75,0.10)", maxHeight: "92vh" }}>

        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }}/>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{cat.icon}</span>
            <h3 className="text-[14px] font-semibold" style={{ color: T.text }}>Deal #{String(deal.id).slice(-6)}</h3>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-2 transition-colors"
            style={{ color: T.textDim }}
            onMouseEnter={e => e.currentTarget.style.background = T.surface}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Asset + status */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[15px] font-bold" style={{ color: T.text }}>{deal.asset}</h4>
              <p className="text-[12px] mt-0.5" style={{ color: T.textSub }}>{deal.category}</p>
            </div>
            <span className="rounded-xl px-3 py-1.5 text-[11px] font-bold"
              style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
              {status.label}
            </span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["Side",        (deal.side||"—").toUpperCase()],
              ["Price",       `${deal.price} RITUAL`],
              ["Quantity",    deal.quantity || "—"],
              ["Vesting",     deal.vesting || "Instant"],
              ["Counterparty",deal.counterparty || "—"],
              ["Created",     timeAgo(deal.createdAt)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl p-3"
                style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: T.textDim }}>{l}</div>
                <div className="text-[12px] font-semibold truncate" style={{ color: T.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1" style={{ borderTop: `1px solid ${T.border}` }}>
            {deal.status === "active" && (
              <button className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all"
                style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}>
                Submit Proof of Delivery
              </button>
            )}
            {deal.status === "pending" && (
              <button className="w-full rounded-xl py-3 text-[13px] font-semibold text-white"
                style={{ background: T.em }}>
                Accept Deal
              </button>
            )}
            {deal.proofUrl && (
              <a href={deal.proofUrl} target="_blank" rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-colors"
                style={{ border: `1px solid ${T.emBdr}`, color: T.em }}>
                View on Explorer →
              </a>
            )}
            <button className="w-full rounded-xl py-3 text-[13px] font-semibold transition-colors"
              style={{ background: "#fff1f2", border: "1px solid #fda4af", color: "#be123c" }}>
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── not connected ──────────────────────────────────── */
function NotConnected({ onConnect }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: T.em }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4z"/>
        </svg>
      </div>
      <h2 className="mb-2 text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Connect your wallet</h2>
      <p className="mb-6 max-w-xs text-[13px]" style={{ color: T.textSub }}>
        Connect your wallet to view your deals, track vesting schedules, and claim assets.
      </p>
      <button onClick={onConnect}
        className="rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white"
        style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}>
        Connect Wallet
      </button>
    </div>
  );
}

/* ─── main dashboard ─────────────────────────────────── */
export default function Dashboard({ wallet, onConnect, onBack, deals: propDeals = [], settlements: propSettlements = [] }) {
  const [activeTab,     setActiveTab]     = useState("all");
  const [activeSection, setActiveSection] = useState("deals");
  const [selectedDeal,  setSelectedDeal]  = useState(null);

  /* ── CRITICAL: only show deals belonging to this wallet ── */
  /* Deals created via this app have walletAddress stamped on them.
     Backend deals may also have a walletAddress field.
     We never show deals from other wallets in someone's dashboard.    */
  const myDeals = useMemo(() => {
    if (!wallet) return [];
    return propDeals.filter(d => {
      const addr = (d.walletAddress || d.seller || d.buyer || "").toLowerCase();
      return addr === wallet.toLowerCase();
    });
  }, [propDeals, wallet]);

  /* ── Settlements: only completed deals from myDeals ── */
  const mySettlements = useMemo(() => {
    const fromOwn = myDeals.filter(d =>
      d.status === "completed" || d.status === "Completed"
    );
    const fromProp = propSettlements.filter(d => {
      const addr = (d.walletAddress || d.seller || d.buyer || "").toLowerCase();
      return addr === wallet?.toLowerCase();
    });
    const merged = [...fromOwn, ...fromProp];
    return merged.filter((d, i, arr) => arr.findIndex(x => String(x.id) === String(d.id)) === i);
  }, [myDeals, propSettlements, wallet]);

  const filtered = useMemo(() => {
    if (activeTab === "all")       return myDeals;
    if (activeTab === "active")    return myDeals.filter(d => (d.status||"").toLowerCase() === "active");
    if (activeTab === "pending")   return myDeals.filter(d => (d.status||"").toLowerCase() === "pending");
    if (activeTab === "completed") return myDeals.filter(d => (d.status||"").toLowerCase() === "completed");
    return myDeals;
  }, [myDeals, activeTab]);

  const counts = useMemo(() => ({
    all:       myDeals.length,
    active:    myDeals.filter(d => (d.status||"").toLowerCase() === "active").length,
    pending:   myDeals.filter(d => (d.status||"").toLowerCase() === "pending").length,
    completed: myDeals.filter(d => (d.status||"").toLowerCase() === "completed").length,
  }), [myDeals]);

  const totalVolume = myDeals.reduce((s, d) => s + Number(d.price || 0), 0).toFixed(2);

  const SECTION_TABS = [
    { id: "deals",       label: "My Deals",       icon: "📋" },
    { id: "settlements", label: "Settlements",     icon: "✅" },
    { id: "vesting",     label: "Vesting",         icon: "📅" },
    { id: "claims",      label: "Claims",          icon: "🎁" },
  ];

  const DEAL_FILTER_TABS = [
    { id: "all",       label: "All" },
    { id: "active",    label: "Active" },
    { id: "pending",   label: "Pending" },
    { id: "completed", label: "Done" },
  ];

  return (
    <div className="min-h-screen antialiased" style={{ background: "#F3F6F4" }}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30"
        style={{
          background: "linear-gradient(180deg, rgba(230,235,233,0.97) 0%, rgba(221,227,224,0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          {/* Back */}
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all flex-shrink-0"
            style={{ color: T.textSub, border: `1px solid ${T.border}` }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px" style={{ background: T.border }}/>
          <span className="text-[13px] font-bold" style={{ color: T.text }}>Dashboard</span>

          <div className="ml-auto flex-shrink-0">
            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.emBr }}/>
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }}/>
                </div>
                <span className="font-mono text-[11px] font-semibold" style={{ color: T.em }}>
                  {wallet.slice(0,6)}…{wallet.slice(-4)}
                </span>
              </div>
            ) : (
              <button onClick={onConnect}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
                style={{ background: T.em }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {!wallet ? <NotConnected onConnect={onConnect}/> : (
        <main className="mx-auto max-w-4xl px-4 py-6 pb-20">

          {/* ── Stats row ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
            <StatCard label="Total Deals"   value={counts.all}    sub="All time"/>
            <StatCard label="Active"        value={counts.active} sub="In progress" accent={T.em}/>
            <StatCard label="Pending"       value={counts.pending} sub="Awaiting action" accent="#d97706"/>
            <StatCard label="Volume"        value={totalVolume}   sub="RITUAL traded"/>
          </div>

          {/* ── Section tab row — horizontal scroll on mobile ── */}
          <div className="mb-4 overflow-x-auto" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            <div className="flex gap-1.5 rounded-2xl p-1.5 w-fit min-w-full sm:min-w-0"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {SECTION_TABS.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  style={activeSection === s.id
                    ? { background: "#0F1412", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.20)" }
                    : { color: T.textSub }}>
                  <span className="text-sm">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── MY DEALS ──────────────────────────────── */}
          {activeSection === "deals" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

              {/* Filter tabs — horizontal scroll */}
              <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <div className="flex items-center gap-0 px-2 pt-2 min-w-max"
                  style={{ borderBottom: `1px solid rgba(11,107,75,0.10)` }}>
                  {DEAL_FILTER_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className="relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-all whitespace-nowrap"
                      style={{
                        color: activeTab === t.id ? T.text : T.textDim,
                        borderBottom: activeTab === t.id ? `2px solid ${T.em}` : "2px solid transparent",
                        marginBottom: "-1px",
                      }}>
                      {t.label}
                      <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={activeTab === t.id
                          ? { background: T.em, color: "#fff" }
                          : { background: T.surface, color: T.textDim }}>
                        {counts[t.id]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title={myDeals.length === 0 ? "No deals yet" : `No ${activeTab === "all" ? "" : activeTab} deals`}
                  body={myDeals.length === 0
                    ? "Deals you create or participate in will appear here, linked to your wallet."
                    : "Switch filter to see other deals."}
                />
              ) : (
                filtered.map(deal => (
                  <DealRow key={deal.id} deal={deal} onView={setSelectedDeal}/>
                ))
              )}
            </div>
          )}

          {/* ── SETTLEMENTS ─────────────────────────── */}
          {activeSection === "settlements" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom: `1px solid rgba(11,107,75,0.10)` }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: T.text }}>Settlement History</p>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textDim }}>Completed OTC deals verified on Ritual Chain</p>
                </div>
                {mySettlements.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                    style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.emBr }}/>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.em }}>Live</span>
                  </div>
                )}
              </div>
              {mySettlements.length === 0 ? (
                <EmptyState icon="✅" title="No settlements yet" body="Completed deals will appear here automatically. No data is fabricated."/>
              ) : (
                mySettlements.map((deal, i) => (
                  <div key={deal.id || i}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors"
                    style={{ borderBottom: i < mySettlements.length-1 ? `1px solid rgba(11,107,75,0.08)` : "none" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.em }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{deal.asset}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: T.textDim }}>{deal.category}</span>
                        {deal.side && <span className="text-[10px]" style={{ color: T.textDim }}>· {deal.side.toUpperCase()}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-bold font-mono" style={{ color: T.em }}>{deal.price} RITUAL</p>
                      {deal.proofUrl && (
                        <a href={deal.proofUrl} target="_blank" rel="noreferrer"
                          className="text-[10px] font-medium" style={{ color: T.textDim }}
                          onClick={e => e.stopPropagation()}>
                          View tx →
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── VESTING ─────────────────────────────── */}
          {activeSection === "vesting" && (
            <div>
              {/* Vesting entries are pulled from myDeals that have vesting field */}
              {myDeals.filter(d => d.vesting && d.vesting !== "none" && d.vesting !== "").length === 0 ? (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: T.card, border: `1px dashed ${T.emBdr}` }}>
                  <EmptyState icon="📅" title="No vesting schedules" body="Deals with vesting terms will be tracked here once created."/>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDeals.filter(d => d.vesting && d.vesting !== "none").map(d => (
                    <div key={d.id} className="rounded-2xl p-4 sm:p-5"
                      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: T.text }}>{d.asset}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: T.textDim }}>{d.quantity} · {d.vesting}</p>
                        </div>
                        <p className="text-[13px] font-bold font-mono" style={{ color: T.em }}>{d.price} RITUAL</p>
                      </div>
                      <div className="rounded-xl px-4 py-3"
                        style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Vesting schedule</span>
                          <span className="text-[11px] font-mono" style={{ color: T.em }}>{d.vesting}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CLAIMS ──────────────────────────────── */}
          {activeSection === "claims" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border: `1px dashed ${T.emBdr}` }}>
              <EmptyState
                icon="🎁"
                title="No claimable assets"
                body="Assets from completed OTC deals with on-chain delivery will appear here when ready to claim."
              />
            </div>
          )}

        </main>
      )}

      {/* Deal drawer */}
      {selectedDeal && (
        <DealDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)}/>
      )}
    </div>
  );
}
