import { useEffect, useMemo, useState } from "react";
import { fetchMyDeals, fetchPlatformStats, CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS } from "../lib/contract";
import ReputationBadge from "./ReputationBadge";
import { sbGetProfile, sbUpsertProfile, supabaseConfigured } from "../lib/supabase";

/* ── design tokens ─────────────────────────────────────── */
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
  bg:      "#F0F4F2",
  danger:  "#dc2626",
  dangerBg:"#fff1f2",
};

/* ── on-chain status → display ─────────────────────────── */
const STATUS_STYLE = {
  0: { label:"Open",            bg:"#EAF4EF", color:"#0B6B4B", border:"rgba(11,107,75,0.28)" },
  1: { label:"Accepted",        bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe" },
  2: { label:"Pending Delivery",bg:"#f3e8ff", color:"#7c3aed", border:"#ddd6fe" },
  3: { label:"Verifying",       bg:"#fdf4ff", color:"#9333ea", border:"#e9d5ff", pulse:true },
  4: { label:"Completed",       bg:"#f0fdf4", color:"#16a34a", border:"#bbf7d0" },
  5: { label:"Failed",          bg:"#fff1f2", color:"#dc2626", border:"#fecdd3" },
  6: { label:"Disputed",        bg:"#fefce8", color:"#b45309", border:"#fde68a" },
  7: { label:"Cancelled",       bg:T.surface, color:T.textDim, border:T.border  },
  8: { label:"Expired",         bg:"#fff1f2", color:"#dc2626", border:"#fecdd3" },
};

/* ── helpers ───────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "—";
  const d = (Date.now() - ts) / 1000;
  if (d < 60)    return `${Math.floor(d)}s ago`;
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function countdown(ms) {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

/* ── StatCard ───────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5"
      style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.10em] mb-2" style={{ color: T.textDim }}>{label}</div>
      {loading
        ? <div className="h-7 w-16 rounded-lg animate-pulse" style={{ background: T.surface }}/>
        : <div className="text-[26px] font-bold tracking-tight leading-none" style={{ color: accent || T.text }}>{value}</div>
      }
      {sub && <div className="text-[11px] mt-1.5" style={{ color: T.textDim }}>{sub}</div>}
    </div>
  );
}

/* ── DealRow ────────────────────────────────────────────── */
function DealRow({ deal, role, onClick }) {
  const ss     = STATUS_STYLE[deal.status] ?? STATUS_STYLE[0];
  const icon   = CATEGORY_ICONS[deal.category]  ?? "📦";
  const catLbl = CATEGORY_LABELS[deal.category] ?? "Unknown";

  return (
    <div onClick={() => onClick?.(deal)}
      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors"
      style={{ borderBottom:`1px solid rgba(11,107,75,0.10)` }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.03)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Category icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base"
        style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
        {icon}
      </div>

      {/* Intent + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold truncate" style={{ color: T.text }}>
            {deal.intent || `Deal #${deal.id}`}
          </span>
          {/* Role pill */}
          <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase"
            style={ role === "buyer"
              ? { background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe" }
              : { background: T.emBg,   color: T.em,     border:`1px solid ${T.emBdr}` }}>
            {role}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px]" style={{ color: T.textDim }}>{catLbl}</span>
          <span style={{ color: T.border }}>·</span>
          <span className="text-[11px]" style={{ color: T.textDim }}>#{deal.id}</span>
          <span style={{ color: T.border }}>·</span>
          <span className="text-[11px]" style={{ color: T.textDim }}>{timeAgo(deal.createdAt)}</span>
          {(deal.status === 1 || deal.status === 2) && (
            <>
              <span style={{ color: T.border }}>·</span>
              <span className="text-[11px]" style={{ color: deal.isExpired ? T.danger : T.textDim }}>
                {countdown(deal.deadline)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount — visible on all screens */}
      <div className="flex flex-col items-end flex-shrink-0 w-20 sm:w-24">
        <div className="text-[12px] sm:text-[13px] font-bold font-mono" style={{ color: T.em }}>
          {parseFloat(deal.payment || 0).toFixed(3)}
        </div>
        <div className="text-[10px]" style={{ color: T.textDim }}>RITUAL</div>
      </div>

      {/* Status */}
      <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold"
        style={{ background: ss.bg, color: ss.color, border:`1px solid ${ss.border}` }}>
        {ss.pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: ss.color }}/>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: ss.color }}/>
          </span>
        )}
        {ss.label}
      </span>

      {/* Chevron */}
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        style={{ color: T.textDim }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────── */
function EmptyState({ icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="mb-3 text-4xl opacity-25">{icon}</div>
      <p className="text-[13px] font-semibold mb-1" style={{ color: T.text }}>{title}</p>
      <p className="text-[12px] max-w-xs" style={{ color: T.textDim }}>{body}</p>
    </div>
  );
}

/* ── NotConnected ───────────────────────────────────────── */
function NotConnected({ onConnect }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: T.em }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4z"/>
        </svg>
      </div>
      <h2 className="mb-2 text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Connect your wallet</h2>
      <p className="mb-6 max-w-xs text-[13px]" style={{ color: T.textSub }}>
        Connect to see all your deals — as buyer and seller — pulled live from Ritual Chain.
      </p>
      <button onClick={onConnect}
        className="rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white"
        style={{ background: T.em, boxShadow:"0 4px 12px rgba(11,107,75,0.18)" }}>
        Connect Wallet
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════ */
const ALL_SKILLS = [
  "NFT Trader", "Token Deals", "Freelance Dev", "Content Creator",
  "Marketing", "Airdrop Hunter", "Bug Bounty", "Escrow / Delivery",
];

const PROFILE_LS_KEY = (w) => `shadowotc_profile_${w?.toLowerCase() ?? "anon"}`;

function loadLocalProfile(wallet) {
  try {
    const raw = localStorage.getItem(PROFILE_LS_KEY(wallet));
    return raw ? JSON.parse(raw) : { displayName: "", bio: "", email: "", skills: [] };
  } catch { return { displayName: "", bio: "", email: "", skills: [] }; }
}

function saveLocalProfile(wallet, profile) {
  try { localStorage.setItem(PROFILE_LS_KEY(wallet), JSON.stringify(profile)); } catch {}
}

export default function Dashboard({ wallet, onConnect, onBack, onDealClick, onStartOTCRoom }) {
  const [deals,       setDeals]       = useState([]);
  const [platformStats, setPlatform]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [lastFetch,   setLastFetch]   = useState(null);
  const [activeTab,   setActiveTab]   = useState("all");
  const [activeSection, setSection]   = useState("deals");

  // ── profile state ──────────────────────────────────────
  const [profile,     setProfile]     = useState({ displayName: "", bio: "", email: "", skills: [] });
  const [profileDraft, setDraft]      = useState({ displayName: "", bio: "", email: "", skills: [] });
  const [profileSaving, setSaving]    = useState(false);
  const [profileSaved,  setSaved]     = useState(false);

  /* ── fetch real on-chain deals for this wallet ─────── */
  async function loadDeals() {
    if (!wallet) return;
    setLoading(true);
    try {
      const [myDeals, stats] = await Promise.all([
        fetchMyDeals(wallet),
        fetchPlatformStats().catch(() => null),
      ]);
      setDeals(myDeals || []);
      setPlatform(stats);
      setLastFetch(Date.now());
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeals();
    // Auto-refresh every 30s
    const timer = setInterval(loadDeals, 30_000);
    return () => clearInterval(timer);
  }, [wallet]);

  // ── load profile ─────────────────────────────────────
  useEffect(() => {
    if (!wallet) return;
    const local = loadLocalProfile(wallet);
    setProfile(local);
    setDraft(local);
    // Merge with Supabase if configured
    sbGetProfile(wallet).then(remote => {
      if (!remote) return;
      const merged = { ...local, ...remote };
      setProfile(merged);
      setDraft(merged);
      saveLocalProfile(wallet, merged);
    }).catch(() => {});
  }, [wallet]);

  async function saveProfile() {
    if (!wallet) return;
    setSaving(true);
    saveLocalProfile(wallet, profileDraft);
    setProfile(profileDraft);
    await sbUpsertProfile(wallet, profileDraft).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  /* ── role detection per deal ─────────────────────── */
  function getRole(deal) {
    if (!wallet) return "viewer";
    const w = wallet.toLowerCase();
    if (deal.buyer?.toLowerCase()  === w) return "buyer";
    if (deal.seller?.toLowerCase() === w) return "seller";
    return "viewer";
  }

  /* ── derived lists ────────────────────────────────── */
  const activeDealIds = new Set();

  const allDeals = useMemo(() => deals, [deals]);

  const buyerDeals  = useMemo(() => deals.filter(d => getRole(d) === "buyer"),  [deals, wallet]);
  const sellerDeals = useMemo(() => deals.filter(d => getRole(d) === "seller"), [deals, wallet]);

  const completedDeals = useMemo(() => deals.filter(d => d.status === 4), [deals]);
  const activeDeals    = useMemo(() => deals.filter(d => d.status >= 0 && d.status <= 3), [deals]);
  const failedDeals    = useMemo(() => deals.filter(d => d.status === 5 || d.status === 6), [deals]);

  const needsAction = useMemo(() => deals.filter(d => {
    const role = getRole(d);
    if (role === "seller" && d.status === 0) return true;  // open deal they can accept
    if (role === "seller" && d.status === 1) return true;  // accepted — submit delivery
    if (role === "buyer"  && d.status === 2) return true;  // pending — trigger verify
    return false;
  }), [deals, wallet]);

  /* ── filter for "My Deals" tab ────────────────────── */
  const filtered = useMemo(() => {
    if (activeTab === "all")       return allDeals;
    if (activeTab === "active")    return activeDeals;
    if (activeTab === "completed") return completedDeals;
    if (activeTab === "action")    return needsAction;
    return allDeals;
  }, [allDeals, activeDeals, completedDeals, needsAction, activeTab]);

  const counts = {
    all:       allDeals.length,
    active:    activeDeals.length,
    completed: completedDeals.length,
    action:    needsAction.length,
  };

  const totalVolume = allDeals
    .reduce((s, d) => s + parseFloat(d.payment || 0), 0)
    .toFixed(3);

  const SECTION_TABS = [
    { id:"deals",       label:"My Deals",    icon:"📋" },
    { id:"settlements", label:"Settlements", icon:"✅" },
    { id:"reputation",  label:"Reputation",  icon:"⭐" },
    { id:"profile",     label:"Profile",     icon:"👤" },
    { id:"stats",       label:"Platform",    icon:"📊" },
  ];

  const FILTER_TABS = [
    { id:"all",       label:"All" },
    { id:"active",    label:"Active" },
    { id:"action",    label:"Action needed", alert: counts.action > 0 },
    { id:"completed", label:"Done" },
  ];

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>

      {/* ── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-30"
        style={{
          background:"linear-gradient(180deg, rgba(230,235,233,0.97) 0%, rgba(221,227,224,0.95) 100%)",
          backdropFilter:"blur(20px)",
          borderBottom:`1px solid ${T.border}`,
          boxShadow:"0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.04)",
        }}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
            style={{ color: T.textSub, border:`1px solid ${T.border}` }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.04)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px" style={{ background: T.border }}/>
          <span className="text-[13px] font-bold" style={{ color: T.text }}>Dashboard</span>

          {/* Action needed badge */}
          {counts.action > 0 && (
            <span className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold"
              style={{ background:"#fff7ed", border:"1px solid #fed7aa", color:"#c2410c" }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"/>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500"/>
              </span>
              {counts.action} need action
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* OTC Room */}
            {wallet && (
              <button onClick={onStartOTCRoom}
                className="hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all"
                style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }}>
                🔒 OTC Room
              </button>
            )}

            {/* Refresh button */}
            <button onClick={loadDeals} disabled={loading}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{ color: T.textSub, border:`1px solid ${T.border}` }}
              title="Refresh from chain"
              onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {loading ? <Spinner/> : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              )}
            </button>

            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.emBr }}/>
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.emBr }}/>
                </span>
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

          {/* ── Stats row ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
            <StatCard label="Total Deals"  value={counts.all}    sub="All time"          loading={loading}/>
            <StatCard label="As Buyer"     value={buyerDeals.length}  sub="Deals created" accent={T.em} loading={loading}/>
            <StatCard label="As Seller"    value={sellerDeals.length} sub="Deals accepted" accent="#7c3aed" loading={loading}/>
            <StatCard label="Volume"       value={`${totalVolume}`}  sub="RITUAL in deals" loading={loading}/>
          </div>

          {/* ── Section tabs ──────────────────────────── */}
          <div className="mb-4 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
            <div className="flex gap-1.5 rounded-2xl p-1.5 w-fit min-w-full sm:min-w-0"
              style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              {SECTION_TABS.map(s => (
                <button key={s.id} onClick={() => setSection(s.id)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  style={activeSection === s.id
                    ? { background:"#0F1412", color:"#fff", boxShadow:"0 2px 8px rgba(0,0,0,0.20)" }
                    : { color: T.textSub }}>
                  <span>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══ MY DEALS ══════════════════════════════ */}
          {activeSection === "deals" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>

              {/* Filter tabs */}
              <div className="overflow-x-auto" style={{ scrollbarWidth:"none" }}>
                <div className="flex items-center gap-0 px-2 pt-2 min-w-max"
                  style={{ borderBottom:`1px solid rgba(11,107,75,0.10)` }}>
                  {FILTER_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className="relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold transition-all whitespace-nowrap"
                      style={{
                        color: activeTab === t.id ? T.text : T.textDim,
                        borderBottom: activeTab === t.id ? `2px solid ${T.em}` : "2px solid transparent",
                        marginBottom:"-1px",
                      }}>
                      {t.label}
                      {counts[t.id] > 0 && (
                        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                          style={t.alert
                            ? { background:"#c2410c", color:"white" }
                            : activeTab === t.id
                            ? { background: T.em, color:"#fff" }
                            : { background: T.surface, color: T.textDim }}>
                          {counts[t.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {loading && deals.length === 0 ? (
                <div className="flex items-center justify-center py-16 gap-3"
                  style={{ color: T.textDim }}>
                  <Spinner/>
                  <span className="text-[13px]">Loading your deals from Ritual Chain…</span>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title={allDeals.length === 0 ? "No on-chain deals yet" : `No ${activeTab} deals`}
                  body={allDeals.length === 0
                    ? "Create a deal or accept one as a seller — it will appear here instantly."
                    : "Switch the filter to see other deals."}
                />
              ) : (
                filtered.map(deal => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    role={getRole(deal)}
                    onClick={onDealClick}
                  />
                ))
              )}

              {/* Last updated footer */}
              {lastFetch && (
                <div className="px-4 py-2.5 text-[10px] flex items-center gap-1.5"
                  style={{ color: T.textDim, borderTop:`1px solid ${T.border}` }}>
                  <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: T.emBr }}/>
                  Live · Last synced {timeAgo(lastFetch)} · Auto-refreshes every 30s
                </div>
              )}
            </div>
          )}

          {/* ══ SETTLEMENTS ═══════════════════════════ */}
          {activeSection === "settlements" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom:`1px solid rgba(11,107,75,0.10)` }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: T.text }}>Settlement History</p>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textDim }}>
                    Completed deals verified on-chain — {completedDeals.length} total
                  </p>
                </div>
                {completedDeals.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                    style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.emBr }}/>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.em }}>Live</span>
                  </div>
                )}
              </div>

              {completedDeals.length === 0 ? (
                <EmptyState icon="✅" title="No completed deals yet"
                  body="Deals the agent verifies as successful will appear here automatically."/>
              ) : (
                completedDeals.map((deal, i) => (
                  <div key={deal.id}
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                    style={{ borderBottom: i < completedDeals.length-1 ? `1px solid rgba(11,107,75,0.08)` : "none" }}
                    onClick={() => onDealClick?.(deal)}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(11,107,75,0.03)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.em }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: T.text }}>
                        {deal.intent || `Deal #${deal.id}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: T.textDim }}>
                          {CATEGORY_LABELS[deal.category] ?? "Unknown"}
                        </span>
                        <span style={{ color: T.border }}>·</span>
                        <span className="text-[10px]" style={{ color: T.textDim }}>
                          {getRole(deal) === "buyer" ? "You bought" : "You sold"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-bold font-mono" style={{ color: T.em }}>
                        {parseFloat(deal.payment || 0).toFixed(4)}
                      </p>
                      <p className="text-[11px]" style={{ color: T.textDim }}>RITUAL</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ REPUTATION ════════════════════════════ */}
          {activeSection === "reputation" && (
            <div className="space-y-4">
              {/* Full reputation card for connected wallet */}
              <div className="rounded-2xl p-5"
                style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: T.textDim }}>
                  Your On-Chain Reputation
                </p>
                <ReputationBadge address={wallet} compact={false}/>
              </div>

              {/* How reputation is scored */}
              <div className="rounded-2xl p-5"
                style={{ background: T.card, border:`1px solid ${T.border}` }}>
                <p className="text-[13px] font-bold mb-4" style={{ color: T.text }}>How your score is calculated</p>
                <div className="space-y-3">
                  {[
                    ["✅ Deal completed",  "+5 points",  "#16a34a"],
                    ["❌ Deal failed",     "−10 points", "#dc2626"],
                    ["⚠️ Dispute raised",  "−15 points", "#b45309"],
                    ["🎯 Starting score",  "50 points",  T.em ],
                  ].map(([event, pts, color]) => (
                    <div key={event} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                      style={{ background: T.surface, border:`1px solid ${T.border}` }}>
                      <span className="text-[12px]" style={{ color: T.textSub }}>{event}</span>
                      <span className="text-[12px] font-bold" style={{ color }}>{pts}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-4" style={{ color: T.textDim }}>
                  Scores are updated on-chain by the ShadowOTCV3 smart contract after every deal. No one can modify them manually.
                </p>
              </div>
            </div>
          )}

          {/* ══ PROFILE ═══════════════════════════════ */}
          {activeSection === "profile" && (
            <div className="space-y-4">
              {/* Wallet identity */}
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
                style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>👤</div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: T.text }}>
                    {profileDraft.displayName || `${wallet.slice(0,6)}…${wallet.slice(-4)}`}
                  </p>
                  <p className="text-[11px] font-mono" style={{ color: T.textDim }}>{wallet}</p>
                </div>
                <span className="ml-auto text-[11px] px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                  style={{ background: T.emBg, color: T.em, border: `1px solid ${T.emBdr}` }}>
                  Wallet identity
                </span>
              </div>

              {/* All fields optional note */}
              <div className="rounded-xl px-4 py-3 text-[11px] leading-relaxed"
                style={{ background: "#fffbeb", border: "1px solid rgba(180,83,9,0.20)", color: "#92400e" }}>
                ✦ All profile fields are <strong>completely optional</strong> and opt-in.
                Your wallet address is your permanent identity — everything else is extra.
                Email is only used to send you deal update notifications.
              </div>

              {/* Form */}
              <div className="rounded-2xl p-5 space-y-5"
                style={{ background: T.card, border: `1px solid ${T.border}` }}>

                {/* Display name */}
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Display Name <span className="font-normal text-[11px]" style={{ color: T.textDim }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={profileDraft.displayName}
                    onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                    placeholder="e.g. Shadow Trader or leave blank"
                    maxLength={40}
                    className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none transition-all"
                    style={{ fontSize: 16, borderColor: T.border, color: T.text, background: T.card }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.em; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,107,75,0.10)"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Notification Email <span className="font-normal text-[11px]" style={{ color: T.textDim }}>(optional — deal status updates only)</span>
                  </label>
                  <input
                    type="email"
                    value={profileDraft.email}
                    onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none transition-all"
                    style={{ fontSize: 16, borderColor: T.border, color: T.text, background: T.card }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.em; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,107,75,0.10)"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: T.textDim }}>
                    When your deal status changes (accepted, verified, completed, etc.) we'll send you an email.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Bio <span className="font-normal text-[11px]" style={{ color: T.textDim }}>(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.bio}
                    onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
                    placeholder="Tell other traders what you do…"
                    maxLength={200}
                    className="w-full resize-none rounded-xl border px-4 py-3 text-[13px] outline-none transition-all"
                    style={{ fontSize: 16, borderColor: T.border, color: T.text, background: T.card }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.em; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,107,75,0.10)"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-[12px] font-semibold mb-2" style={{ color: T.textSub }}>
                    Skills <span className="font-normal text-[11px]" style={{ color: T.textDim }}>(optional — helps with deal matching)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SKILLS.map(skill => {
                      const active = profileDraft.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          onClick={() => setDraft(d => ({
                            ...d,
                            skills: active
                              ? d.skills.filter(s => s !== skill)
                              : [...d.skills, skill],
                          }))}
                          className="rounded-full px-3 py-2 text-[12px] font-semibold transition-all"
                          style={active
                            ? { background: T.em,   color: "#fff",       border: `1px solid ${T.em}` }
                            : { background: T.surface, color: T.textSub, border: `1px solid ${T.border}` }}>
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}>
                    {profileSaving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                        </svg>
                        Saving…
                      </>
                    ) : profileSaved ? (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        Saved!
                      </>
                    ) : "Save Profile"}
                  </button>
                  <p className="text-[11px]" style={{ color: T.textDim }}>
                    {supabaseConfigured ? "Saved to Supabase + device" : "Saved to this device"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══ PLATFORM STATS ════════════════════════ */}
          {activeSection === "stats" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total Locked"   value={platformStats ? `${parseFloat(platformStats.locked).toFixed(2)}` : "—"}  sub="RITUAL in escrow" accent={T.em} loading={loading}/>
                <StatCard label="Deals Completed" value={platformStats?.completed ?? "—"} sub="All time" loading={loading}/>
                <StatCard label="Deals Failed"    value={platformStats?.failed    ?? "—"} sub="All time" loading={loading}/>
                <StatCard label="Total Deals"     value={platformStats?.total     ?? "—"} sub="On-chain" loading={loading}/>
              </div>

              <div className="rounded-2xl p-5"
                style={{ background: T.card, border:`1px solid ${T.border}` }}>
                <p className="text-[13px] font-bold mb-1" style={{ color: T.text }}>Contract</p>
                <p className="text-[11px] mb-3" style={{ color: T.textDim }}>ShadowOTCV3 · Ritual Testnet · Chain ID 1979</p>
                <div className="rounded-xl px-4 py-3 font-mono text-[11px] break-all"
                  style={{ background: T.surface, border:`1px solid ${T.border}`, color: T.em }}>
                  0x644417E2fC010E03E129a35761FF603e69Cc52aC
                </div>
                <a href="https://explorer.ritualfoundation.org/address/0x644417E2fC010E03E129a35761FF603e69Cc52aC"
                  target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{ background: T.emBg, border:`1px solid ${T.emBdr}` }}>
                  <span className="text-[12px]" style={{ color: T.emMid }}>View on Ritual Explorer</span>
                  <span className="text-[12px] font-semibold" style={{ color: T.em }}>↗</span>
                </a>
              </div>
            </div>
          )}

        </main>
      )}
    </div>
  );
}
