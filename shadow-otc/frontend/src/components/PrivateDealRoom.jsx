import { useState, useRef, useEffect } from "react";

const C = {
  pageBg:  "bg-shadow-otc-canvas",
  card:    "#ffffff",
  panel:   "#F3F6F4",
  border:  "rgba(11,107,75,0.18)",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textMid: "#51605A",
  textDim: "#7B8A84",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBr:    "#0D7A56",
  emBg:    "#EAF4EF",
  emBdr:   "rgba(11,107,75,0.30)",
  header:  "linear-gradient(180deg, rgba(230,235,233,0.96) 0%, rgba(221,227,224,0.94) 100%)",
};

const STEPS = [
  { id: "terms",   label: "Set Terms" },
  { id: "review",  label: "Review" },
  { id: "lock",    label: "Lock Funds" },
  { id: "deliver", label: "Deliver" },
  { id: "settle",  label: "Settle" },
];

const CATS = {
  premarket: { label: "Pre-Market", dot: "#7c3aed", bg: "#f5f3ff", border: "rgba(124,58,237,0.18)", text: "#5b21b6" },
  airdrop:   { label: "Airdrop",    dot: "#1d4ed8", bg: "#eff6ff", border: "rgba(29,78,216,0.18)",  text: "#1e40af" },
  nft:       { label: "NFT Deal",   dot: "#6d28d9", bg: "#f5f3ff", border: "rgba(109,40,217,0.18)", text: "#4c1d95" },
  bundle:    { label: "Bundle",     dot: "#475569", bg: "#f8fafc", border: "rgba(71,85,105,0.15)",  text: "#334155" },
};

function Label({ children }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: C.textDim }}>
      {children}
    </p>
  );
}

function Field(props) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
      style={{
        background: "linear-gradient(180deg,#ffffff,#F7F9F8)",
        border: "1px solid rgba(11,107,75,0.18)",
        color: C.text,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.80)",
      }}
      onFocus={e => {
        e.target.style.border = "1px solid #047857";
        e.target.style.boxShadow = "0 0 0 3px rgba(4,120,87,0.10)";
      }}
      onBlur={e => {
        e.target.style.border = "1px solid rgba(11,107,75,0.18)";
        e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.80)";
      }}
    />
  );
}

function FieldArea(props) {
  return (
    <textarea
      {...props}
      className="w-full resize-none rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
      style={{
        background: "linear-gradient(180deg,#ffffff,#F7F9F8)",
        border: "1px solid rgba(11,107,75,0.18)",
        color: C.text,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.80)",
      }}
      onFocus={e => {
        e.target.style.border = "1px solid #047857";
        e.target.style.boxShadow = "0 0 0 3px rgba(4,120,87,0.10)";
      }}
      onBlur={e => {
        e.target.style.border = "1px solid rgba(11,107,75,0.18)";
        e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.80)";
      }}
    />
  );
}

function FieldSelect({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all appearance-none"
      style={{
        background: "linear-gradient(180deg,#ffffff,#F7F9F8)",
        border: "1px solid rgba(11,107,75,0.18)",
        color: C.textSub,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.80)",
      }}
    >
      {children}
    </select>
  );
}

