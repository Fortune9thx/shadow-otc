import { useState, useRef, useEffect, useCallback } from "react";
import {
  getContract, parseDeal,
  createDeal as contractCreateDeal,
  acceptDeal  as contractAcceptDeal,
  submitDelivery as contractSubmitDelivery,
  CATEGORY_LABELS, CATEGORY_ICONS,
} from "../lib/contract";
import {
  supabaseConfigured,
  sbGetRoom, sbUpsertRoom, sbAddMessage,
} from "../lib/supabase";
import { ethers } from "ethers";

/* ── constants ───────────────────────────────────────────────── */
const API = import.meta.env.VITE_API_URL || "https://shadow-otc.onrender.com";

/* ── room data layer: Supabase when configured, Render fallback ── */
async function roomGet(roomId) {
  if (supabaseConfigured) {
    const data = await sbGetRoom(roomId);
    return data ?? { exists: false, messages: [] };
  }
  try {
    const res = await fetch(`${API}/rooms/${roomId}`);
    return res.ok ? res.json() : { exists: false, messages: [] };
  } catch { return { exists: false, messages: [] }; }
}

async function roomPut(roomId, patch) {
  if (supabaseConfigured) {
    return sbUpsertRoom(roomId, patch);
  }
  try {
    await fetch(`${API}/rooms/${roomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {}
}

async function roomMsg(roomId, wallet, text) {
  if (supabaseConfigured) {
    return sbAddMessage(roomId, wallet, text);
  }
  try {
    await fetch(`${API}/rooms/${roomId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, text }),
    });
  } catch {}
}

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
  danger:  "#dc2626",
  dangerBg:"#fff1f2",
  warn:    "#b45309",
  warnBg:  "#fefce8",
  shadow:  "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};

/* category → contract index */
const CAT_MAP = { premarket: 7, airdrop: 5, nft: 3, bundle: 10 };
const CAT_LABELS = {
  premarket: { label: "Pre-Market",      icon: "🚀", dot: "#7c3aed", bg: "#f5f3ff", border: "rgba(124,58,237,0.18)", color: "#5b21b6" },
  airdrop:   { label: "Airdrop",         icon: "🪂", dot: "#1d4ed8", bg: "#eff6ff", border: "rgba(29,78,216,0.18)",  color: "#1e40af" },
  nft:       { label: "NFT Deal",        icon: "🖼️", dot: "#6d28d9", bg: "#f5f3ff", border: "rgba(109,40,217,0.18)", color: "#4c1d95" },
  bundle:    { label: "Bundle / Escrow", icon: "🔒", dot: "#475569", bg: "#f8fafc", border: "rgba(71,85,105,0.15)",  color: "#334155" },
};

const STATUS_LABELS = ["Open","Accepted","Pending Delivery","Verifying","Completed","Failed","Disputed","Cancelled","Expired"];
const STATUS_COLOR  = [T.em,"#1d4ed8","#b45309","#7c3aed","#16a34a",T.danger,"#ea580c",T.textDim,T.textDim];

/* ── tiny shared components ──────────────────────────────────── */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

function Btn({ onClick, children, disabled, full, outline, danger, loading, small, type="button" }) {
  const pad  = small ? "px-4 py-2 text-[12px]" : "px-5 py-3 text-[13px]";
  const base = `${full?"w-full":""} flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed`;
  const style = danger
    ? { background: T.dangerBg, border:`1px solid #fecdd3`, color: T.danger }
    : outline
    ? { background:"white", border:`1px solid ${T.borderS}`, color: T.em }
    : { background: T.em, color:"white", boxShadow:"0 2px 10px rgba(11,107,75,0.22)" };
  return (
    <button type={type} onClick={onClick} disabled={disabled||loading} className={`${base} ${pad}`} style={style}>
      {loading ? <Spinner/> : children}
    </button>
  );
}

function Alert({ type="info", children }) {
  const s = type==="error" ? { bg:T.dangerBg, border:"#fecdd3", color:T.danger }
           : type==="warn"  ? { bg:T.warnBg,  border:"#fde68a",  color:T.warn }
           :                  { bg:T.emBg,    border:T.emBdr,    color:T.emMid };
  return (
    <div className="rounded-xl px-4 py-3 text-[12px] leading-relaxed"
      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color:T.textDim }}>{label}</p>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input {...props}
      className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
      style={{ background:"white", border:`1px solid ${T.borderS}`, color:T.text, ...props.style }}
      onFocus={e=>{e.target.style.borderColor="#0B6B4B"; e.target.style.boxShadow="0 0 0 3px rgba(11,107,75,0.10)";}}
      onBlur={e=>{e.target.style.borderColor=T.borderS; e.target.style.boxShadow="none";}}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select {...props}
      className="w-full appearance-none rounded-xl px-4 py-2.5 text-[13px] outline-none"
      style={{ background:"white", border:`1px solid ${T.borderS}`, color:T.text }}>
      {children}
    </select>
  );
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom:`1px solid ${T.border}` }}>
      <span className="text-[12px]" style={{ color:T.textDim }}>{label}</span>
      <span className={`text-[13px] font-semibold ${mono?"font-mono":""}`}
        style={{ color: highlight ? T.em : T.text }}>{value}</span>
    </div>
  );
}

/* ── STEP BAR ────────────────────────────────────────────────── */
const BUYER_STEPS  = ["Terms","Review","Lock Funds","Active","Done"];
const SELLER_STEPS = ["Preview","Accept","Deliver","Verify","Done"];

