import { useEffect, useRef, useState } from "react";
import ReputationBadge from "./ReputationBadge";
import {
  getContract, getWriteContract, parseDeal,
  acceptDeal, submitDelivery, cancelDeal, executeDeal,
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
} from "../lib/contract";
import { ethers } from "ethers";

/* ── security: only allow http/https URLs to prevent javascript: XSS (issue #1) ── */
function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return url;
  } catch {}
  return null;
}

/* ── design tokens ─────────────────────────────────────────── */
const T = {
  bg:      "#F0F4F2",
  card:    "#ffffff",
  panel:   "#F3F6F4",
  border:  "rgba(11,107,75,0.16)",
  borderS: "rgba(11,107,75,0.28)",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textDim: "#7B8A84",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBg:    "#EAF4EF",
  emBdr:   "rgba(11,107,75,0.28)",
  shadow:  "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
  danger:  "#dc2626",
  dangerBg:"#fff1f2",
  warn:    "#b45309",
  warnBg:  "#fefce8",
};

const API = "https://shadow-otc.onrender.com";

/* ── status colors ─────────────────────────────────────────── */
const STATUS_STYLE = [
  { bg:"#EAF4EF", color:"#0B6B4B", border:"rgba(11,107,75,0.28)" }, // Open
  { bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe" },              // Accepted
  { bg:"#f3e8ff", color:"#7c3aed", border:"#ddd6fe" },              // Pending
  { bg:"#fdf4ff", color:"#9333ea", border:"#e9d5ff", pulse:true },  // Verifying
  { bg:"#f0fdf4", color:"#16a34a", border:"#bbf7d0" },              // Completed
  { bg:"#fff1f2", color:"#dc2626", border:"#fecdd3" },              // Failed
  { bg:"#fefce8", color:"#b45309", border:"#fde68a" },              // Disputed
  { bg:T.panel,   color:T.textDim, border:T.border },               // Cancelled
  { bg:"#fff1f2", color:"#dc2626", border:"#fecdd3" },              // Expired
];

/* ── small reusable components ─────────────────────────────── */
function Btn({ onClick, children, disabled, full, outline, danger, small, loading }) {
  const pad  = small ? "px-4 py-2 text-[12px]" : "px-5 py-3 text-[13px]";
  const base = `${full?"w-full":""} flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed`;
  const style = danger
    ? { background: T.dangerBg, border:`1px solid #fecdd3`, color: T.danger }
    : outline
    ? { background:"white", border:`1px solid ${T.borderS}`, color: T.em }
    : { background: T.em, color:"white", boxShadow:"0 2px 10px rgba(11,107,75,0.22)" };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${pad}`} style={style}>
      {loading ? <Spinner /> : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom:`1px solid ${T.border}` }}>
      <span className="text-[12px]" style={{ color: T.textDim }}>{label}</span>
      <span className={`text-[13px] font-semibold ${mono?"font-mono":""}`}
        style={{ color: highlight ? T.em : T.text }}>{value}</span>
    </div>
  );
}

function Alert({ type="info", children }) {
  const s = type==="error" ? { bg:T.dangerBg, border:"#fecdd3", color:T.danger }
           : type==="warn"  ? { bg:T.warnBg,   border:"#fde68a",  color:T.warn }
           :                  { bg:T.emBg,     border:T.emBdr,    color:T.emMid };
  return (
    <div className="rounded-xl px-4 py-3 text-[12px] leading-relaxed"
      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>
      {children}
    </div>
  );
}

function countdown(ms) {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function DealDetails({ deal: dealProp, wallet, onConnect, onBack }) {
  /* ── state ─────────────────────────────────────────────── */
  const [deal,       setDeal]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [txPending,  setTxPending]  = useState(false);   // waiting for wallet + block
  const [txLabel,    setTxLabel]    = useState("");
  const [error,      setError]      = useState(null);
  const [proofUrl,   setProofUrl]   = useState("");
  const [disputeMsg, setDisputeMsg] = useState("");
  const [showDispute,setShowDispute]= useState(false);
  const [agentLogs,  setAgentLogs]  = useState([]);
  const [verifying,  setVerifying]  = useState(false);
  const [verifDone,  setVerifDone]  = useState(null);    // {success, reason}
  const [copied,     setCopied]     = useState(null);
  const logEndRef    = useRef(null);
  const submittingRef = useRef(false); // Security: double-submit guard (issue #5)

  /* ── fetch on-chain deal ─────────────────────────────── */
  useEffect(() => {
    const id = dealProp?.id ?? dealProp?.dealId;
    if (id === undefined || id === null) { setLoading(false); return; }
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const c   = getContract();
        const raw = await c.getDeal(id);
        if (!cancelled) setDeal(parseDeal(id, raw));
      } catch (e) {
        if (!cancelled) setError("Could not load deal from chain: " + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();

    // Poll every 15s so status auto-updates
    const timer = setInterval(async () => {
      try {
        const c   = getContract();
        const raw = await c.getDeal(id);
        if (!cancelled) setDeal(parseDeal(id, raw));
      } catch {}
    }, 15_000);

    return () => { cancelled = true; clearInterval(timer); };
  }, [dealProp?.id, dealProp?.dealId]);

  // Scroll log to bottom
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [agentLogs]);

  if (!dealProp) return null;

  /* ── role detection ──────────────────────────────────── */
  const w        = wallet?.toLowerCase();
  const isBuyer  = deal && w && deal.buyer?.toLowerCase()  === w;
  const isSeller = deal && w && deal.seller?.toLowerCase() === w;
  const isNobody = !isBuyer && !isSeller;

  const st = deal?.status ?? -1;
  const isOpen       = st === 0;
  const isAccepted   = st === 1;
  const isPending    = st === 2;
  const isVerifying  = st === 3;
  const isCompleted  = st === 4;
  const isFailed     = st === 5;
  const isDisputed   = st === 6;
  const isFinal      = st >= 4;

  /* ── helpers ─────────────────────────────────────────── */
  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function withTx(label, fn) {
    if (!wallet) { onConnect?.(); return; }
    // Security: prevent double-submit (issue #5)
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setTxPending(true);
    setTxLabel(label);
    try {
      await fn();
      // Refresh deal state
      const c   = getContract();
      const raw = await c.getDeal(deal.id);
      setDeal(parseDeal(deal.id, raw));
    } catch (e) {
      if (e?.code !== 4001) setError(e?.reason || e?.message || "Something went wrong — please try again or check your connection");
    } finally {
      submittingRef.current = false;
      setTxPending(false);
      setTxLabel("");
    }
  }

  /* ── on-chain actions ────────────────────────────────── */
  async function handleAccept() {
    let collateralEth = "0";
    if (deal.requiresCollateral && deal.collateral) {
      collateralEth = deal.collateral;
    } else if (deal.requiresCollateral) {
      // Calculate from contract
      try {
        const c = getContract();
        const raw = await c.getRequiredCollateral(deal.id);
        collateralEth = ethers.formatEther(raw);
      } catch {}
    }
    await withTx("Accepting deal…", () => acceptDeal(deal.id, collateralEth));
  }

  async function handleSubmitDelivery(e) {
    e.preventDefault();
    if (!proofUrl.trim()) { setError("Please enter a proof URL"); return; }
    await withTx("Submitting delivery…", () => submitDelivery(deal.id, proofUrl.trim()));
    setProofUrl("");
  }

  async function handleCancel() {
    if (!confirm("Cancel this deal? Your escrowed RITUAL will be refunded.")) return;
    await withTx("Cancelling deal…", () => cancelDeal(deal.id));
  }

  async function handleDispute(e) {
    e.preventDefault();
    if (!disputeMsg.trim()) { setError("Please describe the dispute reason"); return; }
    await withTx("Raising dispute…", async () => {
      const c  = await getWriteContract();
      const tx = await c.raiseDispute(deal.id, disputeMsg.trim());
      await tx.wait();
    });
    setShowDispute(false);
    setDisputeMsg("");
  }

  /* ── trigger verification agent via SSE ─────────────── */
  function handleTriggerVerify() {
    if (!wallet) { onConnect?.(); return; }
    setVerifying(true);
    setAgentLogs([]);
    setVerifDone(null);

    const es = new EventSource(`${API}/verify/${deal.id}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          setVerifDone({ success: data.success });
          setVerifying(false);
          es.close();
          // Refresh deal
          const c = getContract();
          c.getDeal(deal.id).then(raw => setDeal(parseDeal(deal.id, raw))).catch(() => {});
        } else if (data.log) {
          setAgentLogs(prev => [...prev, data.log]);
        }
      } catch {}
    };

    es.onerror = () => {
      setAgentLogs(prev => [...prev, "[Connection closed]"]);
      setVerifying(false);
      es.close();
    };
  }

  /* ── loading / error states ──────────────────────────── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-[13px]" style={{ color: T.textDim }}>Loading deal from Ritual Chain…</p>
      </div>
    </div>
  );

  if (!deal) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <div className="rounded-2xl p-8 text-center max-w-sm" style={{ background: T.card, border:`1px solid ${T.border}` }}>
        <p className="text-[15px] font-bold mb-2" style={{ color: T.text }}>Deal not found</p>
        <p className="text-[13px] mb-4" style={{ color: T.textSub }}>{error || "This deal ID doesn't exist on-chain."}</p>
        <Btn onClick={onBack} outline>← Back</Btn>
      </div>
    </div>
  );

  const sStyle   = STATUS_STYLE[st] ?? STATUS_STYLE[0];
  const catIcon  = CATEGORY_ICONS[deal.category]  ?? "📦";
  const catLabel = CATEGORY_LABELS[deal.category] ?? "Unknown";
  const statusLabel = STATUS_LABELS[st] ?? "Unknown";
  const deadlineStr = new Date(deal.deadline).toLocaleString("en-GB",
    { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b"
        style={{ background:"rgba(240,244,242,0.96)", backdropFilter:"blur(16px)", borderColor:T.border }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{ color: T.textSub }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.05)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Marketplace
          </button>
          <div className="h-4 w-px" style={{ background: T.border }}/>
          <span className="text-[13px]" style={{ color: T.textDim }}>Deal #{deal.id}</span>

          {/* live status pill */}
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
            style={{ background:sStyle.bg, border:`1px solid ${sStyle.border}`, color:sStyle.color }}>
            {sStyle.pulse && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background:sStyle.color }}/>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background:sStyle.color }}/>
              </span>
            )}
            {statusLabel}
          </span>

          <div className="ml-auto">
            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background:T.em }}/>
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background:T.em }}/>
                </span>
                <span className="font-mono text-[12px] font-medium" style={{ color:T.em }}>
                  {wallet.slice(0,6)}…{wallet.slice(-4)}
                </span>
              </div>
            ) : (
              <Btn onClick={onConnect} small>Connect Wallet</Btn>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* ══ LEFT — deal info ══════════════════════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* Hero */}
            <div className="rounded-2xl p-6" style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-2xl">{catIcon}</span>
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em }}>
                  {catLabel}
                </span>
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background:sStyle.bg, border:`1px solid ${sStyle.border}`, color:sStyle.color }}>
                  {statusLabel}
                </span>
                {deal.isExpired && !isFinal && (
                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background:T.dangerBg, border:"1px solid #fecdd3", color:T.danger }}>
                    Expired
                  </span>
                )}
              </div>

              <h1 className="text-[22px] font-bold tracking-tight mb-2" style={{ color:T.text }}>
                {deal.intent || `Deal #${deal.id}`}
              </h1>

              {deal.conditionUrl && safeUrl(deal.conditionUrl) && (
                <a href={safeUrl(deal.conditionUrl)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium mb-4 hover:underline"
                  style={{ color:T.em }}>
                  🔗 Condition URL
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["Payment",    `${parseFloat(deal.payment).toFixed(4)} RITUAL`, true],
                  ["Commit Fee", deal.commitFee > 0 ? `${parseFloat(deal.commitFee).toFixed(4)} RITUAL` : "None", false],
                  ["Collateral", deal.collateral ? `${parseFloat(deal.collateral).toFixed(4)} RITUAL` : "None", false],
                ].map(([l, v, hi]) => (
                  <div key={l} className="rounded-xl px-4 py-3" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1" style={{ color:T.textDim }}>{l}</p>
                    <p className="text-[13px] font-semibold" style={{ color: hi ? T.em : T.text }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Deal details */}
            <div className="rounded-2xl px-5 py-1" style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
              <InfoRow label="Deal ID"     value={`#${deal.id}`} mono />
              <InfoRow label="Buyer"       value={deal.buyer ? `${deal.buyer.slice(0,10)}…${deal.buyer.slice(-8)}` : "—"} mono />
              <InfoRow label="Seller"      value={deal.seller ? `${deal.seller.slice(0,10)}…${deal.seller.slice(-8)}` : "Awaiting seller"} mono />
              <InfoRow label="Status"      value={statusLabel} highlight />
              <div className="flex items-center justify-between py-2.5" style={{ borderBottom:`1px solid ${T.border}` }}>
                <span className="text-[12px]" style={{ color:T.textDim }}>Explorer</span>
                <a href={`https://explorer.ritualfoundation.org/address/${deal.buyer}`}
                  target="_blank" rel="noreferrer"
                  className="text-[12px] font-semibold hover:underline"
                  style={{ color:T.em }}>
                  View on Ritual Explorer ↗
                </a>
              </div>
              <InfoRow label="Created"     value={new Date(deal.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} />
              {deal.acceptedAt && <InfoRow label="Accepted" value={new Date(deal.acceptedAt).toLocaleDateString()} />}
              {deal.deliveryProof && (
                <div className="flex items-center justify-between py-2.5" style={{ borderBottom:`1px solid ${T.border}` }}>
                  <span className="text-[12px]" style={{ color:T.textDim }}>Proof URL</span>
                  {safeUrl(deal.deliveryProof) ? (
                    <a href={safeUrl(deal.deliveryProof)} target="_blank" rel="noreferrer"
                      className="text-[12px] font-semibold hover:underline truncate max-w-[200px]"
                      style={{ color:T.em }}>{deal.deliveryProof}</a>
                  ) : (
                    <span className="text-[12px] font-semibold truncate max-w-[200px]"
                      style={{ color:T.textDim }}>{deal.deliveryProof}</span>
                  )}
                </div>
              )}
            </div>

            {/* ── AGENT VERIFICATION TERMINAL ────────────── */}
            {(verifying || agentLogs.length > 0 || verifDone) && (
              <div className="rounded-2xl overflow-hidden" style={{ border:`1px solid ${T.borderS}`, boxShadow:T.shadow }}>
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background:"#0d1117", borderBottom:"1px solid #21262d" }}>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {verifying && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"/>}
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${verifying?"bg-green-400":"bg-gray-500"}`}/>
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-green-400">
                      {verifying ? "agent running…" : verifDone ? (verifDone.success ? "✓ verified" : "✗ failed") : "agent log"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">Ritual Chain · Deal #{deal.id}</span>
                </div>
                <div className="bg-[#0d1117] px-5 py-4 font-mono text-[11px] leading-relaxed text-green-300 max-h-64 overflow-y-auto">
                  {agentLogs.map((line, i) => (
                    <div key={i} className="py-px">
                      <span className="text-gray-600 select-none mr-2">&gt;</span>{line}
                    </div>
                  ))}
                  {verifying && (
                    <div className="py-px animate-pulse">
                      <span className="text-gray-600 select-none mr-2">&gt;</span>
                      <span className="text-green-400">_</span>
                    </div>
                  )}
                  <div ref={logEndRef}/>
                </div>
                {verifDone && (
                  <div className="px-5 py-3"
                    style={{ background: verifDone.success ? T.emBg : T.dangerBg,
                             borderTop:`1px solid ${verifDone.success ? T.emBdr : "#fecdd3"}` }}>
                    <p className="text-[12px] font-semibold"
                      style={{ color: verifDone.success ? T.em : T.danger }}>
                      {verifDone.success
                        ? "✅ Condition verified — funds released to seller"
                        : "❌ Condition not met — buyer will be refunded"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Dispute form */}
            {showDispute && (
              <form onSubmit={handleDispute} className="rounded-2xl p-5 space-y-3"
                style={{ background:T.card, border:`1px solid #fecdd3`, boxShadow:T.shadow }}>
                <p className="text-[14px] font-bold" style={{ color:T.danger }}>⚠ Raise a Dispute</p>
                <p className="text-[12px]" style={{ color:T.textSub }}>
                  Describe what went wrong. Funds stay locked until the dispute is resolved.
                </p>
                <textarea rows={3} value={disputeMsg} onChange={e=>setDisputeMsg(e.target.value)}
                  placeholder="e.g. Seller has not responded in 48h. Proof URL is inaccessible."
                  maxLength={300}
                  className="w-full resize-none rounded-xl border px-4 py-2.5 text-[12px] outline-none"
                  style={{ fontSize: 16, borderColor:"#fecdd3", background:T.dangerBg, color:T.text }}/>
                <div className="flex gap-2">
                  <Btn danger full loading={txPending && txLabel.includes("dispute")}>
                    Submit Dispute
                  </Btn>
                  <Btn outline onClick={()=>setShowDispute(false)}>Cancel</Btn>
                </div>
              </form>
            )}

          </div>

          {/* ══ RIGHT — actions + parties ═════════════════ */}
          <div className="space-y-4">

            {/* Error banner */}
            {error && <Alert type="error"><strong>Error:</strong> {error}</Alert>}

            {/* ── ACTION CARD ────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>

              {/* Price header */}
              <div className="px-5 pt-5 pb-4" style={{ borderBottom:`1px solid ${T.border}` }}>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] mb-0.5" style={{ color:T.textDim }}>
                  Escrow amount
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold tracking-tight" style={{ color:T.text }}>
                    {parseFloat(deal.payment).toFixed(4)}
                  </span>
                  <span className="text-[14px] font-medium" style={{ color:T.textDim }} title="RITUAL is the native token of Ritual Testnet">RITUAL</span>
                </div>
                <p className="mt-1 text-[11px]" style={{ color:T.textDim }}>
                  Locked in escrow on Ritual Chain
                </p>
              </div>

              <div className="px-5 py-5 space-y-2.5">

                {/* ── YOUR ROLE BANNER ── always shown when wallet connected ── */}
                {wallet && deal && (
                  <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                    style={isBuyer
                      ? { background: T.emBg,     border:`1px solid ${T.emBdr}`,    color: T.emMid }
                      : isSeller
                      ? { background: "#eff6ff",   border:"1px solid rgba(29,78,216,0.28)", color:"#1d4ed8" }
                      : { background: T.panel,     border:`1px solid ${T.border}`,  color: T.textDim }}>
                    <span className="text-[11px] font-bold">
                      {isBuyer  ? "🛒 You are the Buyer"
                      : isSeller ? "🔨 You are the Seller"
                      :            "👁 Observer"}
                    </span>
                    {/* Share deal link (shown to buyer or any viewer) */}
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/#deal=${deal.id}`;
                        navigator.clipboard.writeText(url).catch(()=>{});
                        setCopied("share");
                        setTimeout(()=>setCopied(null), 2000);
                      }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: copied==="share" ? T.em : "rgba(0,0,0,0.06)",
                               color: copied==="share" ? "#fff" : "inherit" }}>
                      {copied==="share" ? "✓ Copied!" : "Share Link"}
                    </button>
                  </div>
                )}

                {/* ── NOT CONNECTED ── */}
                {!wallet && (
                  <Btn full onClick={onConnect}>Connect Wallet to Interact</Btn>
                )}

                {/* ── OPEN DEAL ── */}
                {/* Only show Accept Deal to wallets that are NOT the buyer of this deal */}
                {wallet && isOpen && !isBuyer && (
                  <>
                    <Alert>
                      <strong>Seller opportunity:</strong> Accept this deal and lock collateral.
                      Complete the task before the deadline to earn <strong>{parseFloat(deal.payment).toFixed(4)} RITUAL</strong>.
                    </Alert>
                    {deal.requiresCollateral && deal.collateral && (
                      <Alert type="warn">
                        Required collateral: <strong>{parseFloat(deal.collateral).toFixed(4)} RITUAL</strong>
                      </Alert>
                    )}
                    <Btn full loading={txPending && txLabel.includes("Accept")} onClick={handleAccept}>
                      ✅ Accept Deal as Seller
                    </Btn>
                  </>
                )}

                {wallet && isOpen && isNobody && (
                  <Alert>
                    <strong>Looking for a seller</strong> — if you can fulfill this deal, open an OTC room and share the link with the buyer.
                  </Alert>
                )}

                {wallet && isOpen && isBuyer && (
                  <>
                    <Alert>
                      Your deal is live and waiting for a seller. Share the link above to recruit one, or wait for the matching bot to notify sellers automatically.
                    </Alert>
                    <Btn full danger onClick={handleCancel}
                      loading={txPending && txLabel.includes("Cancel")}>
                      Remove Listing
                    </Btn>
                  </>
                )}

                {/* ── ACCEPTED — seller submits delivery ── */}
                {wallet && isAccepted && isSeller && (
                  <>
                    <Alert>
                      You accepted this deal. Complete the work, then submit a proof URL so the agent can verify.
                    </Alert>
                    <form onSubmit={handleSubmitDelivery} className="space-y-2">
                      <input
                        type="url" id="proof-url-input"
                        value={proofUrl}
                        onChange={e=>setProofUrl(e.target.value)}
                        placeholder="https://your-proof-url.com"
                        maxLength={500}
                        className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none"
                        style={{ fontSize: 16, borderColor:T.borderS, background:T.panel, color:T.text }}
                      />
                      <Btn full loading={txPending && txLabel.includes("delivery")}>
                        📤 Submit Delivery Proof
                      </Btn>
                    </form>
                    <Btn outline full onClick={()=>setShowDispute(true)}>Raise Dispute</Btn>
                  </>
                )}

                {wallet && isAccepted && isBuyer && (
                  <>
                    <Alert>
                      Seller has accepted. Waiting for them to complete the work and submit proof.
                    </Alert>
                    <Btn outline full danger onClick={()=>setShowDispute(true)}>Raise Dispute</Btn>
                  </>
                )}

                {wallet && isAccepted && isNobody && (
                  <Alert>This deal has been accepted and is in progress.</Alert>
                )}

                {/* ── PENDING DELIVERY — trigger agent ──── */}
                {wallet && isPending && (isBuyer || isSeller) && !verifying && !verifDone && (
                  <>
                    <Alert>
                      Seller submitted proof. Trigger the verification agent to check the condition on-chain.
                    </Alert>
                    {deal.deliveryProof && safeUrl(deal.deliveryProof) && (
                      <a href={safeUrl(deal.deliveryProof)} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between rounded-xl px-4 py-2.5"
                        style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                        <span className="text-[12px]" style={{ color:T.textDim }}>Proof URL</span>
                        <span className="text-[12px] font-semibold truncate max-w-[140px]"
                          style={{ color:T.em }}>{deal.deliveryProof}</span>
                      </a>
                    )}
                    <Btn full onClick={handleTriggerVerify}>
                      🤖 Trigger Verification Agent
                    </Btn>
                    {/* Manual completion — shown when verifier is unset (address(0)) */}
                    {(!deal.verifier || deal.verifier === "0x0000000000000000000000000000000000000000") && isBuyer && (
                      <div className="rounded-xl p-3" style={{ background: T.warnBg, border:"1px solid #fde68a" }}>
                        <p className="text-[11px] font-semibold mb-2" style={{ color: T.warn }}>
                          Settle this deal manually
                        </p>
                        <p className="text-[10px] mb-2" style={{ color: T.warn }}>
                          This deal uses manual settlement. Once you've confirmed the seller delivered, release their funds — or get a refund if they didn't.
                        </p>
                        <div className="flex gap-2">
                          <Btn small full
                            loading={txPending && txLabel.includes("Complete")}
                            onClick={() => withTx("Completing deal…", () =>
                              executeDeal(deal.id, true, "Buyer confirmed delivery")
                            )}>
                            ✅ Release Funds to Seller
                          </Btn>
                          <Btn small full danger
                            loading={txPending && txLabel.includes("Refund")}
                            onClick={() => withTx("Refunding buyer…", () =>
                              executeDeal(deal.id, false, "Buyer rejected delivery")
                            )}>
                            ❌ Refund Me
                          </Btn>
                        </div>
                      </div>
                    )}
                    {(isBuyer || isSeller) && (
                      <Btn outline full danger onClick={()=>setShowDispute(true)}>Raise Dispute</Btn>
                    )}
                  </>
                )}

                {verifying && (
                  <Alert>
                    <Spinner /> <strong className="ml-2">Agent is verifying…</strong> Check the terminal below.
                  </Alert>
                )}

                {wallet && isPending && isNobody && (
                  <Alert>Delivery submitted. Awaiting verification.</Alert>
                )}

                {/* ── VERIFYING (status 3) ─────────────── */}
                {isVerifying && (
                  <Alert>
                    <span className="inline-flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background:"#9333ea" }}/>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600"/>
                      </span>
                      Verification agent is running…
                    </span>
                  </Alert>
                )}

                {/* ── COMPLETED ────────────────────────── */}
                {isCompleted && (
                  <div className="rounded-xl px-4 py-4 text-center"
                    style={{ background:"#f0fdf4", border:"1px solid #bbf7d0" }}>
                    <p className="text-2xl mb-1">✅</p>
                    <p className="text-[14px] font-bold" style={{ color:"#16a34a" }}>Deal Complete</p>
                    <p className="text-[12px] mt-1" style={{ color:"#166534" }}>
                      Funds released to seller. All parties have been paid.
                    </p>
                  </div>
                )}

                {/* ── FAILED ───────────────────────────── */}
                {isFailed && (
                  <div className="rounded-xl px-4 py-4 text-center"
                    style={{ background:T.dangerBg, border:"1px solid #fecdd3" }}>
                    <p className="text-2xl mb-1">❌</p>
                    <p className="text-[14px] font-bold" style={{ color:T.danger }}>Deal Failed</p>
                    <p className="text-[12px] mt-1" style={{ color:"#991b1b" }}>
                      Condition was not met. Buyer has been refunded.
                    </p>
                  </div>
                )}

                {/* ── DISPUTED ─────────────────────────── */}
                {isDisputed && (
                  <Alert type="warn">
                    <strong>Dispute in progress.</strong> Funds are locked. The Shadow OTC team will review and resolve within 24–48h.
                  </Alert>
                )}

                {/* ── CANCELLED / EXPIRED ──────────────── */}
                {(st === 7 || st === 8) && (
                  <Alert type="warn">
                    This deal was {st === 7 ? "cancelled" : "expired"}. Funds have been returned to the buyer.
                  </Alert>
                )}

                {/* Tx pending overlay */}
                {txPending && (
                  <Alert>
                    <span className="flex items-center gap-2">
                      <Spinner/> {txLabel || "Waiting for confirmation…"}
                    </span>
                  </Alert>
                )}
              </div>
            </div>

            {/* ── PARTIES ────────────────────────────────── */}
            <div className="rounded-2xl p-5" style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color:T.textDim }}>
                Deal Parties
              </p>

              {/* Buyer */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:T.textDim }}>Buyer</p>
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                  style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em }}>
                    {deal.buyer?.slice(2,4).toUpperCase() ?? "??"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-semibold" style={{ color:T.text }}>
                      {deal.buyer ? `${deal.buyer.slice(0,8)}…${deal.buyer.slice(-6)}` : "—"}
                    </p>
                    {isBuyer && <p className="text-[10px]" style={{ color:T.em }}>You</p>}
                  </div>
                  {deal.buyer && (
                    <button onClick={()=>copy(deal.buyer,"buyer")}
                      className="text-[11px] px-3 py-1.5 rounded-lg"
                      style={{ background: copied==="buyer"?T.em:"white",
                               color: copied==="buyer"?"white":T.em,
                               border:`1px solid ${T.emBdr}` }}>
                      {copied==="buyer"?"✓":"Copy"}
                    </button>
                  )}
                </div>
              </div>

              {/* Seller */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:T.textDim }}>Seller</p>
                {deal.seller ? (
                  <>
                    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-2"
                      style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em }}>
                        {deal.seller.slice(2,4).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] font-semibold" style={{ color:T.text }}>
                          {deal.seller.slice(0,8)}…{deal.seller.slice(-6)}
                        </p>
                        {isSeller && <p className="text-[10px]" style={{ color:T.em }}>You</p>}
                      </div>
                      <button onClick={()=>copy(deal.seller,"seller")}
                        className="text-[11px] px-3 py-1.5 rounded-lg"
                        style={{ background: copied==="seller"?T.em:"white",
                                 color: copied==="seller"?"white":T.em,
                                 border:`1px solid ${T.emBdr}` }}>
                        {copied==="seller"?"✓":"Copy"}
                      </button>
                    </div>
                    <ReputationBadge address={deal.seller} compact={false}/>
                  </>
                ) : (
                  <div className="rounded-xl px-3 py-2.5 text-[12px]"
                    style={{ background:T.panel, border:`1px solid ${T.border}`, color:T.textDim }}>
                    No seller yet — deal is open
                  </div>
                )}
              </div>
            </div>

            {/* ── EXPLORER LINK ──────────────────────────── */}
            <a href={`https://explorer.ritualfoundation.org/address/${deal.buyer}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background:T.card, border:`1px solid ${T.border}` }}>
              <span className="text-[12px]" style={{ color:T.textDim }}>View on explorer</span>
              <span className="text-[12px] font-semibold" style={{ color:T.em }}>
                Ritual Explorer ↗
              </span>
            </a>

            {/* ── SAFETY NOTE ────────────────────────────── */}
            <div className="rounded-xl px-4 py-3.5" style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.5} style={{ color:T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                </svg>
                <p className="text-[11px] leading-relaxed" style={{ color:T.emMid }}>
                  All funds are locked in the <strong>ShadowOTCV3</strong> smart contract on Ritual Testnet.
                  Verification is performed autonomously by an agent — no human can override the result.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Sticky mobile action bar ─────────────────────── */}
      {deal && !isFinal && wallet && (isBuyer || isSeller) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden px-4 pb-safe"
          style={{ background: "rgba(240,244,242,0.97)", backdropFilter: "blur(16px)",
                   borderTop: `1px solid ${T.border}`, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="py-3 flex gap-2">
            {isOpen && isBuyer && (
              <Btn full danger loading={txPending} onClick={handleCancel}>Remove Listing</Btn>
            )}
            {isOpen && !isBuyer && (
              <Btn full loading={txPending} onClick={handleAccept}>✅ Accept Deal as Seller</Btn>
            )}
            {isAccepted && isSeller && (
              <Btn full loading={txPending} onClick={() => document.getElementById('proof-url-input')?.focus()}>
                📤 Submit Delivery Proof
              </Btn>
            )}
            {isPending && isBuyer && (
              <Btn full loading={txPending || verifying} onClick={handleTriggerVerify}>
                🤖 Trigger Verification
              </Btn>
            )}
            {isPending && (isBuyer || isSeller) && (
              <Btn outline loading={txPending} onClick={() => setShowDispute(true)}>Dispute</Btn>
            )}
          </div>
        </div>
      )}

      {/* Bottom padding on mobile so sticky bar doesn't cover content */}
      {deal && !isFinal && wallet && (isBuyer || isSeller) && (
        <div className="h-24 sm:hidden" />
      )}
    </div>
  );
}
