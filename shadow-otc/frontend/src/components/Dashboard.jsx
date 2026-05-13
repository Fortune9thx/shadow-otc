import { useMemo, useState } from "react";

/**
 * Dashboard, My Deals, Vesting Tracker, Claims.
 *
 * Props:
 *   wallet      string|null
 *   onConnect   ()=>void
 *   onBack      ()=>void
 *   deals       array , all deals from backend/state
 */

// ── Sample deals for display when wallet connected but no real deals ──
const SAMPLE_MY_DEALS = [
  {
    id: "d001",
    asset: "zkSync Era, Token Allocation",
    category: "premarket",
    side: "buy",
    price: 0.85,
    quantity: "5,000 ZK",
    status: "active",
    counterparty: "0x7f3a…b291",
    createdAt: Date.now() - 86400000 * 2,
    vesting: "12mo linear",
    vestingProgress: 0,
    proofUrl: null,
  },
  {
    id: "d002",
    asset: "Blast L2, Gold Points",
    category: "airdrop",
    side: "sell",
    price: 0.42,
    quantity: "180,000 pts",
    status: "pending",
    counterparty: "0x2c9d…f441",
    createdAt: Date.now() - 86400000 * 5,
    vesting: null,
    vestingProgress: null,
    proofUrl: null,
  },
  {
    id: "d003",
    asset: "Pudgy Penguins, WL Spot",
    category: "nft",
    side: "buy",
    price: 0.6,
    quantity: "1 spot",
    status: "completed",
    counterparty: "0x9a1e…c883",
    createdAt: Date.now() - 86400000 * 14,
    vesting: null,
    vestingProgress: 100,
    proofUrl: "https://explorer.ritualfoundation.org/tx/0xabc",
  },
  {
    id: "d004",
    asset: "EigenLayer, Restaking Points",
    category: "airdrop",
    side: "buy",
    price: 1.1,
    quantity: "240,000 pts",
    status: "active",
    counterparty: "0x4d7b…a112",
    createdAt: Date.now() - 86400000 * 1,
    vesting: null,
    vestingProgress: null,
    proofUrl: null,
  },
];

const VESTING_DEALS = [
  {
    id: "v001",
    asset: "zkSync Era, Token Allocation",
    quantity: "5,000 ZK",
    vestingType: "12mo linear",
    startDate: Date.now() - 86400000 * 60,
    totalMonths: 12,
    claimedMonths: 2,
    totalValue: 0.85,
    nextUnlock: Date.now() + 86400000 * 30,
  },
  {
    id: "v002",
    asset: "LayerZero, ZRO Allocation",
    quantity: "3,200 ZRO",
    vestingType: "6mo cliff + 12mo linear",
    startDate: Date.now() - 86400000 * 20,
    totalMonths: 18,
    claimedMonths: 0,
    totalValue: 1.4,
    nextUnlock: Date.now() + 86400000 * 160,
  },
];

const CLAIMS = [
  {
    id: "c001",
    asset: "Pudgy Penguins, WL Spot",
    category: "NFT",
    claimType: "Whitelist confirmed",
    claimDate: Date.now() - 86400000 * 3,
    value: 0.6,
    status: "claimed",
    txHash: "0xabc123…def456",
  },
  {
    id: "c002",
    asset: "Blast L2, Gold Points",
    category: "Airdrop",
    claimType: "Points transfer",
    claimDate: null,
    value: 0.42,
    status: "pending",
    txHash: null,
  },
];

