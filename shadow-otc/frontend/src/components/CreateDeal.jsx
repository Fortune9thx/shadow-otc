import { useState } from "react";

/**
 * CreateDeal, 5-step wizard.
 *
 * Props:
 *   wallet     string|null
 *   onConnect  ()=>void
 *   onBack     ()=>void
 *   onSubmit   (listing)=>void
 */

const CATEGORIES = [
  {
    id: "premarket",
    icon: "🚀",
    title: "Pre-Market",
    desc: "Token allocations, SAFTs, vesting tokens before TGE",
  },
  {
    id: "airdrop",
    icon: "🪂",
    title: "Airdrop / Points",
    desc: "Airdrop allocations, farming points, protocol rights",
  },
  {
    id: "nft",
    icon: "🖼️",
    title: "NFT Deal",
    desc: "OTC NFT trades and whitelist spots",
  },
  {
    id: "bundle",
    icon: "📦",
    title: "Bundle",
    desc: "Mixed assets, tokens, NFTs, and rights together",
  },
];

const VESTING_OPTIONS = [
  { value: "",                label: "No vesting, instant transfer" },
  { value: "cliff3",          label: "3-month cliff" },
  { value: "6mo linear",      label: "6 months linear" },
  { value: "12mo linear",     label: "12 months linear" },
  { value: "cliff6-12linear", label: "6mo cliff + 12mo linear" },
];

const SETTLEMENT_OPTIONS = [
  { value: "auto",   label: "AI Auto (recommended)", desc: "Ritual TEE picks the right verification method" },
  { value: "wallet", label: "Wallet receipt",         desc: "On-chain token transfer proof" },
  { value: "manual", label: "Manual confirm",         desc: "Both parties confirm manually" },
];

const STEPS = [
  "Category",
  "Asset Details",
  "Price & Discount",
  "Vesting & Terms",
  "Review",
];

