import { useState } from "react";
import { createDeal, CATEGORY_LABELS, CATEGORY_ICONS } from "../lib/contract";

/**
 * CreateDeal — 4-step on-chain deal creation wizard.
 *
 * Props:
 *   wallet     string|null   — connected wallet address
 *   onConnect  ()=>void      — prompt wallet connect
 *   onBack     ()=>void      — go back to homepage
 *   onViewDeal (dealId)=>void — navigate to the new deal after creation
 */

/* ─── design tokens ──────────────────────────────────── */
const T = {
  bg:      "#F0F4F2",
  card:    "#ffffff",
  panel:   "#F3F6F4",
  border:  "rgba(11,107,75,0.16)",
  borderS: "rgba(11,107,75,0.28)",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBg:    "#EAF4EF",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textDim: "#7B8A84",
  shadow:  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
};

/* ─── categories for step 1 (most common 6) ─────────── */
// indices match CATEGORY_LABELS from contract.js
const CATEGORY_GRID = [
  { id: 0,  icon: "📣", title: "Social Media",      desc: "Likes, followers, posts, or social deliverables verified by URL check." },
  { id: 2,  icon: "💼", title: "Freelance",          desc: "Dev work, design, writing — verified by delivery URL or live site check." },
  { id: 3,  icon: "🖼️", title: "NFT Transfer",       desc: "NFT delivery, whitelist spot, or collection access." },
  { id: 5,  icon: "🪂", title: "Airdrop",            desc: "Airdrop allocation delivery verified against wallet or claim page." },
  { id: 6,  icon: "🪙", title: "Token Allocation",   desc: "Pre-TGE token deal with on-chain or off-chain delivery proof." },
  { id: 11, icon: "⚡", title: "Conditional",        desc: "Custom condition verified by fetching a URL and checking the response." },
];

/* ─── deadline options ───────────────────────────────── */
const DEADLINE_OPTIONS = [
  { hours: 24,   label: "24 hours" },
  { hours: 72,   label: "3 days"   },
  { hours: 168,  label: "7 days"   },
  { hours: 720,  label: "30 days"  },
];

/* ─── collateral options ─────────────────────────────── */
const COLLATERAL_OPTIONS = [
  { value: 0, label: "None",    desc: "Seller posts no collateral." },
  { value: 1, label: "Partial", desc: "Seller posts partial collateral (set by contract)." },
  { value: 2, label: "Full",    desc: "Seller matches full deal amount as collateral." },
];

/* ─── verification method ────────────────────────────── */
const VERIFY_OPTIONS = [
  { value: 0, label: "HTTP Fetch", desc: "Agent fetches the condition URL and checks the response for your params." },
  { value: 2, label: "Manual",     desc: "Both parties must manually confirm delivery. No automated check." },
];

/* ─── step indicator ─────────────────────────────────── */
const STEP_LABELS = ["Category", "Deal Terms", "Escrow Setup", "Review & Lock"];