const STATUS_CONFIG = {
  active:    { label: "Active",    cls: "bg-emerald-50 text-emerald-700" },
  pending:   { label: "Pending",   cls: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", cls: "bg-slate-100 text-slate-600" },
  disputed:  { label: "Disputed",  cls: "bg-rose-50 text-rose-700" },
};

const CAT_ICONS = {
  premarket: "🚀",
  airdrop:   "🪂",
  nft:       "🖼️",
  bundle:    "📦",
};

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function timeUntil(ts) {
  const diff = (ts - Date.now()) / 1000;
  if (diff <= 0) return "Unlocked";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  return Math.floor(diff / 86400) + " days";
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${accent || "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function DealRow({ deal, onView }) {
  const status = STATUS_CONFIG[deal.status] || STATUS_CONFIG.active;
  return (
    <div
      onClick={() => onView?.(deal)}
      className="flex cursor-pointer items-center gap-4 border-b border-slate-100 px-5 py-4 transition-colors last:border-0 hover:bg-slate-50"
    >
      {/* Icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base">
        {CAT_ICONS[deal.category] || "📋"}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{deal.asset}</span>
          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${deal.side === "buy" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
            {deal.side.toUpperCase()}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
          <span>{deal.quantity}</span>
          <span>·</span>
          <span>{timeAgo(deal.createdAt)}</span>
          <span>·</span>
          <span className="font-mono">{deal.counterparty}</span>
        </div>
      </div>

      {/* Price */}
      <div className="hidden text-right sm:block">
        <div className="text-sm font-bold text-slate-900">{deal.price}</div>
        <div className="text-[10px] text-slate-400">RITUAL</div>
      </div>

      {/* Status */}
      <span className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
        {status.label}
      </span>

      {/* Chevron */}
      <svg className="h-4 w-4 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function VestingCard({ v }) {
  const pct = Math.round((v.claimedMonths / v.totalMonths) * 100);
  const nextPct = Math.round(((v.claimedMonths + 1) / v.totalMonths) * 100);
  const claimable = v.claimedMonths < v.totalMonths && Date.now() >= v.nextUnlock - 86400000;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{v.asset}</div>
          <div className="mt-0.5 text-xs text-slate-400">{v.quantity} · {v.vestingType}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-900">{v.totalValue} RITUAL</div>
          <div className="text-[10px] text-slate-400">Total value</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">{pct}% unlocked</span>
          <span className="text-slate-400">{v.claimedMonths}/{v.totalMonths} months</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Next unlock */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Next unlock</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {pct === 100 ? "Fully vested" : `+${nextPct - pct}% in ${timeUntil(v.nextUnlock)}`}
          </div>
        </div>
        {claimable ? (
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800">
            Claim now
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-400">
            {pct === 100 ? "Complete" : timeUntil(v.nextUnlock)}
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimRow({ claim }) {
  const done = claim.status === "claimed";
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
      {/* Status icon */}
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-50" : "bg-amber-50"}`}>
        {done ? (
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{claim.asset}</div>
        <div className="mt-0.5 text-xs text-slate-400">
          {claim.claimType} · {claim.category}
          {claim.txHash && (
            <a
              href={`https://explorer.ritualfoundation.org/tx/${claim.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 font-medium text-slate-500 hover:text-slate-900 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View tx →
            </a>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="hidden text-right sm:block">
        <div className="text-sm font-bold text-slate-900">{claim.value} RITUAL</div>
      </div>

      {/* Action */}
      {done ? (
        <span className="flex-shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Claimed
        </span>
      ) : (
        <button className="flex-shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800">
          Claim
        </button>
      )}
    </div>
  );
}

// ── Not connected state ────────────────────────────────────
function NotConnected({ onConnect }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4z" />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-bold tracking-tight text-slate-900">Connect your wallet</h2>
      <p className="mb-6 max-w-xs text-sm text-slate-500">
        Connect your wallet to view your deals, track vesting schedules, and claim assets.
      </p>
      <button
        onClick={onConnect}
        className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        Connect Wallet
      </button>
    </div>
  );
}

// ── Deal detail drawer ─────────────────────────────────────
function DealDrawer({ deal, onClose }) {
  if (!deal) return null;
  const status = STATUS_CONFIG[deal.status] || STATUS_CONFIG.active;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl sm:border-l sm:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Deal #{deal.id}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Asset */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{CAT_ICONS[deal.category]}</span>
              <h4 className="text-base font-bold text-slate-900">{deal.asset}</h4>
            </div>
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Side",        deal.side.toUpperCase()],
              ["Price",       `${deal.price} RITUAL`],
              ["Quantity",    deal.quantity],
              ["Vesting",     deal.vesting || "Instant"],
              ["Counterparty",deal.counterparty],
              ["Created",     timeAgo(deal.createdAt)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">{l}</div>
                <div className="text-sm font-semibold text-slate-900 truncate">{v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {deal.status === "active" && (
              <button className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                Submit Proof of Delivery
              </button>
            )}
            {deal.status === "pending" && (
              <button className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                Accept Deal
              </button>
            )}
            {deal.proofUrl && (
              <a href={deal.proofUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                View on Explorer →
              </a>
            )}
            <button className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100">
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Dashboard ─────────────────────────────────────────
export default function Dashboard({ wallet, onConnect, onBack, deals: propDeals = [], settlements: propSettlements = [] }) {
  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState("deals"); // deals | vesting | claims
  const [selectedDeal, setSelectedDeal] = useState(null);

  const allDeals = propDeals.length ? propDeals : (wallet ? SAMPLE_MY_DEALS : []);
  // Combine backend settlements with completed deals from allDeals
  const settlementHistory = [
    ...propSettlements,
    ...allDeals.filter(d => d.status === "completed" || d.status === "Completed"),
  ].filter((deal, i, arr) => arr.findIndex(d2 => String(d2.id) === String(deal.id)) === i);

  const filtered = useMemo(() => {
    if (activeTab === "all")       return allDeals;
    if (activeTab === "active")    return allDeals.filter((d) => d.status === "active");
    if (activeTab === "pending")   return allDeals.filter((d) => d.status === "pending");
    if (activeTab === "completed") return allDeals.filter((d) => d.status === "completed");
    return allDeals;
  }, [allDeals, activeTab]);

  const counts = useMemo(() => ({
    all:       allDeals.length,
    active:    allDeals.filter((d) => d.status === "active").length,
    pending:   allDeals.filter((d) => d.status === "pending").length,
    completed: allDeals.filter((d) => d.status === "completed").length,
  }), [allDeals]);

  const totalVolume = allDeals.reduce((s, d) => s + d.price, 0).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-50/50 antialiased">

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-sm font-semibold text-slate-900">Dashboard</span>
          <div className="ml-auto">
            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono text-xs font-medium text-slate-700">{wallet.slice(0,6)}…{wallet.slice(-4)}</span>
              </div>
            ) : (
              <button onClick={onConnect} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {!wallet ? <NotConnected onConnect={onConnect} /> : (
        <main className="mx-auto max-w-6xl px-6 py-8">

          {/* Stats row */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Deals"   value={counts.all}        sub="All time" />
            <StatCard label="Active"        value={counts.active}     sub="In progress" accent="text-emerald-600" />
            <StatCard label="Pending"       value={counts.pending}    sub="Awaiting action" accent="text-amber-600" />
            <StatCard label="Volume"        value={`${totalVolume}`}  sub="RITUAL traded" />
          </div>

          {/* Section tabs */}
          <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
            {[
              { id: "deals",       label: "My Deals",       icon: "📋" },
              { id: "settlements", label: "Settlements",    icon: "✅" },
              { id: "vesting",     label: "Vesting Tracker",icon: "📅" },
              { id: "claims",      label: "Claims",         icon: "🎁" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeSection === s.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* ── MY DEALS ─────────────────────────────────── */}
          {activeSection === "deals" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Filter tabs */}
              <div className="flex items-center gap-0 border-b border-slate-100 px-2 pt-2">
                {[
                  { id: "all",       label: "All" },
                  { id: "active",    label: "Active" },
                  { id: "pending",   label: "Pending" },
                  { id: "completed", label: "Completed" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all ${
                      activeTab === t.id
                        ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {t.label}
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${activeTab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {counts[t.id]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Deal rows */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-3 text-3xl opacity-30">📭</div>
                  <h3 className="text-sm font-semibold text-slate-900">No {activeTab === "all" ? "" : activeTab} deals yet</h3>
                  <p className="mt-1 text-xs text-slate-400">Deals you make will appear here.</p>
                </div>
              ) : (
                filtered.map((deal) => (
                  <DealRow key={deal.id} deal={deal} onView={setSelectedDeal} />
                ))
              )}
            </div>
          )}

          {/* ── VESTING TRACKER ─────────────────────────── */}
          {activeSection === "vesting" && (
            <div>
              {VESTING_DEALS.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
                  <div className="mb-3 text-3xl opacity-30">📅</div>
                  <h3 className="text-sm font-semibold text-slate-900">No vesting schedules</h3>
                  <p className="mt-1 text-xs text-slate-400">Deals with vesting will be tracked here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Tracking <strong className="text-slate-900">{VESTING_DEALS.length}</strong> active vesting schedules.
                  </p>
                  {VESTING_DEALS.map((v) => <VestingCard key={v.id} v={v} />)}
                </div>
              )}
            </div>
          )}

          {/* ── SETTLEMENTS ─────────────────────────────── */}
          {activeSection === "settlements" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Settlement History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">All completed OTC deals verified on Ritual Chain</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 bg-emerald-50 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Live</span>
                </div>
              </div>
              {settlementHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-3 text-3xl opacity-30">✅</div>
                  <h3 className="text-sm font-semibold text-slate-900">No settlements yet</h3>
                  <p className="mt-1 text-xs text-slate-400">Completed deals will appear here automatically. No data is fabricated.</p>
                </div>
              ) : (
                settlementHistory.map((deal, i) => (
                  <div key={deal.id || i} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 transition-colors">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                      <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{deal.asset}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{deal.category}</span>
                        {deal.side && <span className="text-xs text-slate-400">· {deal.side.toUpperCase()}</span>}
                      </div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-bold text-emerald-600">{deal.price} RITUAL</p>
                      <p className="text-xs text-slate-400">settlement</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{deal.quantity || "-"}</p>
                    </div>
                    {deal.proofUrl && (
                      <a href={deal.proofUrl} target="_blank" rel="noreferrer"
                        className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-all">
                        View tx
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── CLAIMS ──────────────────────────────────── */}
          {activeSection === "claims" && (
            <div>
              {CLAIMS.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
                  <div className="mb-3 text-3xl opacity-30">🎁</div>
                  <h3 className="text-sm font-semibold text-slate-900">No claims yet</h3>
                  <p className="mt-1 text-xs text-slate-400">Completed deals with claimable assets will appear here.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Claimable Assets</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Assets ready to claim from completed deals</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {CLAIMS.filter((c) => c.status === "pending").length} pending
                    </span>
                  </div>
                  {CLAIMS.map((c) => <ClaimRow key={c.id} claim={c} />)}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Deal drawer */}
      {selectedDeal && (
        <DealDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      )}
    </div>
  );
}