function StepIndicator({ current }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const done    = idx < current;
        const active  = idx === current;
        const pending = idx > current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                  done    ? "border-slate-900 bg-slate-900 text-white"
                  : active  ? "border-slate-900 bg-white text-slate-900"
                  : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : idx}
              </div>
              <span className={`mt-1.5 hidden text-[10px] font-medium sm:block whitespace-nowrap ${active ? "text-slate-900" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 transition-colors ${done ? "bg-slate-900" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
    />
  );
}

function Textarea({ ...props }) {
  return (
    <textarea
      {...props}
      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10 appearance-none"
    >
      {children}
    </select>
  );
}

function ReviewRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-emerald-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

export default function CreateDeal({ wallet, onConnect, onBack, onSubmit }) {
  const [step, setStep]     = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm]     = useState({
    side:       "sell",
    category:   "",
    asset:      "",
    description:"",
    quantity:   "",
    project:    "",
    price:      "",
    marketPrice:"",
    negotiate:  "yes",
    vesting:    "",
    settlement: "auto",
    notes:      "",
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const discount = form.marketPrice && form.price
    ? Math.max(0, Math.round(((+form.marketPrice - +form.price) / +form.marketPrice) * 100))
    : null;

  const catLabel = CATEGORIES.find((c) => c.id === form.category)?.title ?? " ";
  const vestLabel = VESTING_OPTIONS.find((v) => v.value === form.vesting)?.label ?? " ";
  const settleLabel = SETTLEMENT_OPTIONS.find((s) => s.value === form.settlement)?.label ?? " ";

  function validate() {
    if (step === 1 && !form.category) return "Please select a category.";
    if (step === 2 && !form.asset.trim()) return "Please enter the asset name.";
    if (step === 3 && (!form.price || +form.price <= 0)) return "Please enter a valid price.";
    return null;
  }

  function next() {
    const err = validate();
    if (err) { alert(err); return; }
    setStep((s) => Math.min(s + 1, 5));
  }
  function back() { setStep((s) => Math.max(s - 1, 1)); }

  function handleSubmit() {
    if (!wallet) { onConnect?.(); return; }
    const listing = {
      id:           Date.now(),
      side:         form.side,
      category:     form.category,
      asset:        form.asset,
      description:  form.description,
      quantity:     form.quantity,
      project:      form.project,
      price:        +form.price,
      marketPrice:  form.marketPrice ? +form.marketPrice : undefined,
      vesting:      form.vesting || undefined,
      negotiate:    form.negotiate,
      settlement:   form.settlement,
      notes:        form.notes,
      sellerAddress: wallet,
      sellerTrust:  "new",
      sellerDeals:  0,
      createdAt:    Date.now(),
    };
    onSubmit?.(listing);
    setSubmitted(true);
  }

  /* ── Success screen ───────────────────────────────────── */
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900">Listing Posted</h2>
          <p className="mb-6 text-sm text-slate-500">
            <strong className="text-slate-900">{form.asset}</strong> is now live on Shadow OTC. Buyers can find, purchase, or negotiate your listing.
          </p>
          <button onClick={onBack} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  /* ── Main wizard ──────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50/50 antialiased">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-6">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Cancel
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-sm font-semibold text-slate-900">Create Listing</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <StepIndicator current={step} />

        {/* ── STEP 1: Category ─────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900">What are you listing?</h2>
            <p className="mb-6 text-sm text-slate-500">Choose whether you're selling or want to buy, then select the deal type.</p>

            {/* Side toggle */}
            <div className="mb-6 grid grid-cols-2 gap-3">
              {[
                { val: "sell", icon: "📤", label: "Sell listing", desc: "I have something to sell" },
                { val: "buy",  icon: "📥", label: "Buy order",    desc: "I'm looking to buy" },
              ].map((s) => (
                <button
                  key={s.val}
                  onClick={() => set("side", s.val)}
                  className={`rounded-2xl border-2 p-5 text-left transition-all ${
                    form.side === s.val
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="mb-2 text-2xl">{s.icon}</div>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className={`mt-0.5 text-xs ${form.side === s.val ? "text-slate-400" : "text-slate-400"}`}>{s.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => set("category", cat.id)}
                  className={`rounded-2xl border-2 p-5 text-left transition-all ${
                    form.category === cat.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="mb-2 text-2xl">{cat.icon}</div>
                  <div className={`text-sm font-semibold ${form.category === cat.id ? "text-white" : "text-slate-900"}`}>{cat.title}</div>
                  <div className={`mt-1 text-xs leading-relaxed ${form.category === cat.id ? "text-slate-400" : "text-slate-500"}`}>{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Asset Details ─────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900">Asset Details</h2>
            <p className="mb-6 text-sm text-slate-500">The clearer your listing, the more buyers it attracts.</p>

            <div className="space-y-4">
              <div>
                <FieldLabel required>Asset Name</FieldLabel>
                <Input
                  value={form.asset}
                  onChange={(e) => set("asset", e.target.value)}
                  placeholder="e.g. zkSync Era Token Allocation, Blast Gold Points"
                />
                <p className="mt-1.5 text-xs text-slate-400">This is the title shown on your deal card.</p>
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Include what's being transferred, vesting details, TGE date, any conditions, or relevant links."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Quantity</FieldLabel>
                  <Input
                    value={form.quantity}
                    onChange={(e) => set("quantity", e.target.value)}
                    placeholder="e.g. 5,000 ZK"
                  />
                </div>
                <div>
                  <FieldLabel>Project / Network</FieldLabel>
                  <Input
                    value={form.project}
                    onChange={(e) => set("project", e.target.value)}
                    placeholder="e.g. zkSync Era"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Price & Discount ──────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900">Price & Discount</h2>
            <p className="mb-6 text-sm text-slate-500">Set your price in RITUAL. Add market value to show the discount automatically.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Your Price (RITUAL)</FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.001"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      placeholder="0.85"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">RITUAL</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Market Value (USD, optional)</FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.marketPrice}
                      onChange={(e) => set("marketPrice", e.target.value)}
                      placeholder="1.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">USD</span>
                  </div>
                </div>
              </div>

              {/* Live discount preview */}
              {discount !== null && discount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                  <div className="text-sm font-semibold text-emerald-700">
                    Your listing shows a <strong>−{discount}% discount</strong> badge on the deal card.
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Allow Negotiation</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: "yes", label: "Yes, buyers can negotiate" },
                    { val: "no",  label: "No, fixed price only" },
                  ].map((o) => (
                    <button
                      key={o.val}
                      type="button"
                      onClick={() => set("negotiate", o.val)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                        form.negotiate === o.val
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Vesting & Terms ───────────────────── */}
        {step === 4 && (
          <div>
            <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900">Vesting & Settlement</h2>
            <p className="mb-6 text-sm text-slate-500">Define how and when the asset transfers to the buyer.</p>

            <div className="space-y-5">
              <div>
                <FieldLabel>Vesting Schedule</FieldLabel>
                <div className="relative">
                  <Select value={form.vesting} onChange={(e) => set("vesting", e.target.value)}>
                    {VESTING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              <div>
                <FieldLabel>Settlement Method</FieldLabel>
                <div className="space-y-2">
                  {SETTLEMENT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set("settlement", o.value)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                        form.settlement === o.value
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${form.settlement === o.value ? "text-slate-900" : "text-slate-700"}`}>
                          {o.label}
                        </span>
                        {form.settlement === o.value && (
                          <svg className="h-4 w-4 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{o.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Additional Notes (optional)</FieldLabel>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Any extra conditions, proof format, or notes for the buyer."
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Review ────────────────────────────── */}
        {step === 5 && (
          <div>
            <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900">Review & Confirm</h2>
            <p className="mb-6 text-sm text-slate-500">Double-check everything. Listings stay live until sold, bought, or removed.</p>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{form.asset || " "}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${form.side === "sell" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {form.side === "sell" ? "SELL" : "BUY"}
                </span>
              </div>
              <ReviewRow label="Category"   value={catLabel} />
              <ReviewRow label="Quantity"   value={form.quantity} />
              <ReviewRow label="Project"    value={form.project} />
              <ReviewRow label="Price"      value={form.price ? `${form.price} RITUAL` : undefined} />
              <ReviewRow label="Discount"   value={discount > 0 ? `-${discount}%` : undefined} highlight />
              <ReviewRow label="Negotiate"  value={form.negotiate === "yes" ? "Allowed" : "Fixed price"} />
              <ReviewRow label="Vesting"    value={vestLabel} />
              <ReviewRow label="Settlement" value={settleLabel} />
              {form.notes && <ReviewRow label="Notes" value={form.notes} />}
            </div>

            {/* Wallet guard */}
            {!wallet && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-700">Connect your wallet to post this listing.</p>
                <button onClick={onConnect} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700">
                  Connect
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input type="checkbox" id="agree" required className="mt-0.5 h-4 w-4 accent-slate-900" />
              <span className="text-sm text-slate-600">
                I confirm I own the asset described and this listing is accurate.
              </span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className={`mt-8 flex items-center ${step > 1 ? "justify-between" : "justify-end"}`}>
          {step > 1 && (
            <button onClick={back} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}

          {step < 5 ? (
            <button onClick={next} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:-translate-y-0.5">
              Continue
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:-translate-y-0.5"
            >
              Post Listing
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