function StepBar({ steps, current }) {
  const ci = steps.indexOf(current);
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const done   = i < ci;
        const active = i === ci;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                style={done
                  ? { background: T.emMid, border:`1px solid ${T.emBdr}`, color:"#fff" }
                  : active
                  ? { background: T.emBg,  border:`2px solid ${T.em}`,    color: T.em }
                  : { background: T.panel, border:`1px solid ${T.border}`, color: T.textDim }
                }>
                {done ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : i+1}
              </div>
              <span className="mt-1.5 hidden text-[10px] font-medium sm:block whitespace-nowrap"
                style={{ color: active ? T.textSub : T.textDim }}>{label}</span>
            </div>
            {i < steps.length-1 && (
              <div className="mx-2 h-px flex-1 transition-all"
                style={{ background: done ? T.emMid : "rgba(0,0,0,0.10)" }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── CHAT BUBBLE ─────────────────────────────────────────────── */
function ChatBubble({ msg, myWallet }) {
  const isMe = msg.wallet?.toLowerCase() === myWallet?.toLowerCase();
  const isSystem = msg.wallet === "system";
  if (isSystem) return (
    <div className="py-2 text-center">
      <span className="text-[11px] px-3 py-1 rounded-full"
        style={{ background:T.panel, color:T.textDim }}>{msg.text}</span>
    </div>
  );
  return (
    <div className={`flex ${isMe?"justify-end":"justify-start"} mb-2`}>
      {!isMe && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mr-2 mt-0.5 text-[11px] font-bold"
          style={{ background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em }}>
          {msg.wallet?.slice(2,4).toUpperCase() ?? "?"}
        </div>
      )}
      <div className="max-w-[78%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed"
        style={isMe
          ? { background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em, borderBottomRightRadius:4 }
          : { background:T.panel, border:`1px solid ${T.border}`, color:T.textSub, borderBottomLeftRadius:4 }
        }>
        {!isMe && <p className="font-mono text-[11px] mb-0.5" style={{ color:T.textDim }}>{msg.wallet?.slice(0,6)}…{msg.wallet?.slice(-4)}</p>}
        {msg.text}
        <div className="mt-1 text-[11px]" style={{ color: isMe ? T.emMid : T.textDim }}>
          {new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>
    </div>
  );
}

/* ── DEAL SUMMARY PANEL ──────────────────────────────────────── */
function DealSummaryPanel({ deal, chainDeal }) {
  if (!deal) return null;
  const cat = CAT_LABELS[deal.category] || CAT_LABELS.bundle;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
      <div className="px-4 py-3" style={{ borderBottom:`1px solid ${T.border}`, background:T.panel }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color:T.textDim }}>Deal Summary</p>
      </div>
      <div className="px-4 py-4 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{cat.icon}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold"
            style={{ background:cat.bg, border:`1px solid ${cat.border}`, color:cat.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background:cat.dot }}/>
            {cat.label}
          </span>
        </div>
        <p className="text-[14px] font-bold mb-3" style={{ color:T.text }}>{deal.asset || "—"}</p>
        <InfoRow label="Price"    value={`${deal.price || "—"} RITUAL`} highlight />
        <InfoRow label="Quantity" value={deal.quantity || "—"} />
        <InfoRow label="Vesting"  value={deal.vesting  || "Instant"} />
        <InfoRow label="Settlement" value={deal.settlement === "ai-auto" ? "AI Auto" : deal.settlement === "manual" ? "Manual" : deal.settlement || "—"} />
        {chainDeal && (
          <div className="mt-3 pt-3" style={{ borderTop:`1px solid ${T.border}` }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: STATUS_COLOR[chainDeal.status] }}/>
              <span className="text-[12px] font-semibold" style={{ color: STATUS_COLOR[chainDeal.status] }}>
                {STATUS_LABELS[chainDeal.status] ?? "Unknown"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOBBY — entry point: create a new room or join existing
══════════════════════════════════════════════════════════════ */
function OTCLobby({ wallet, onConnect, onBack, onEnterRoom }) {
  const [joinInput, setJoinInput] = useState("");
  const [joinErr,   setJoinErr]   = useState("");

  function handleCreate() {
    const id = Math.random().toString(36).slice(2, 10).toUpperCase();
    onEnterRoom(id);
  }

  function handleJoin() {
    let raw = joinInput.trim();
    // Accept full URLs (shadow-otc.vercel.app/#room=ABC123) or bare IDs (ABC123)
    if (raw.includes("#room=")) raw = raw.split("#room=")[1];
    else if (raw.includes("room=")) raw = raw.split("room=")[1];
    raw = raw.split(/[?&#]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!raw) { setJoinErr("Paste a valid room link or room ID"); return; }
    setJoinErr("");
    onEnterRoom(raw);
  }

  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>
      <header className="sticky top-0 z-30 border-b"
        style={{ background: "rgba(240,244,242,0.96)", backdropFilter: "blur(16px)", borderColor: T.border }}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{ color: T.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div className="h-4 w-px" style={{ background: T.border }}/>
          <span className="text-[13px] font-semibold" style={{ color: T.text }}>Private OTC Rooms</span>
          <div className="ml-auto">
            {wallet ? (
              <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
                style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.em }}/>
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.em }}/>
                </span>
                <span className="font-mono text-[12px] font-medium" style={{ color: T.em }}>
                  {wallet.slice(0,6)}…{wallet.slice(-4)}
                </span>
              </div>
            ) : (
              <Btn small onClick={onConnect}>Connect Wallet</Btn>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, boxShadow: T.shadow }}>
            🔒
          </div>
          <h1 className="text-[26px] font-bold tracking-tight mb-2" style={{ color: T.text }}>
            Private OTC Deal Rooms
          </h1>
          <p className="text-[14px] max-w-md mx-auto leading-relaxed" style={{ color: T.textSub }}>
            Negotiate directly with a counterparty. Funds lock in smart contract escrow — an AI agent auto-settles based on delivery proof.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-2xl overflow-hidden mb-10"
          style={{ border: `1px solid ${T.border}`, background: T.card, boxShadow: T.shadow }}>
          {[
            { n:"01", icon:"🤝", title:"Agree Terms",   desc:"Set asset, price, conditions privately in chat" },
            { n:"02", icon:"🔒", title:"Lock Escrow",   desc:"Buyer locks RITUAL in ShadowOTCV3 smart contract" },
            { n:"03", icon:"📦", title:"Deliver Proof", desc:"Seller submits a verifiable delivery proof URL" },
            { n:"04", icon:"🤖", title:"AI Settles",    desc:"Agent verifies on-chain and releases funds instantly" },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-col gap-2 px-5 py-5"
              style={{ borderRight: i < 3 ? `1px solid ${T.border}` : "none",
                       borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono font-bold" style={{ color: T.textDim }}>{s.n}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className="text-[12px] font-bold" style={{ color: T.text }}>{s.title}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Two action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">

          {/* ── Create New Room ── */}
          <div className="rounded-2xl p-7 flex flex-col"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4 text-xl"
              style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>✨</div>
            <h2 className="text-[16px] font-bold mb-2" style={{ color: T.text }}>Start New Room</h2>
            <p className="text-[13px] leading-relaxed mb-5 flex-1" style={{ color: T.textSub }}>
              Generate a private deal room and send the invite link to your counterparty. You'll set the deal terms and lock funds as the buyer.
            </p>
            <div className="space-y-1.5 mb-6">
              {["You control the deal terms","Share invite link with your seller","Lock funds in escrow when ready"].map(t => (
                <div key={t} className="flex items-center gap-2 text-[12px]" style={{ color: T.textDim }}>
                  <span style={{ color: T.em }}>✓</span> {t}
                </div>
              ))}
            </div>
            {wallet
              ? <Btn full onClick={handleCreate}>✨ Create Private Room</Btn>
              : <Btn full onClick={onConnect}>Connect Wallet to Start</Btn>
            }
          </div>

          {/* ── Join Existing Room ── */}
          <div className="rounded-2xl p-7 flex flex-col"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4 text-xl"
              style={{ background: "#eff6ff", border: "1px solid rgba(29,78,216,0.20)" }}>🔗</div>
            <h2 className="text-[16px] font-bold mb-2" style={{ color: T.text }}>Join Existing Room</h2>
            <p className="text-[13px] leading-relaxed mb-5 flex-1" style={{ color: T.textSub }}>
              Received an invite link from your counterparty? Paste it below to enter their room as the seller.
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: T.textDim }}>
                  Paste Room Link or Room ID
                </p>
                <textarea
                  rows={3}
                  value={joinInput}
                  onChange={e => { setJoinInput(e.target.value); setJoinErr(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleJoin(); } }}
                  placeholder={"Paste room link or ID"}
                  className="w-full resize-none rounded-xl px-4 py-3 text-[12px] font-mono outline-none"
                  style={{ fontSize: 16, background: T.panel, border: `1px solid ${joinErr ? "#fca5a5" : T.borderS}`, color: T.text, lineHeight: 1.6 }}
                />
                {joinErr && <p className="mt-1 text-[11px]" style={{ color: T.danger }}>{joinErr}</p>}
              </div>
              <Btn full outline onClick={handleJoin} disabled={!joinInput.trim()}>
                🔗 Enter Room
              </Btn>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
              <p className="text-[11px] leading-relaxed" style={{ color: T.textDim }}>
                You'll join as the <strong style={{ color: T.textSub }}>seller</strong>. Review the buyer's terms before accepting.
              </p>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="rounded-xl px-5 py-4" style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: T.em }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
            </svg>
            <p className="text-[12px] leading-relaxed" style={{ color: T.emMid }}>
              Rooms are <strong>invite-only</strong> — only parties with the link can participate. All funds secured in <strong>ShadowOTCV3</strong> on Ritual Testnet. The AI agent settles autonomously — no human override possible.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function PrivateDealRoom({ wallet, onConnect, onBack }) {
  /* ── roomId: null shows lobby, string enters the room ─── */
  const [roomId, setRoomId] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#room=")) return hash.split("=")[1];
    return null; // no hash → show lobby
  });

  /* ── ALL hooks must be declared before any conditional return ── */
  const [roomData,   setRoomData]   = useState(null);
  const [chainDeal,  setChainDeal]  = useState(null);
  const [myRole,     setMyRole]     = useState(null);
  const [uiStep,     setUiStep]     = useState("loading");
  const [form,       setForm]       = useState({ category:"premarket", settlement:"ai-auto" });
  const [txPending,  setTxPending]  = useState(false);
  const [txLabel,    setTxLabel]    = useState("");
  const [error,      setError]      = useState(null);
  const [proofUrl,   setProofUrl]   = useState("");
  const [chatInput,  setChatInput]  = useState("");
  const [msgs,       setMsgs]       = useState([
    { wallet:"system", text:"Share the invite link with your counterparty to begin", ts: Date.now() }
  ]);
  const [agentLogs,  setAgentLogs]  = useState([]);
  const [verifying,  setVerifying]  = useState(false);
  const [verifDone,  setVerifDone]  = useState(null);
  const [copied,     setCopied]     = useState(false);
  const chatEndRef       = useRef(null);
  const chatContainerRef = useRef(null);
  const logEndRef        = useRef(null);

  function enterRoom(id) {
    const clean = id.toUpperCase().replace(/[^A-Z0-9]/g, "");
    history.replaceState(null, "", window.location.pathname + "#room=" + clean);
    setRoomId(clean);
    // Reset room state when entering a new room
    setRoomData(null);
    setChainDeal(null);
    setMyRole(null);
    setUiStep("loading");
    setError(null);
    setMsgs([{ wallet:"system", text:`Room #${clean} — Share the link with your counterparty`, ts: Date.now() }]);
  }

  /* ── helpers (safe to define before lobby gate) ─────────── */
  const myWalletLc = wallet?.toLowerCase();

  /* ── fetch chain deal ────────────────────────────────────── */
  const loadChainDeal = useCallback(async (dealId) => {
    if (!dealId) return null;
    try {
      const c   = getContract();
      const raw = await c.getDeal(Number(dealId));
      const d   = parseDeal(Number(dealId), raw);
      setChainDeal(d);
      return d;
    } catch { return null; }
  }, []);

  /* ── resolve uiStep from room + chain data ─────────────── */
  function resolveStep(room, chain, role) {
    if (!role) return "loading";
    if (role === "buyer") {
      if (!room?.deal) return "terms";
      if (!room?.dealId && !chain) return "review";
      const s = chain?.status ?? -1;
      if (s === 0) return "awaiting_accept";
      if (s === 1) return "awaiting_delivery";
      if (s === 2) return "can_verify";
      if (s === 3) return "verifying_chain";
      if (s >= 4)  return "done";
      return "review";
    } else {
      if (!room?.dealId && !chain) return "preview_waiting";
      const s = chain?.status ?? -1;
      if (s === 0)  return "preview_accept";
      if (s === 1)  return "deliver";
      if (s === 2 || s === 3) return "awaiting_verify";
      if (s >= 4)   return "done";
      return "preview_waiting";
    }
  }

  /* ── poll backend room every 5s ──────────────────────────── */
  useEffect(() => {
    if (!roomId) return; // no-op when in lobby
    let cancelled = false;

    async function poll() {
      try {
        const data = await roomGet(roomId);
        if (cancelled) return;

        setRoomData(data);
        if (data.messages?.length) setMsgs(data.messages);

        const w = myWalletLc;
        let role = myRole;
        if (w) {
          if (!data.exists || !data.buyerWallet) {
            role = "buyer";
          } else if (data.buyerWallet?.toLowerCase() === w) {
            role = "buyer";
          } else {
            role = "seller";
          }
          if (role !== myRole) setMyRole(role);
        }

        let chain = chainDeal;
        if (data.dealId && (!chain || chain.id !== Number(data.dealId))) {
          chain = await loadChainDeal(data.dealId);
        } else if (data.dealId && chain) {
          chain = await loadChainDeal(data.dealId);
        }

        if (role && !txPending) {
          const step = resolveStep(data, chain, role);
          if (step !== uiStep) setUiStep(step);
          if (data.deal) setForm(f => ({ ...f, ...data.deal }));
        }
      } catch { /* silent */ }
    }

    poll();
    const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, roomId]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom < 120) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [agentLogs]);

  /* Lobby gate — shown when no roomId (all hooks already declared above) */
  if (!roomId) {
    return <OTCLobby wallet={wallet} onConnect={onConnect} onBack={onBack} onEnterRoom={enterRoom} />;
  }

  const roomLink = `${window.location.origin}${window.location.pathname}#room=${roomId}`;

  function update(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function copyLink() {
    navigator.clipboard.writeText(roomLink).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ── chat ─────────────────────────────────────────────────── */
  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || !wallet) return;
    setChatInput("");
    // Optimistic update
    setMsgs(m => [...m, { wallet, text, ts: Date.now() }]);
    await roomMsg(roomId, wallet, text);
  }

  /* ── BUYER: save terms ───────────────────────────────────── */
  async function handleSaveTerms() {
    if (!form.asset || !form.price) { setError("Asset name and price are required"); return; }
    setError(null);
    try {
      await roomPut(roomId, { buyerWallet: wallet, deal: form });
      await roomMsg(roomId, "system", `Buyer set terms: ${form.asset} for ${form.price} RITUAL`);
      setRoomData(r => ({ ...r, exists: true, buyerWallet: wallet, deal: form }));
      setMyRole("buyer");
      setUiStep("review");
    } catch (e) { setError("Failed to save terms: " + e.message); }
  }

  /* ── BUYER: lock funds (createDeal) ─────────────────────── */
  async function handleLockFunds() {
    if (!wallet) { onConnect?.(); return; }
    setError(null);
    setTxPending(true);
    setTxLabel("Locking funds in escrow…");
    try {
      const catId = CAT_MAP[form.category] ?? 7;
      const { dealId } = await contractCreateDeal({
        category:           catId,
        intent:             `${form.asset}${form.notes ? " — " + form.notes : ""}`,
        conditionUrl:       form.conditionUrl || "",
        conditionParams:    "{}",
        deadlineHours:      Number(form.deadlineHours) || 168,
        commitFeePercent:   0,
        collateral:         0,
        verificationMethod: form.settlement === "ai-auto" ? 0 : 2,
        amountEth:          String(form.price),
      });
      await roomPut(roomId, { dealId, status: "active" });
      await roomMsg(roomId, "system", `🔒 Funds locked! Deal #${dealId} created on Ritual Chain.`);
      const chain = await loadChainDeal(dealId);
      setUiStep(resolveStep({ ...roomData, dealId }, chain, "buyer"));
    } catch (e) {
      if (e?.code !== 4001) setError(e?.reason || e?.message || "Transaction failed");
    } finally {
      setTxPending(false);
      setTxLabel("");
    }
  }

  /* ── SELLER: accept deal ─────────────────────────────────── */
  async function handleAccept() {
    if (!wallet) { onConnect?.(); return; }
    setError(null);
    setTxPending(true);
    setTxLabel("Accepting deal…");
    try {
      const collateralEth = chainDeal?.requiresCollateral && chainDeal?.collateral
        ? chainDeal.collateral : "0";
      await contractAcceptDeal(chainDeal.id, collateralEth);
      await roomMsg(roomId, "system", `✅ Seller accepted Deal #${chainDeal.id}. Complete the work and submit proof.`);
      const chain = await loadChainDeal(chainDeal.id);
      setUiStep(resolveStep(roomData, chain, "seller"));
    } catch (e) {
      if (e?.code !== 4001) setError(e?.reason || e?.message || "Transaction failed");
    } finally {
      setTxPending(false);
      setTxLabel("");
    }
  }

  /* ── SELLER: submit delivery ─────────────────────────────── */
  async function handleSubmitDelivery(e) {
    e?.preventDefault();
    if (!proofUrl.trim()) { setError("Please enter a proof URL"); return; }
    if (!wallet) { onConnect?.(); return; }
    setError(null);
    setTxPending(true);
    setTxLabel("Submitting delivery proof…");
    try {
      await contractSubmitDelivery(chainDeal.id, proofUrl.trim());
      await roomMsg(roomId, "system", `📦 Proof submitted for Deal #${chainDeal.id}. Awaiting verification.`);
      const chain = await loadChainDeal(chainDeal.id);
      setUiStep(resolveStep(roomData, chain, "seller"));
      setProofUrl("");
    } catch (e) {
      if (e?.code !== 4001) setError(e?.reason || e?.message || "Transaction failed");
    } finally {
      setTxPending(false);
      setTxLabel("");
    }
  }

  /* ── BUYER: trigger verification agent ───────────────────── */
  function handleTriggerVerify() {
    if (!chainDeal?.id) return;
    setVerifying(true);
    setAgentLogs([]);
    setVerifDone(null);

    const es = new EventSource(`${API}/verify/${chainDeal.id}`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          setVerifDone({ success: data.success });
          setVerifying(false);
          es.close();
          loadChainDeal(chainDeal.id).then(chain => {
            setUiStep(resolveStep(roomData, chain, myRole));
          });
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

  /* ── wallet gate ─────────────────────────────────────────── */
  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ background: T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color:T.emMid }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold mb-2" style={{ color:T.text }}>Connect Wallet</h2>
          <p className="text-[13px] mb-6 leading-relaxed" style={{ color:T.textSub }}>
            Connect your wallet to create or join a Private OTC Room.
          </p>
          <Btn onClick={onConnect} full>Connect Wallet</Btn>
          <button onClick={onBack} className="mt-3 w-full text-[12px]" style={{ color:T.textDim }}>
            ← Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  /* ── derive display step labels ──────────────────────────── */
  const steps     = myRole === "seller" ? SELLER_STEPS : BUYER_STEPS;
  const stepIndex = {
    // buyer
    terms:"Terms", review:"Review", locking:"Lock Funds",
    awaiting_accept:"Active", awaiting_delivery:"Active", can_verify:"Active",
    verifying_chain:"Active", done:"Done",
    // seller
    preview_waiting:"Preview", preview_accept:"Accept", deliver:"Deliver",
    awaiting_verify:"Verify",
  };
  const currentStepLabel = stepIndex[uiStep] ?? (myRole === "buyer" ? "Terms" : "Preview");

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen antialiased" style={{ background:T.bg }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b"
        style={{ background:"rgba(240,244,242,0.96)", backdropFilter:"blur(16px)", borderColor:T.border }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
              style={{ color:T.textSub }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.05)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <div className="h-4 w-px" style={{ background:T.border }}/>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded text-white text-[10px]"
                style={{ background:"linear-gradient(135deg,#047857,#064e3b)" }}>🔒</div>
              <span className="text-[13px] font-semibold" style={{ color:T.text }}>Private Deal Room</span>
              <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ background:T.emBg, border:`1px solid ${T.emBdr}`, color:T.em }}>
                #{roomId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {myRole && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: myRole==="buyer" ? T.emBg : "#eff6ff",
                         border:`1px solid ${myRole==="buyer" ? T.emBdr : "#bfdbfe"}`,
                         color: myRole==="buyer" ? T.em : "#1d4ed8" }}>
                {myRole === "buyer" ? "🛒 Buyer" : "🔨 Seller"}
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
              style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background:T.em }}/>
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background:T.em }}/>
              </span>
              <span className="font-mono text-[12px] font-medium" style={{ color:T.em }}>
                {wallet.slice(0,6)}…{wallet.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {uiStep !== "loading" && (
          <StepBar steps={steps} current={currentStepLabel} />
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">

          {/* ══ LEFT PANEL ══════════════════════════════════ */}
          <div className="space-y-4">

            {error && <Alert type="error"><strong>Error:</strong> {error}</Alert>}
            {txPending && (
              <Alert><span className="flex items-center gap-2"><Spinner/> {txLabel}</span></Alert>
            )}

            {/* LOADING */}
            {uiStep === "loading" && (
              <div className="rounded-2xl p-10 flex items-center justify-center"
                style={{ background:T.card, border:`1px solid ${T.border}` }}>
                <div className="flex flex-col items-center gap-3">
                  <Spinner/>
                  <p className="text-[13px]" style={{ color:T.textDim }}>Loading room…</p>
                </div>
              </div>
            )}

            {/* ── BUYER: TERMS FORM ──────────────────────── */}
            {uiStep === "terms" && (
              <div className="rounded-2xl p-6 space-y-5"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Set Deal Terms</h2>

                {/* Category */}
                <Field label="Category">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(CAT_LABELS).map(([id, v]) => (
                      <button key={id} type="button" onClick={() => update("category", id)}
                        className="rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-all flex items-center gap-1.5"
                        style={form.category === id
                          ? { background:v.bg, border:`1px solid ${v.border}`, color:v.color }
                          : { background:T.panel, border:`1px solid ${T.border}`, color:T.textSub }
                        }>
                        <span>{v.icon}</span> {v.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Asset Name *">
                    <Input placeholder="e.g. zkSync ZK Allocation" value={form.asset||""} onChange={e=>update("asset",e.target.value)}/>
                  </Field>
                  <Field label="Quantity">
                    <Input placeholder="e.g. 5,000 tokens" value={form.quantity||""} onChange={e=>update("quantity",e.target.value)}/>
                  </Field>
                  <Field label="Price (RITUAL) *">
                    <Input type="number" min="0" step="0.001" placeholder="0.000" value={form.price||""} onChange={e=>update("price",e.target.value)}/>
                  </Field>
                  <Field label="Counterparty Wallet">
                    <Input placeholder="0x… (optional)" value={form.counterparty||""} onChange={e=>update("counterparty",e.target.value)}/>
                  </Field>
                  <Field label="Vesting">
                    <Input placeholder="e.g. 6 months linear" value={form.vesting||""} onChange={e=>update("vesting",e.target.value)}/>
                  </Field>
                  <Field label="Deadline">
                    <Select value={form.deadlineHours||"168"} onChange={e=>update("deadlineHours",e.target.value)}>
                      <option value="24">24 hours</option>
                      <option value="72">3 days</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </Select>
                  </Field>
                  <Field label="Settlement">
                    <Select value={form.settlement||"ai-auto"} onChange={e=>update("settlement",e.target.value)}>
                      <option value="ai-auto">AI Auto (HTTP-fetch agent)</option>
                      <option value="manual">Manual (both parties confirm)</option>
                    </Select>
                  </Field>
                  {form.settlement === "ai-auto" && (
                    <Field label="Condition URL">
                      <Input placeholder="https://… (agent will fetch to verify)" value={form.conditionUrl||""} onChange={e=>update("conditionUrl",e.target.value)}/>
                    </Field>
                  )}
                </div>

                <Field label="Notes">
                  <textarea rows={3} value={form.notes||""} onChange={e=>update("notes",e.target.value)}
                    placeholder="Conditions, proof format, extra context…"
                    className="w-full resize-none rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
                    style={{ background:"white", border:`1px solid ${T.borderS}`, color:T.text }}
                  />
                </Field>

                {/* Share link */}
                <div className="rounded-xl p-4" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color:T.textDim }}>Invite Link</p>
                  <div className="flex gap-2">
                    <input readOnly value={roomLink}
                      className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono outline-none"
                      style={{ background:"white", border:`1px solid ${T.border}`, color:T.textSub }}
                    />
                    <button onClick={copyLink}
                      className="rounded-lg px-4 py-2 text-[12px] font-semibold transition-all"
                      style={{ background: copied ? T.em : "white", border:`1px solid ${T.borderS}`,
                               color: copied ? "white" : T.em }}>
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Btn onClick={handleSaveTerms} disabled={!form.asset||!form.price}>
                    Save Terms &amp; Continue →
                  </Btn>
                </div>
              </div>
            )}

            {/* ── BUYER: REVIEW ──────────────────────────── */}
            {uiStep === "review" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Review &amp; Lock Funds</h2>
                <div className="rounded-xl px-4 py-1" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                  {[
                    ["Category",     CAT_LABELS[form.category]?.label || form.category],
                    ["Asset",        form.asset],
                    ["Price",        `${form.price} RITUAL`],
                    ["Quantity",     form.quantity || "—"],
                    ["Vesting",      form.vesting  || "Instant"],
                    ["Settlement",   form.settlement === "ai-auto" ? "AI Auto" : "Manual"],
                    ["Deadline",     `${form.deadlineHours||168} hours`],
                    ["Counterparty", form.counterparty || "Any"],
                  ].map(([l,v]) => <InfoRow key={l} label={l} value={v}/>)}
                </div>
                {form.notes && (
                  <Alert>{form.notes}</Alert>
                )}
                <div className="rounded-xl p-5 text-center" style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color:T.emMid }}>Locking in escrow</p>
                  <p className="text-[30px] font-bold tracking-tight" style={{ color:T.em }}>
                    {form.price} <span className="text-[16px] font-medium">RITUAL</span>
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color:T.emMid }}>Held on Ritual Chain until conditions are met</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Btn outline onClick={() => setUiStep("terms")}>← Edit Terms</Btn>
                  <Btn onClick={handleLockFunds} loading={txPending} disabled={txPending}>
                    🔒 Lock {form.price} RITUAL
                  </Btn>
                </div>
              </div>
            )}

            {/* ── BUYER: WAITING FOR SELLER TO ACCEPT ────── */}
            {uiStep === "awaiting_accept" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background:T.em }}/>
                    <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background:T.em }}/>
                  </div>
                  <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Waiting for Seller</h2>
                </div>
                <Alert>
                  ✅ <strong>Deal #{chainDeal?.id} is live!</strong> Share the room link with your seller. They'll see the terms and can accept the deal.
                </Alert>
                <div className="rounded-xl p-4" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color:T.textDim }}>Share with seller</p>
                  <div className="flex gap-2">
                    <input readOnly value={roomLink}
                      className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono outline-none"
                      style={{ background:"white", border:`1px solid ${T.border}`, color:T.textSub }}
                    />
                    <button onClick={copyLink}
                      className="rounded-lg px-4 py-2 text-[12px] font-semibold transition-all"
                      style={{ background: copied ? T.em : "white", border:`1px solid ${T.borderS}`, color: copied ? "white" : T.em }}>
                      {copied ? "✓ Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>
                {chainDeal && <InfoRow label="On-chain Deal ID" value={`#${chainDeal.id}`} mono highlight/>}
              </div>
            )}

            {/* ── BUYER: SELLER ACCEPTED, WAITING DELIVERY ─ */}
            {uiStep === "awaiting_delivery" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Seller Accepted</h2>
                <Alert>
                  🤝 Seller accepted Deal #{chainDeal?.id} and posted collateral. Waiting for them to complete the work and submit delivery proof.
                </Alert>
                {chainDeal?.seller && <InfoRow label="Seller" value={`${chainDeal.seller.slice(0,10)}…${chainDeal.seller.slice(-8)}`} mono/>}
              </div>
            )}

            {/* ── BUYER: PROOF SUBMITTED, CAN VERIFY ─────── */}
            {uiStep === "can_verify" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Proof Submitted</h2>
                <Alert>
                  📦 Seller submitted delivery proof. Click below to trigger the AI verification agent.
                </Alert>
                {chainDeal?.deliveryProof && (
                  <a href={chainDeal.deliveryProof} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                    <span className="text-[12px]" style={{ color:T.textDim }}>Proof URL</span>
                    <span className="text-[12px] font-semibold truncate max-w-[220px]" style={{ color:T.em }}>
                      {chainDeal.deliveryProof}
                    </span>
                  </a>
                )}
                <Btn full onClick={handleTriggerVerify} disabled={verifying}>
                  🤖 Trigger Verification Agent
                </Btn>
              </div>
            )}

            {/* ── AGENT TERMINAL (buyer when verifying) ──── */}
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
                  <span className="text-[10px] font-mono text-gray-500">Deal #{chainDeal?.id}</span>
                </div>
                <div className="bg-[#0d1117] px-5 py-4 font-mono text-[11px] leading-relaxed text-green-300 max-h-64 overflow-y-auto">
                  {agentLogs.map((line, i) => (
                    <div key={i} className="py-px">
                      <span className="text-gray-600 select-none mr-2">&gt;</span>{line}
                    </div>
                  ))}
                  {verifying && <div className="py-px animate-pulse"><span className="text-gray-600 mr-2">&gt;</span><span className="text-green-400">_</span></div>}
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

            {/* ── SELLER: PREVIEW / WAITING FOR DEAL ─────── */}
            {uiStep === "preview_waiting" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>You're in the Room</h2>
                {roomData?.deal ? (
                  <>
                    <Alert>Buyer has set the terms. Waiting for them to lock funds in escrow. Once locked, you can accept.</Alert>
                    <div className="rounded-xl px-4 py-1" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                      {[
                        ["Asset",      roomData.deal.asset],
                        ["Price",      `${roomData.deal.price} RITUAL`],
                        ["Quantity",   roomData.deal.quantity || "—"],
                        ["Vesting",    roomData.deal.vesting  || "Instant"],
                        ["Settlement", roomData.deal.settlement === "ai-auto" ? "AI Auto" : "Manual"],
                      ].map(([l,v]) => <InfoRow key={l} label={l} value={v}/>)}
                    </div>
                  </>
                ) : (
                  <Alert>
                    <div className="flex items-center gap-2">
                      <Spinner/> Waiting for buyer to set deal terms…
                    </div>
                  </Alert>
                )}
              </div>
            )}

            {/* ── SELLER: ACCEPT DEAL ─────────────────────── */}
            {uiStep === "preview_accept" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Accept This Deal</h2>
                <Alert>
                  🔒 Buyer locked funds in escrow. Review the terms below, then accept to begin the deal.
                </Alert>
                <div className="rounded-xl px-4 py-1" style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                  {chainDeal && [
                    ["Deal ID",   `#${chainDeal.id}`],
                    ["Amount",    `${parseFloat(chainDeal.payment).toFixed(4)} RITUAL`],
                    ["Intent",    chainDeal.intent],
                    ["Deadline",  new Date(chainDeal.deadline).toLocaleDateString()],
                    ["Collateral", chainDeal.requiresCollateral ? `${parseFloat(chainDeal.collateral||"0").toFixed(4)} RITUAL` : "None required"],
                  ].map(([l,v]) => <InfoRow key={l} label={l} value={v}/>)}
                </div>
                {chainDeal?.requiresCollateral && chainDeal?.collateral && parseFloat(chainDeal.collateral) > 0 && (
                  <Alert type="warn">
                    You must post <strong>{parseFloat(chainDeal.collateral).toFixed(4)} RITUAL</strong> collateral to accept this deal.
                  </Alert>
                )}
                <Btn full onClick={handleAccept} loading={txPending} disabled={txPending}>
                  ✅ Accept Deal as Seller
                </Btn>
              </div>
            )}

            {/* ── SELLER: SUBMIT DELIVERY ─────────────────── */}
            {uiStep === "deliver" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Submit Delivery Proof</h2>
                <Alert>
                  You accepted Deal #{chainDeal?.id}. Complete the work, then submit a verifiable proof URL so the agent can confirm delivery.
                </Alert>
                <div className="space-y-3">
                  <Alert type="info">
                    <p className="font-semibold mb-1">What counts as valid proof?</p>
                    <ul className="space-y-0.5 text-[11px]">
                      {["On-chain transaction hash", "Token transfer confirmation", "Smart contract interaction URL", "Verifiable API endpoint"].map(i => (
                        <li key={i} className="flex items-center gap-1.5"><span style={{ color:T.em }}>+</span>{i}</li>
                      ))}
                    </ul>
                  </Alert>
                  <form onSubmit={handleSubmitDelivery} className="space-y-3">
                    <Field label="Proof URL *">
                      <Input type="url" placeholder="https://…" value={proofUrl} onChange={e=>setProofUrl(e.target.value)}/>
                    </Field>
                    <Btn type="submit" full loading={txPending} disabled={txPending||!proofUrl}>
                      📤 Submit Delivery Proof
                    </Btn>
                  </form>
                </div>
              </div>
            )}

            {/* ── SELLER: WAITING FOR VERIFICATION ────────── */}
            {uiStep === "awaiting_verify" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <h2 className="text-[18px] font-bold" style={{ color:T.text }}>Proof Submitted</h2>
                <Alert>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background:"#7c3aed" }}/>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600"/>
                    </span>
                    <strong>Verification in progress.</strong> The AI agent is checking your delivery. Funds will be released automatically upon confirmation.
                  </div>
                </Alert>
                {chainDeal?.deliveryProof && (
                  <a href={chainDeal.deliveryProof} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background:T.panel, border:`1px solid ${T.border}` }}>
                    <span className="text-[12px]" style={{ color:T.textDim }}>Your proof URL</span>
                    <span className="text-[12px] font-semibold" style={{ color:T.em }}>View ↗</span>
                  </a>
                )}
              </div>
            )}

            {/* ── BOTH: CHAIN STATUS 3 (VERIFYING ON-CHAIN) */}
            {uiStep === "verifying_chain" && (
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                <Alert>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background:"#9333ea" }}/>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600"/>
                    </span>
                    Verification agent is running on Ritual Chain…
                  </div>
                </Alert>
              </div>
            )}

            {/* ── BOTH: DONE ───────────────────────────────── */}
            {uiStep === "done" && (
              <div className="rounded-2xl p-8 text-center"
                style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
                {chainDeal?.status === 4 ? (
                  <>
                    <p className="text-4xl mb-4">✅</p>
                    <h2 className="text-[20px] font-bold mb-2" style={{ color:"#16a34a" }}>Deal Complete</h2>
                    <p className="text-[13px] mb-6" style={{ color:T.textSub }}>
                      Funds released to seller. All parties have been paid.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-4">❌</p>
                    <h2 className="text-[20px] font-bold mb-2" style={{ color:T.danger }}>
                      {chainDeal?.status === 5 ? "Deal Failed" : chainDeal?.status === 7 ? "Deal Cancelled" : "Deal Ended"}
                    </h2>
                    <p className="text-[13px] mb-6" style={{ color:T.textSub }}>
                      {chainDeal?.status === 5 ? "Condition not met — buyer refunded." : "Deal was cancelled."}
                    </p>
                  </>
                )}
                <Btn outline onClick={onBack}>← Back to Marketplace</Btn>
              </div>
            )}
          </div>

          {/* ══ RIGHT PANEL ═════════════════════════════════ */}
          <div className="space-y-4">

            {/* Deal summary */}
            <DealSummaryPanel
              deal={form.asset ? form : roomData?.deal}
              chainDeal={chainDeal}
            />

            {/* On-chain deal link */}
            {chainDeal && (
              <a href={`https://explorer.ritualfoundation.org/address/${chainDeal.buyer}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background:T.card, border:`1px solid ${T.border}` }}>
                <span className="text-[12px]" style={{ color:T.textDim }}>Deal #{chainDeal.id} on Explorer</span>
                <span className="text-[12px] font-semibold" style={{ color:T.em }}>View ↗</span>
              </a>
            )}

            {/* ── CHAT ─────────────────────────────────────── */}
            <div className="flex flex-col rounded-2xl overflow-hidden"
              style={{ background:T.card, border:`1px solid ${T.border}`, boxShadow:T.shadow }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom:`1px solid ${T.border}` }}>
                <p className="text-[13px] font-semibold" style={{ color:T.text }}>Deal Chat</p>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background:T.emBg, color:T.em }}>Live</span>
              </div>
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3" style={{ maxHeight:300, minHeight:120 }}>
                {msgs.map((m, i) => (
                  <ChatBubble key={i} msg={m} myWallet={wallet}/>
                ))}
                <div ref={chatEndRef}/>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5"
                style={{ borderTop:`1px solid ${T.border}` }}>
                <input
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }}
                  placeholder="Message counterparty…"
                  className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none"
                  style={{ fontSize: 16, background:T.panel, border:`1px solid ${T.border}`, color:T.text }}
                />
                <button onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                  style={{ background:T.em }}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Safety note */}
            <div className="rounded-xl px-4 py-3.5" style={{ background:T.emBg, border:`1px solid ${T.emBdr}` }}>
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color:T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                </svg>
                <p className="text-[11px] leading-relaxed" style={{ color:T.emMid }}>
                  All funds locked in <strong>ShadowOTCV3</strong> on Ritual Testnet. The AI agent verifies delivery autonomously — no human can override.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