function StepBar({ current }) {
  return (
    <div className="flex items-center mb-8">
      {STEP_LABELS.map((label, i) => {
        const idx    = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all"
                style={{
                  border: done || active ? `2px solid ${T.em}` : `2px solid ${T.border}`,
                  background: done ? T.em : active ? T.emBg : "#fff",
                  color: done ? "#fff" : active ? T.em : T.textDim,
                }}>
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : idx}
              </div>
              <span className="mt-1.5 hidden text-[10px] font-medium sm:block whitespace-nowrap"
                style={{ color: active ? T.em : T.textDim }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 transition-colors"
                style={{ background: done ? T.em : T.border }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── shared field components ────────────────────────── */
function FieldLabel({ children, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="text-[13px] font-semibold" style={{ color: T.text }}>
        {children}
        {required && <span className="ml-1" style={{ color: "#dc2626" }}>*</span>}
      </label>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: T.textDim }}>{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", min, step, suffix, ...rest }) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        step={step}
        {...rest}
        className="w-full rounded-xl border bg-white px-4 py-2.5 text-[13px] outline-none transition-all focus:ring-2"
        style={{
          borderColor: T.border,
          color: T.text,
          paddingRight: suffix ? "60px" : undefined,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = T.em;
          e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(11,107,75,0.10)";
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.boxShadow   = "none";
        }}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold pointer-events-none"
          style={{ color: T.textDim }}>{suffix}</span>
      )}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border bg-white px-4 py-2.5 text-[13px] outline-none transition-all"
      style={{ borderColor: T.border, color: T.text }}
      onFocus={e => {
        e.currentTarget.style.borderColor = T.em;
        e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(11,107,75,0.10)";
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.boxShadow   = "none";
      }}
    />
  );
}

function InlineError({ msg, onDismiss }) {
  if (!msg) return null;
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "#FEF2F2", border: "1px solid rgba(220,38,38,0.25)" }}>
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        style={{ color: "#dc2626" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p className="flex-1 text-[12px] font-medium" style={{ color: "#b91c1c" }}>{msg}</p>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color: "#ef4444" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─── review row ─────────────────────────────────────── */
function ReviewRow({ label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between py-3"
      style={{ borderBottom: `1px solid ${T.border}` }}>
      <span className="text-[12px]" style={{ color: T.textSub }}>{label}</span>
      <span className="text-[12px] font-semibold text-right max-w-[60%] break-all"
        style={{ color: highlight ? T.em : T.text }}>{value}</span>
    </div>
  );
}

/* ─── live preview panel ─────────────────────────────── */
function LivePreview({ form }) {
  const catEntry  = CATEGORY_GRID.find(c => c.id === form.category);
  const amount    = parseFloat(form.amountEth || "0");
  const feeRatio  = (form.commitFeePercent || 0) / 100;
  const upfront   = (amount * feeRatio).toFixed(4);
  const remaining = (amount * (1 - feeRatio)).toFixed(4);
  const verifyLabel = VERIFY_OPTIONS.find(v => v.value === form.verificationMethod)?.label ?? "HTTP Fetch";

  return (
    <div className="rounded-2xl overflow-hidden sticky top-20"
      style={{ background: "#0F1412", border: "1px solid rgba(11,107,75,0.25)", boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}>
      <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(11,107,75,0.20)" }}>
        <p className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.88)" }}>Deal Preview</p>
        <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>Updates as you fill in details</p>
      </div>
      <div className="px-5 py-4 space-y-3 font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.70)" }}>
        <div>
          <span style={{ color: "rgba(74,222,128,0.70)" }}>category</span>
          <span style={{ color: "rgba(255,255,255,0.45)" }}> = </span>
          <span>{catEntry ? `${catEntry.icon} ${catEntry.title}` : "—"}</span>
        </div>
        <div>
          <span style={{ color: "rgba(74,222,128,0.70)" }}>verifier</span>
          <span style={{ color: "rgba(255,255,255,0.45)" }}> = </span>
          <span>{verifyLabel}</span>
        </div>
        {form.conditionUrl && (
          <div>
            <span style={{ color: "rgba(74,222,128,0.70)" }}>fetch_url</span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}> = </span>
            <span className="break-all" style={{ color: "#93c5fd" }}>{form.conditionUrl}</span>
          </div>
        )}
        {form.conditionParams && (
          <div>
            <span style={{ color: "rgba(74,222,128,0.70)" }}>condition</span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}> = </span>
            <span>{form.conditionParams}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <div className="flex justify-between mb-1.5">
            <span style={{ color: "rgba(74,222,128,0.70)" }}>funds_locked</span>
            <span className="font-bold" style={{ color: "#fbbf24" }}>{amount.toFixed(4)} RITUAL</span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span style={{ color: "rgba(74,222,128,0.70)" }}>upfront_fee</span>
            <span>{upfront} RITUAL</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "rgba(74,222,128,0.70)" }}>on_complete</span>
            <span style={{ color: "#4ade80" }}>{remaining} RITUAL</span>
          </div>
        </div>
        {form.deadlineHours > 0 && (
          <div>
            <span style={{ color: "rgba(74,222,128,0.70)" }}>expires</span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}> = </span>
            <span>{DEADLINE_OPTIONS.find(d => d.hours === form.deadlineHours)?.label ?? `${form.deadlineHours}h`}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════ */
export default function CreateDeal({ wallet, onConnect, onBack, onViewDeal }) {
  const [step, setStep]           = useState(1);
  const [fieldError, setFieldError] = useState(null);
  const [txPending, setTxPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [txResult, setTxResult]   = useState(null); // { txHash, dealId }
  const [txError, setTxError]     = useState(null);

  const [form, setForm] = useState({
    category:           null,   // int 0-11
    intent:             "",
    conditionUrl:       "",
    conditionParams:    "",
    deadlineHours:      72,
    amountEth:          "",
    commitFeePercent:   10,
    collateral:         0,
    verificationMethod: 0,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── validation ── */
  function validate() {
    if (step === 1) {
      if (form.category === null) return "Please select a category.";
    }
    if (step === 2) {
      if (!form.intent.trim())        return "Please describe what you want done.";
      if (!form.conditionUrl.trim())  return "Please enter the condition URL the agent will check.";
      if (form.deadlineHours <= 0)    return "Please select a deadline.";
    }
    if (step === 3) {
      if (!form.amountEth || parseFloat(form.amountEth) <= 0)
        return "Please enter a valid RITUAL amount to lock.";
    }
    if (step === 4) {
      if (!wallet)    return "Please connect your wallet to continue.";
      if (!confirmed) return "Please confirm the deal terms.";
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    setStep(s => Math.min(s + 1, 4));
  }
  function back() {
    setFieldError(null);
    setTxError(null);
    setStep(s => Math.max(s - 1, 1));
  }

  /* ── on-chain submit ── */
  async function handleLockFunds() {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    setTxError(null);
    setTxPending(true);

    try {
      const result = await createDeal({
        category:           form.category,
        intent:             form.intent,
        conditionUrl:       form.conditionUrl,
        conditionParams:    form.conditionParams || "{}",
        deadlineHours:      form.deadlineHours,
        commitFeePercent:   form.commitFeePercent,
        collateral:         form.collateral,
        verificationMethod: form.verificationMethod,
        amountEth:          form.amountEth,
      });
      setTxResult(result);
    } catch (e) {
      const msg = e?.reason ?? e?.message ?? "Transaction failed";
      setTxError(msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
    } finally {
      setTxPending(false);
    }
  }

  /* ─── success screen ───────────────────────────────── */
  if (txResult) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: T.bg }}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ color: T.em }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-[20px] font-bold mb-2" style={{ color: T.text }}>Funds Locked!</h2>
          <p className="text-[13px] mb-6 leading-relaxed" style={{ color: T.textSub }}>
            Your deal is now live on Ritual Testnet. A seller can accept and the agent verifier will auto-settle.
          </p>

          {txResult.dealId !== null && (
            <div className="mb-4 rounded-xl px-4 py-3 text-left"
              style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: T.textDim }}>Deal ID</p>
              <p className="text-[20px] font-mono font-bold" style={{ color: T.em }}>#{txResult.dealId}</p>
            </div>
          )}

          <div className="mb-6 rounded-xl px-4 py-3 text-left"
            style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: T.textDim }}>Tx Hash</p>
            <a
              href={`https://explorer.ritualchain.org/tx/${txResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-mono break-all hover:underline"
              style={{ color: "#1d4ed8" }}>
              {txResult.txHash}
            </a>
          </div>

          <div className="flex flex-col gap-2.5">
            {txResult.dealId !== null && (
              <button
                onClick={() => onViewDeal?.(txResult.dealId)}
                className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all"
                style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}
                onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
                onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
                View Deal
              </button>
            )}
            <button onClick={onBack}
              className="w-full rounded-xl py-3 text-[13px] font-semibold transition-all"
              style={{ background: "#f7f8fa", border: `1px solid ${T.border}`, color: T.text }}>
              Back to Market
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── main wizard ─────────────────────────────────── */
  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>

      {/* Header */}
      <header className="sticky top-0 z-20"
        style={{
          background: "rgba(240,244,242,0.96)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.80)",
        }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-5">
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all"
            style={{ color: T.textSub }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textSub; }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Cancel
          </button>
          <div className="h-4 w-px" style={{ background: T.border }} />
          <span className="text-[14px] font-semibold" style={{ color: T.text }}>Create Deal</span>
          <span className="text-[11px] ml-auto" style={{ color: T.textDim }}>
            Step {step} of {STEP_LABELS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <StepBar current={step} />
        <InlineError msg={fieldError} onDismiss={() => setFieldError(null)} />

        {/* ─── layout: form left, preview right on step 3 ─── */}
        <div className={step === 3 ? "grid grid-cols-1 lg:grid-cols-5 gap-6" : ""}>

          {/* ══════════════════════════════════════════
              STEP 1 — Category
          ══════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h2 className="text-[20px] font-bold mb-1 tracking-tight" style={{ color: T.text }}>
                What kind of deal?
              </h2>
              <p className="text-[13px] mb-6" style={{ color: T.textSub }}>
                Choose the category that best describes what you need done.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CATEGORY_GRID.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => set("category", cat.id)}
                    className="rounded-2xl p-5 text-left transition-all"
                    style={{
                      border: form.category === cat.id ? `2px solid ${T.em}` : `1px solid ${T.border}`,
                      background: form.category === cat.id ? T.emBg : T.card,
                      boxShadow: form.category === cat.id ? "0 0 0 1px rgba(11,107,75,0.12)" : T.shadow,
                    }}>
                    <div className="text-2xl mb-3">{cat.icon}</div>
                    <p className="text-[13px] font-bold mb-1" style={{ color: T.text }}>{cat.title}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>{cat.desc}</p>
                    {form.category === cat.id && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          style={{ color: T.em }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[10px] font-bold" style={{ color: T.em }}>Selected</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              STEP 2 — Deal Terms
          ══════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h2 className="text-[20px] font-bold mb-1 tracking-tight" style={{ color: T.text }}>Deal Terms</h2>
              <p className="text-[13px] mb-6" style={{ color: T.textSub }}>
                Describe what you want, provide the URL the agent will fetch to verify delivery, and set the deadline.
              </p>

              <div className="space-y-5 rounded-2xl p-5 sm:p-6"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

                {/* Intent */}
                <div>
                  <FieldLabel required hint="Be specific — this is what the seller must deliver.">
                    What do you want done?
                  </FieldLabel>
                  <TextArea
                    rows={3}
                    value={form.intent}
                    onChange={e => set("intent", e.target.value)}
                    placeholder="e.g. Post a tweet mentioning @ShadowOTC with at least 50 likes within 3 days."
                  />
                </div>

                {/* Condition URL */}
                <div>
                  <FieldLabel
                    required
                    hint="The HTTP-fetch agent will GET this URL and inspect the response to verify delivery.">
                    Condition URL
                  </FieldLabel>
                  <TextInput
                    value={form.conditionUrl}
                    onChange={e => set("conditionUrl", e.target.value)}
                    placeholder="https://api.example.com/check/..."
                  />
                </div>

                {/* Condition params */}
                <div>
                  <FieldLabel hint="Depends on category. Use key:value format. Leave blank for manual checks.">
                    Condition Parameters
                  </FieldLabel>

                  {/* Hint chips */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {[
                      "likes: 50",
                      "keyword: ShadowOTC",
                      "followers: 1000",
                      "status: delivered",
                    ].map(h => (
                      <button key={h}
                        onClick={() => set("conditionParams", h)}
                        className="text-[10px] font-mono px-2 py-1 rounded-lg transition-all"
                        style={{ background: T.emBg, border: `1px solid ${T.border}`, color: T.em }}>
                        {h}
                      </button>
                    ))}
                  </div>
                  <TextInput
                    value={form.conditionParams}
                    onChange={e => set("conditionParams", e.target.value)}
                    placeholder='e.g. likes: 50  or  keyword: ShadowOTC'
                  />
                </div>

                {/* Deadline */}
                <div>
                  <FieldLabel required>Deadline</FieldLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DEADLINE_OPTIONS.map(opt => (
                      <button key={opt.hours}
                        onClick={() => set("deadlineHours", opt.hours)}
                        className="rounded-xl py-2.5 text-[13px] font-semibold transition-all"
                        style={{
                          border: form.deadlineHours === opt.hours ? `2px solid ${T.em}` : `1px solid ${T.border}`,
                          background: form.deadlineHours === opt.hours ? T.emBg : "#fff",
                          color: form.deadlineHours === opt.hours ? T.em : T.text,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              STEP 3 — Escrow Setup + Preview
          ══════════════════════════════════════════ */}
          {step === 3 && (
            <>
              {/* Left: form */}
              <div className="lg:col-span-3">
                <h2 className="text-[20px] font-bold mb-1 tracking-tight" style={{ color: T.text }}>Escrow Setup</h2>
                <p className="text-[13px] mb-6" style={{ color: T.textSub }}>
                  Set the amount to lock, commitment fee, collateral from the seller, and verification method.
                </p>

                <div className="space-y-5 rounded-2xl p-5 sm:p-6"
                  style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

                  {/* Amount */}
                  <div>
                    <FieldLabel required hint="This exact amount will be locked in the escrow contract.">
                      Amount to Lock
                    </FieldLabel>
                    <TextInput
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={form.amountEth}
                      onChange={e => set("amountEth", e.target.value)}
                      placeholder="0.1"
                      suffix="RITUAL"
                    />
                  </div>

                  {/* Commit fee */}
                  <div>
                    <FieldLabel hint={`Seller gets ${form.commitFeePercent}% upfront on accept. Remaining ${100 - form.commitFeePercent}% released on verified completion.`}>
                      Commitment Fee: {form.commitFeePercent}%
                    </FieldLabel>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={form.commitFeePercent}
                      onChange={e => set("commitFeePercent", Number(e.target.value))}
                      className="w-full accent-emerald-700 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono mt-1" style={{ color: T.textDim }}>
                      <span>0%</span><span>10%</span><span>15%</span><span>20%</span><span>25%</span><span>30%</span>
                    </div>
                  </div>

                  {/* Collateral */}
                  <div>
                    <FieldLabel hint="Seller's collateral is slashed if they fail to deliver.">
                      Seller Collateral Requirement
                    </FieldLabel>
                    <div className="space-y-2">
                      {COLLATERAL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => set("collateral", opt.value)}
                          className="w-full rounded-xl px-4 py-3 text-left transition-all"
                          style={{
                            border: form.collateral === opt.value ? `2px solid ${T.em}` : `1px solid ${T.border}`,
                            background: form.collateral === opt.value ? T.emBg : "#fff",
                          }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold" style={{ color: T.text }}>{opt.label}</span>
                            {form.collateral === opt.value && (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                style={{ color: T.em }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px]" style={{ color: T.textSub }}>{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Verification method */}
                  <div>
                    <FieldLabel hint="OnChain and Dual verification are not available in this version.">
                      Verification Method
                    </FieldLabel>
                    <div className="space-y-2">
                      {VERIFY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => set("verificationMethod", opt.value)}
                          className="w-full rounded-xl px-4 py-3 text-left transition-all"
                          style={{
                            border: form.verificationMethod === opt.value ? `2px solid ${T.em}` : `1px solid ${T.border}`,
                            background: form.verificationMethod === opt.value ? T.emBg : "#fff",
                          }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold" style={{ color: T.text }}>{opt.label}</span>
                            {form.verificationMethod === opt.value && (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                style={{ color: T.em }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px]" style={{ color: T.textSub }}>{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: live preview */}
              <div className="lg:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textDim }}>
                  Live Preview
                </p>
                <LivePreview form={form} />
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              STEP 4 — Review & Lock
          ══════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <h2 className="text-[20px] font-bold mb-1 tracking-tight" style={{ color: T.text }}>Review & Lock Funds</h2>
              <p className="text-[13px] mb-6" style={{ color: T.textSub }}>
                Confirm everything is correct. Once locked, funds are held by the smart contract until the deal is
                verified or cancelled.
              </p>

              {/* Review card */}
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

                {/* Category header */}
                {form.category !== null && (
                  <div className="flex items-center gap-3 pb-3 mb-1"
                    style={{ borderBottom: `1px solid ${T.border}` }}>
                    <span className="text-2xl">{CATEGORY_GRID.find(c => c.id === form.category)?.icon ?? "📦"}</span>
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: T.text }}>
                        {CATEGORY_LABELS[form.category]}
                      </p>
                      <p className="text-[11px]" style={{ color: T.textDim }}>Category #{form.category}</p>
                    </div>
                  </div>
                )}

                <ReviewRow label="Intent"       value={form.intent || "—"} />
                <ReviewRow label="Condition URL" value={form.conditionUrl || "—"} />
                {form.conditionParams && <ReviewRow label="Condition Params" value={form.conditionParams} />}
                <ReviewRow label="Deadline" value={DEADLINE_OPTIONS.find(d => d.hours === form.deadlineHours)?.label ?? `${form.deadlineHours}h`} />
                <ReviewRow label="Amount to Lock" value={`${form.amountEth} RITUAL`} highlight />
                <ReviewRow label="Commit Fee"     value={`${form.commitFeePercent}%`} />
                <ReviewRow label="Collateral"
                  value={COLLATERAL_OPTIONS.find(c => c.value === form.collateral)?.label ?? "None"} />
                <ReviewRow label="Verification"
                  value={VERIFY_OPTIONS.find(v => v.value === form.verificationMethod)?.label ?? "HTTP Fetch"} />
              </div>

              {/* Wallet guard */}
              {!wallet && (
                <div className="mb-4 flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: "#FFFBEB", border: "1px solid rgba(180,83,9,0.25)" }}>
                  <p className="text-[12px] font-medium" style={{ color: "#92400e" }}>
                    Connect your wallet to lock funds on-chain.
                  </p>
                  <button onClick={onConnect}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-all"
                    style={{ background: "#b45309" }}>
                    Connect
                  </button>
                </div>
              )}

              {/* Connected indicator */}
              {wallet && (
                <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{ background: T.emBg, border: `1px solid ${T.border}` }}>
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ background: "#0D7A56" }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#0D7A56" }} />
                  </span>
                  <p className="text-[12px] font-mono" style={{ color: T.em }}>
                    {wallet.slice(0, 6)}...{wallet.slice(-4)}
                  </p>
                </div>
              )}

              {/* Confirm checkbox */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 mb-4 transition-all select-none"
                style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer"
                  style={{ accentColor: T.em }}
                />
                <span className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>
                  I understand that my funds will be locked in an escrow smart contract.
                  The HTTP-fetch agent will verify delivery automatically — not a human intermediary.
                  If verification fails, I can cancel and reclaim after the deadline.
                </span>
              </label>

              {/* Tx error */}
              {txError && (
                <div className="mb-4 rounded-xl px-4 py-3"
                  style={{ background: "#FEF2F2", border: "1px solid rgba(220,38,38,0.25)" }}>
                  <p className="text-[12px] font-bold mb-1" style={{ color: "#b91c1c" }}>Transaction failed</p>
                  <p className="text-[11px] font-mono break-all" style={{ color: "#dc2626" }}>{txError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Nav buttons ── */}
        <div className={`mt-8 flex items-center ${step > 1 ? "justify-between" : "justify-end"}`}>
          {step > 1 && (
            <button onClick={back}
              disabled={txPending}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all"
              style={{ background: "#fff", border: `1px solid ${T.border}`, color: T.text,
                       opacity: txPending ? 0.5 : 1 }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}

          {step < 4 ? (
            <button onClick={next}
              className="flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: T.em, boxShadow: "0 4px 12px rgba(11,107,75,0.18)" }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              Continue
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleLockFunds}
              disabled={txPending || !wallet || !confirmed}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{
                background: txPending ? "rgba(11,107,75,0.60)" : T.em,
                boxShadow: "0 4px 12px rgba(11,107,75,0.18)",
                opacity: (!wallet || !confirmed) ? 0.5 : 1,
                cursor: (!wallet || !confirmed) ? "not-allowed" : "pointer",
              }}>
              {txPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Locking funds on Ritual Chain...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock Funds &amp; Create Deal
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