function EmBtn({ onClick, children, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={(full ? "w-full " : "") + "rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"}
      style={{
        background: "linear-gradient(160deg,#047857,#064e3b)",
        boxShadow: "0 4px 12px rgba(11,107,75,0.15)",
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-6 py-3 text-[13px] font-semibold transition-all hover:bg-black/[0.04]"
      style={{ border: "1px solid rgba(0,0,0,0.11)", color: C.textMid }}
    >
      {children}
    </button>
  );
}

function StepBar({ current }) {
  const ci = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done   = i < ci;
        const active = i === ci;
        return (
          <div key={s.id} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all"
                style={done
                  ? { background: C.emMid, border: "1px solid " + C.emBdr, color: "#fff" }
                  : active
                    ? { background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "2px solid " + C.emMid, color: C.emMid }
                    : { background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)", color: C.textDim }
                }
              >
                {done
                  ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )
                  : i + 1
                }
              </div>
              <span
                className="mt-1.5 hidden text-[10px] font-medium sm:block whitespace-nowrap"
                style={{ color: active ? C.textSub : C.textDim }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="mx-2 h-px flex-1 transition-all"
                style={{ background: done ? C.emMid : "rgba(0,0,0,0.10)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Msg({ m }) {
  const isMe = m.from === "me";
  return (
    <div className={"flex " + (isMe ? "justify-end" : "justify-start") + " mb-3"}>
      <div
        className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
        style={isMe
          ? { background: C.emBg, border: "1px solid " + C.emBdr, color: C.em, borderBottomRightRadius: "4px" }
          : { background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)", color: C.textSub, borderBottomLeftRadius: "4px" }
        }
      >
        {m.text}
        <div className="mt-1 text-[10px]" style={{ color: isMe ? C.emMid : C.textDim }}>
          {m.time}
        </div>
      </div>
    </div>
  );
}

function DealSummary({ deal }) {
  const cat = CATS[deal.category] || CATS.bundle;
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
    >
      <div className="px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: C.textDim }}>
          Deal Summary
        </p>
        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold mb-3"
          style={{ background: cat.bg, border: "1px solid " + cat.border, color: cat.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.dot }} />
          {cat.label}
        </div>
        <p className="text-[15px] font-semibold mb-4" style={{ color: deal.asset ? C.text : C.textDim }}>
          {deal.asset || "Asset name..."}
        </p>
        {[
          { label: "Quantity",   value: deal.quantity   || "-" },
          { label: "Vesting",    value: deal.vesting    || "Instant" },
          { label: "Settlement", value: deal.settlement || "AI Auto" },
          { label: "Price",      value: deal.price ? deal.price + " RITUAL" : "-" },
        ].map((r, i) => (
          <div
            key={r.label}
            className="flex items-center justify-between py-2"
            style={{ borderTop: "1px solid rgba(11,107,75,0.12)" }}
          >
            <span className="text-[12px]" style={{ color: C.textDim }}>{r.label}</span>
            <span className="text-[12px] font-semibold" style={{ color: C.textSub }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrivateDealRoom({ wallet, onConnect, onBack, deal: initDeal }) {
  const [step,     setStep]     = useState("terms");
  const [deal,     setDeal]     = useState(initDeal || { category: "premarket" });
  const [msgs,     setMsgs]     = useState([
    { from: "system", text: "Deal room opened. Share the link with your counterparty.", time: "now" },
  ]);
  const [chat,     setChat]     = useState("");
  const [link,     setLink]     = useState("");
  const [copied,   setCopied]   = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    const hash = window.location.hash;
    const id = hash.startsWith("#deal=")
      ? hash.split("=")[1]
      : Math.random().toString(36).slice(2, 10).toUpperCase();
    setLink(window.location.origin + window.location.pathname + "#deal=" + id);
    setDeal(d => ({ ...d, roomId: id }));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function sendMsg() {
    if (!chat.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMsgs(m => [...m, { from: "me", text: chat.trim(), time: now }]);
    setChat("");
  }

  function update(key, val) {
    setDeal(d => ({ ...d, [key]: val }));
  }

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-shadow-otc-canvas">
        <div className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: C.emBg, border: "1px solid " + C.emBdr }}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              style={{ color: C.emMid }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold mb-2" style={{ color: C.text }}>Connect Wallet</h2>
          <p className="text-[13px] mb-6 leading-relaxed" style={{ color: C.textMid }}>
            You need a connected wallet to create or join an OTC Room.
          </p>
          <EmBtn onClick={onConnect} full>Connect Wallet</EmBtn>
          <button onClick={onBack} className="mt-3 w-full text-[12px]"
            style={{ color: C.textDim }}>
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  if (step === "settled") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-shadow-otc-canvas">
        <div className="w-full max-w-md rounded-2xl p-10 text-center"
          style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: C.emBg, border: "1px solid " + C.emBdr }}>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              style={{ color: C.emMid }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: C.emBr }}>
            Deal Settled
          </p>
          <h2 className="mb-2 text-[22px] font-semibold tracking-tight"
            style={{ color: C.text }}>
            Transaction Complete
          </h2>
          <p className="mb-7 text-[13px] leading-relaxed"
            style={{ color: C.textMid }}>
            Funds released by Ritual Chain AI agent. Both parties notified.
          </p>
          <EmBtn onClick={onBack} full>Back to Marketplace</EmBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen antialiased bg-shadow-otc-canvas">

      <header className="sticky top-0 z-30"
        style={{
          background: "linear-gradient(180deg,rgba(230,235,233,0.96),rgba(221,227,224,0.94))",
          backdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(11,107,75,0.18)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.80),0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-black/[0.05]"
              style={{ color: C.textMid }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            <div className="h-4 w-px" style={{ background: "rgba(0,0,0,0.10)" }} />
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded"
                style={{ background: "linear-gradient(135deg,#047857,#064e3b)" }}>
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: C.text }}>Private Deal Room</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: C.emBg, border: "1px solid " + C.emBdr, color: C.em }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.emBr }} />
              Private
            </div>
            <button onClick={onConnect}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all"
              style={{ background: "linear-gradient(160deg,#047857,#064e3b)", boxShadow: "0 2px 8px rgba(4,120,87,0.28)" }}>
              Connect Wallet
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <StepBar current={step} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

          <div className="rounded-2xl p-7"
            style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>

            {step === "terms" && (
              <div>
                <h2 className="mb-6 text-[18px] font-semibold" style={{ color: C.text }}>Set Deal Terms</h2>
                <div className="mb-5">
                  <Label>Category</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(CATS).map(([id, v]) => (
                      <button key={id} onClick={() => update("category", id)}
                        className="rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                        style={deal.category === id
                          ? { background: v.bg, border: "1px solid " + v.border, color: v.text }
                          : { background: "#F3F6F4", border: "1px solid rgba(0,0,0,0.08)", color: C.textMid }
                        }>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Asset Name *</Label>
                    <Field placeholder="e.g. zkSync ZK Allocation" value={deal.asset || ""} onChange={e => update("asset", e.target.value)} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Field placeholder="e.g. 5,000 tokens" value={deal.quantity || ""} onChange={e => update("quantity", e.target.value)} />
                  </div>
                  <div>
                    <Label>Agreed Price (RITUAL) *</Label>
                    <Field type="number" placeholder="0.00" value={deal.price || ""} onChange={e => update("price", e.target.value)} />
                  </div>
                  <div>
                    <Label>Counterparty Wallet</Label>
                    <Field placeholder="0x... (optional)" value={deal.counterparty || ""} onChange={e => update("counterparty", e.target.value)} />
                  </div>
                  <div>
                    <Label>Vesting</Label>
                    <Field placeholder="e.g. 6 months linear" value={deal.vesting || ""} onChange={e => update("vesting", e.target.value)} />
                  </div>
                  <div>
                    <Label>Settlement</Label>
                    <FieldSelect value={deal.settlement || "ai-auto"} onChange={e => update("settlement", e.target.value)}>
                      <option value="ai-auto">AI Auto</option>
                      <option value="manual">Manual</option>
                      <option value="multisig">Multisig</option>
                    </FieldSelect>
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Additional Notes</Label>
                  <FieldArea rows={3} placeholder="Any conditions, proof format, or extra context..." value={deal.notes || ""} onChange={e => update("notes", e.target.value)} />
                </div>
                <div className="mt-5 rounded-xl p-4" style={{ background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.10em] mb-2" style={{ color: C.textDim }}>Private Link</p>
                  <div className="flex gap-2">
                    <input readOnly value={link} className="flex-1 rounded-lg px-3 py-2 text-[12px] outline-none"
                      style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", color: C.textMid }} />
                    <button onClick={copyLink}
                      className="rounded-lg px-4 py-2 text-[12px] font-semibold transition-all"
                      style={copied
                        ? { background: C.emBg, border: "1px solid " + C.emBdr, color: C.em }
                        : { background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", color: C.textSub }
                      }>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <EmBtn onClick={() => setStep("review")} disabled={!deal.asset || !deal.price}>
                    Continue to Review
                  </EmBtn>
                </div>
              </div>
            )}

            {step === "review" && (
              <div>
                <h2 className="mb-6 text-[18px] font-semibold" style={{ color: C.text }}>Review Deal Terms</h2>
                <div className="rounded-xl p-5 mb-6" style={{ background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)" }}>
                  {[
                    { label: "Category",     value: CATS[deal.category]?.label || deal.category },
                    { label: "Asset",        value: deal.asset },
                    { label: "Price",        value: deal.price + " RITUAL" },
                    { label: "Quantity",     value: deal.quantity || "-" },
                    { label: "Vesting",      value: deal.vesting  || "Instant" },
                    { label: "Settlement",   value: deal.settlement || "AI Auto" },
                    { label: "Counterparty", value: deal.counterparty || "Any" },
                  ].map((r, i) => (
                    <div key={r.label} className="flex items-center justify-between py-2.5"
                      style={{ borderBottom: i < 6 ? "1px solid rgba(11,107,75,0.14)" : "none" }}>
                      <span className="text-[12px]" style={{ color: C.textDim }}>{r.label}</span>
                      <span className="text-[13px] font-semibold" style={{ color: C.text }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                {deal.notes && (
                  <div className="rounded-xl p-4 mb-6" style={{ background: C.emBg, border: "1px solid " + C.emBdr }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.10em] mb-1" style={{ color: C.emMid }}>Notes</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: C.textSub }}>{deal.notes}</p>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <GhostBtn onClick={() => setStep("terms")}>Back</GhostBtn>
                  <EmBtn onClick={() => setStep("lock")}>Confirm and Lock Funds</EmBtn>
                </div>
              </div>
            )}

            {step === "lock" && (
              <div>
                <h2 className="mb-2 text-[18px] font-semibold" style={{ color: C.text }}>Lock Funds in Escrow</h2>
                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: C.textMid }}>
                  Funds are held in a TEE-secured escrow on Ritual Chain. Neither party can access them until conditions are met.
                </p>
                <div className="rounded-xl p-5 mb-6 text-center" style={{ background: C.emBg, border: "1px solid " + C.emBdr }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: C.emMid }}>Amount to Lock</p>
                  <p className="text-[32px] font-bold tracking-tight" style={{ color: C.em }}>
                    {deal.price} <span className="text-[16px] font-semibold">RITUAL</span>
                  </p>
                </div>
                <div className="rounded-xl p-4 mb-6" style={{ background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)" }}>
                  <div className="flex items-start gap-3">
                    <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: C.emMid }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <div>
                      <p className="text-[12px] font-semibold mb-0.5" style={{ color: C.textSub }}>Secured by Ritual Chain AI</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>
                        The AI agent verifies delivery before releasing funds. Disputes resolved automatically on-chain.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <GhostBtn onClick={() => setStep("review")}>Back</GhostBtn>
                  <EmBtn onClick={() => setStep("deliver")}>Lock {deal.price} RITUAL</EmBtn>
                </div>
              </div>
            )}

            {step === "deliver" && (
              <div>
                <h2 className="mb-2 text-[18px] font-semibold" style={{ color: C.text }}>Submit Proof of Delivery</h2>
                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: C.textMid }}>
                  Provide a verifiable URL. The Ritual Chain AI agent will verify it on-chain before releasing funds.
                </p>
                <div className="mb-4">
                  <Label>Proof URL *</Label>
                  <Field placeholder="https://..." value={proofUrl} onChange={e => setProofUrl(e.target.value)} />
                </div>
                <div className="rounded-xl p-4 mb-6" style={{ background: C.emBg, border: "1px solid " + C.emBdr }}>
                  <p className="text-[12px] font-semibold mb-2" style={{ color: C.emMid }}>What counts as valid proof?</p>
                  <ul className="space-y-1">
                    {["On-chain transaction hash", "Token transfer confirmation", "Smart contract interaction", "Verifiable API endpoint"].map(item => (
                      <li key={item} className="flex items-center gap-2 text-[12px]" style={{ color: C.textSub }}>
                        <span style={{ color: C.emBr }}>+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 justify-end">
                  <GhostBtn onClick={() => setStep("lock")}>Back</GhostBtn>
                  <EmBtn onClick={() => setStep("settle")} disabled={!proofUrl}>Submit Proof</EmBtn>
                </div>
              </div>
            )}

            {step === "settle" && (
              <div>
                <h2 className="mb-2 text-[18px] font-semibold" style={{ color: C.text }}>AI Settlement in Progress</h2>
                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: C.textMid }}>
                  The Ritual Chain AI agent is verifying your proof. This usually takes 1-3 minutes.
                </p>
                <div className="space-y-3 mb-6">
                  {[
                    { label: "Proof URL fetched",     done: true,  active: false },
                    { label: "Content hash verified", done: true,  active: false },
                    { label: "Chain state confirmed", done: true,  active: false },
                    { label: "Funds releasing...",    done: false, active: true  },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: "#F3F6F4", border: "1px solid rgba(0,0,0,0.08)" }}>
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={s.done
                          ? { background: C.emMid }
                          : s.active
                            ? { background: "transparent", border: "2px solid " + C.emMid }
                            : { background: "transparent", border: "1px solid rgba(0,0,0,0.12)" }
                        }>
                        {s.done && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {s.active && (
                          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.emMid }} />
                        )}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: s.done || s.active ? C.textSub : C.textDim }}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
                <EmBtn onClick={() => setStep("settled")} full>Mark as Settled</EmBtn>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <DealSummary deal={deal} />
            <div className="flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "linear-gradient(180deg,#ffffff,#F7F9F8)", border: "1px solid rgba(11,107,75,0.18)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", minHeight: "320px" }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: "1px solid rgba(11,107,75,0.14)" }}>
                <p className="text-[13px] font-semibold" style={{ color: C.text }}>Deal Chat</p>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textDim }}>E2E Encrypted</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "260px" }}>
                {msgs.map((m, i) => (
                  m.from === "system"
                    ? <div key={i} className="py-2 text-center"><span className="text-[11px]" style={{ color: C.textDim }}>{m.text}</span></div>
                    : <Msg key={i} m={m} />
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center gap-2 px-3 py-3"
                style={{ borderTop: "1px solid rgba(11,107,75,0.14)" }}>
                <input
                  value={chat}
                  onChange={e => setChat(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMsg()}
                  placeholder="Message your counterparty..."
                  className="flex-1 rounded-xl px-3 py-2 text-[13px] outline-none"
                  style={{ background: "#F3F6F4", border: "1px solid rgba(11,107,75,0.18)", color: C.text }}
                />
                <button onClick={sendMsg}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all"
                  style={{ background: "linear-gradient(160deg,#047857,#064e3b)", boxShadow: "0 2px 6px rgba(4,120,87,0.28)" }}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
