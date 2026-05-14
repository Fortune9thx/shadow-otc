import { useState } from "react";
import ReputationBadge from "./ReputationBadge";

/* ── design tokens (matches Homepage/MarketPage) ──────── */
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
};

const CATS = {
  premarket: { label: "Pre-Market", color: "#7c3aed", bg: "rgba(167,139,250,0.10)" },
  airdrop:   { label: "Airdrop",    color: "#2563eb", bg: "rgba(96,165,250,0.10)"  },
  nft:       { label: "NFT Deal",   color: "#db2777", bg: "rgba(244,114,182,0.10)" },
  bundle:    { label: "Bundle",     color: "#64748b", bg: "rgba(148,163,184,0.10)" },
};

const VESTING_SCHEDULE = {
  "12mo linear":     [["3 months","25%"],["6 months","50%"],["9 months","75%"],["12 months","100%"]],
  "6mo linear":      [["2 months","33%"],["4 months","66%"],["6 months","100%"]],
  "cliff3":          [["3-month cliff","100%"]],
  "cliff6-12linear": [["6 months (cliff)","0%"],["12 months","33%"],["18 months","66%"],["24 months","100%"]],
};

const API = "https://shadow-otc.onrender.com";

function EmeraldBtn({ onClick, children, disabled, full, outline, small }) {
  const base = `${full ? "w-full" : ""} flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-40`;
  const size = small ? "px-4 py-2 text-[12px]" : "px-6 py-3 text-[13px]";
  if (outline) return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${size}`}
      style={{ background: "white", border: `1px solid ${T.borderS}`, color: T.em }}>
      {children}
    </button>
  );
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${size} text-white`}
      style={{ background: T.em, boxShadow: "0 2px 10px rgba(11,107,75,0.22)" }}>
      {children}
    </button>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
      <span className="text-[13px]" style={{ color: T.textDim }}>{label}</span>
      <span className={`text-[13px] font-semibold ${mono ? "font-mono" : ""}`} style={{ color: T.text }}>{value}</span>
    </div>
  );
}

function copyText(text) { navigator.clipboard.writeText(text).catch(() => {}); }

export default function DealDetails({ deal, wallet, onConnect, onBack }) {
  const [mode, setMode]           = useState(null);   // null | "buy" | "offer"
  const [offerAmt, setOfferAmt]   = useState(deal ? (deal.price * 0.9).toFixed(2) : "");
  const [offerNote, setOfferNote] = useState("");
  const [signing, setSigning]     = useState(false);
  const [done, setDone]           = useState(null);   // null | {type, sig}
  const [copied, setCopied]       = useState(null);

  if (!deal) return null;

  const cat      = CATS[deal.category] ?? CATS.bundle;
  const schedule = VESTING_SCHEDULE[deal.vesting];
  const discount = deal.discount ?? (deal.marketPrice && deal.price
    ? Math.round(((deal.marketPrice - deal.price) / deal.marketPrice) * 100) : null);

  /* ── sign + record intent ───────────────────────────── */
  async function sign(type) {
    if (!wallet) { onConnect?.(); return; }
    setSigning(true);
    try {
      const amount  = type === "buy" ? deal.price : offerAmt;
      const message = [
        `Shadow OTC — ${type === "buy" ? "Purchase Intent" : "Offer"}`,
        `Asset: ${deal.asset}`,
        `${type === "buy" ? "Price" : "Offer"}: ${amount} RITUAL`,
        `Listing ID: ${deal.id}`,
        `Chain: Ritual Testnet (1979)`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join("\n");

      const sig = await window.ethereum.request({
        method: "personal_sign",
        params: [message, wallet],
      });

      // Record intent on backend (non-fatal)
      fetch(API + "/deals/" + deal.id + "/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, buyer: wallet, amount, sig, ts: Date.now() }),
      }).catch(() => {});

      setDone({ type, sig, amount });
    } catch (err) {
      if (err?.code !== 4001) console.error("Signing error:", err);
    } finally {
      setSigning(false);
    }
  }

  function handleCopy(text, key) {
    copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  /* ── SUCCESS SCREEN ─────────────────────────────────── */
  if (done) {
    const isBuy = done.type === "buy";
    return (
      <div className="min-h-screen antialiased" style={{ background: T.bg }}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b"
          style={{ background: "rgba(240,244,242,0.95)", backdropFilter: "blur(16px)", borderColor: T.border }}>
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.em }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: T.text }}>
              {isBuy ? "Purchase Signed" : "Offer Sent"}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-8 space-y-4">

          {/* Hero card */}
          <div className="rounded-2xl p-6 text-center" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: T.em }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: T.em }}>
              {isBuy ? "Purchase Signed" : "Offer Signed"}
            </p>
            <h2 className="text-[22px] font-bold tracking-tight mb-2" style={{ color: T.text }}>
              {isBuy ? "Intent Confirmed" : "Offer Delivered"}
            </h2>
            <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
              {isBuy
                ? "Your signed purchase intent has been recorded. Contact the seller directly to arrange delivery."
                : `Your offer of ${done.amount} RITUAL is signed. Send it to the seller to begin negotiating.`}
            </p>
          </div>

          {/* Deal summary */}
          <div className="rounded-2xl px-5 py-2" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <InfoRow label="Asset"  value={deal.asset} />
            <InfoRow label="Amount" value={`${done.amount} RITUAL`} />
            <InfoRow label="Chain"  value="Ritual Testnet · ID 1979" />
            <InfoRow label="Signed by" value={`${wallet?.slice(0,8)}…${wallet?.slice(-6)}`} mono />
          </div>

          {/* Wallet signature */}
          <div className="rounded-2xl p-4" style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: T.em }}>Wallet Signature</p>
              <button onClick={() => handleCopy(done.sig, "sig")}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: copied === "sig" ? T.em : "white", color: copied === "sig" ? "white" : T.em, border: `1px solid ${T.emBdr}` }}>
                {copied === "sig" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="font-mono text-[11px] break-all leading-relaxed" style={{ color: T.emMid }}>
              {done.sig}
            </p>
          </div>

          {/* Next steps */}
          <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <p className="text-[13px] font-bold mb-4" style={{ color: T.text }}>What happens next</p>
            <div className="space-y-3">
              {[
                ["1", "Contact the seller", `Send your wallet signature to ${deal.sellerAddress ? deal.sellerAddress.slice(0,10)+"…" : "the seller"} as proof of intent.`],
                ["2", "Seller delivers the asset", "The seller transfers the token allocation, airdrop claim, or NFT to your wallet."],
                ["3", "Confirm receipt", "Once you receive the asset, both parties confirm completion on-chain."],
              ].map(([n, title, desc]) => (
                <div key={n} className="flex gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }}>
                    {n}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: T.text }}>{title}</p>
                    <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: T.textSub }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Seller wallet copy */}
            {deal.sellerAddress && (
              <div className="mt-4 flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: T.textDim }}>Seller Wallet</p>
                  <p className="font-mono text-[12px] font-semibold" style={{ color: T.text }}>
                    {deal.sellerAddress.slice(0,10)}…{deal.sellerAddress.slice(-8)}
                  </p>
                </div>
                <button onClick={() => handleCopy(deal.sellerAddress, "wallet")}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: copied === "wallet" ? T.em : "white", color: copied === "wallet" ? "white" : T.em, border: `1px solid ${T.emBdr}` }}>
                  {copied === "wallet" ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <EmeraldBtn onClick={onBack} full>Back to Marketplace</EmeraldBtn>
        </main>
      </div>
    );
  }

  /* ── MAIN DEAL PAGE ─────────────────────────────────── */
  return (
    <div className="min-h-screen antialiased" style={{ background: T.bg }}>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b"
        style={{ background: "rgba(240,244,242,0.95)", backdropFilter: "blur(16px)", borderColor: T.border }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: T.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Marketplace
          </button>
          <div className="h-4 w-px" style={{ background: T.border }} />
          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: cat.bg, color: cat.color }}>
            {cat.label}
          </span>
          <span className="hidden text-[13px] font-medium sm:block truncate" style={{ color: T.textSub }}>
            {deal.asset}
          </span>
          <div className="ml-auto">
            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.em }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.em }} />
                </span>
                <span className="font-mono text-[12px] font-medium" style={{ color: T.em }}>
                  {wallet.slice(0,6)}…{wallet.slice(-4)}
                </span>
              </div>
            ) : (
              <EmeraldBtn onClick={onConnect} small>Connect Wallet</EmeraldBtn>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* ── LEFT COLUMN ──────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Hero card */}
            <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                {deal.side && (
                  <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={deal.side === "sell"
                      ? { background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }
                      : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
                    {deal.side === "sell" ? "SELL" : "BUY ORDER"}
                  </span>
                )}
                {discount > 0 && (
                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c" }}>
                    −{discount}% below market
                  </span>
                )}
              </div>

              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight mb-2" style={{ color: T.text }}>
                {deal.asset}
              </h1>
              <p className="text-[13px] leading-relaxed mb-6" style={{ color: T.textSub }}>
                {deal.description || `Peer-to-peer OTC deal for ${deal.asset}. Review the terms below and connect your wallet to purchase or make an offer.`}
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Price",    `${deal.price} RITUAL`],
                  ["Quantity", deal.quantity || "—"],
                  ["Discount", discount > 0 ? `−${discount}%` : "—"],
                  ["Vesting",  deal.vesting || "Instant"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl px-4 py-3"
                    style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] mb-1" style={{ color: T.textDim }}>{label}</p>
                    <p className="text-[13px] font-semibold" style={{ color: label === "Discount" && discount > 0 ? "#be123c" : T.text }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vesting schedule */}
            {schedule && (
              <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>Vesting Schedule</h2>
                <p className="text-[12px] mb-5" style={{ color: T.textSub }}>Tokens unlock progressively over the vesting period.</p>
                <div className="space-y-2">
                  {schedule.map(([when, pct], i) => (
                    <div key={when} className="flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={i === 0 ? { background: T.emBg, border: `1px solid ${T.emBdr}` } : { background: "white", border: `1px solid ${T.border}` }}>
                        {i === 0
                          ? <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color: T.em }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : <div className="h-1.5 w-1.5 rounded-full" style={{ background: T.border }} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold" style={{ color: T.text }}>{when}</p>
                        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: T.border }}>
                          <div className="h-full rounded-full" style={{ width: pct, background: T.em }} />
                        </div>
                      </div>
                      <p className="text-[13px] font-bold" style={{ color: i === 0 ? T.em : T.textDim }}>{pct}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <h2 className="text-[15px] font-bold mb-5" style={{ color: T.text }}>How Settlement Works</h2>
              <div className="space-y-4">
                {[
                  ["Sign intent",    "You sign a cryptographic purchase intent with your wallet — no funds leave your account yet."],
                  ["Contact seller", "Share your signed intent with the seller to coordinate delivery of the asset."],
                  ["Receive asset",  "The seller transfers the token allocation, airdrop rights, or NFT to your wallet."],
                  ["Confirm",        "Both parties confirm on-chain. Deal is marked complete."],
                ].map(([title, desc], i) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }}>{i + 1}</div>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: T.text }}>{title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: T.textSub }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────── */}
          <div className="space-y-4">

            {/* Action card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${T.border}` }}>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] mb-0.5" style={{ color: T.textDim }}>Asking price</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] font-bold tracking-tight" style={{ color: T.text }}>{deal.price}</span>
                  <span className="text-[14px] font-medium" style={{ color: T.textDim }}>RITUAL</span>
                </div>
                {deal.marketPrice && (
                  <p className="mt-1 text-[11px]" style={{ color: T.textDim }}>
                    Market ~{deal.marketPrice} RITUAL
                    {discount > 0 && <span style={{ color: "#be123c", marginLeft: 5 }}>({discount}% off)</span>}
                  </p>
                )}
              </div>

              <div className="px-5 py-5">
                {!mode ? (
                  <div className="space-y-2.5">
                    <EmeraldBtn onClick={() => wallet ? setMode("buy") : onConnect()} full>
                      {wallet ? `Buy · ${deal.price} RITUAL` : "Connect Wallet to Buy"}
                    </EmeraldBtn>
                    {deal.negotiate !== "no" && (
                      <EmeraldBtn outline onClick={() => wallet ? setMode("offer") : onConnect()} full>
                        Make an Offer
                      </EmeraldBtn>
                    )}
                  </div>
                ) : mode === "buy" ? (
                  <div>
                    <div className="mb-4 rounded-xl px-4 py-3" style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
                      <p className="text-[12px] leading-relaxed" style={{ color: T.emMid }}>
                        This signs a cryptographic purchase intent with your wallet. No funds leave your account until you coordinate with the seller.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <EmeraldBtn onClick={() => sign("buy")} disabled={signing} full>
                        {signing ? "Waiting for signature…" : "Sign Purchase Intent →"}
                      </EmeraldBtn>
                      <EmeraldBtn outline onClick={() => setMode(null)} full>Cancel</EmeraldBtn>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); sign("offer"); }} className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: T.textDim }}>Your Offer (RITUAL)</p>
                      <div className="relative">
                        <input type="number" step="0.01" min="0.001"
                          value={offerAmt} onChange={e => setOfferAmt(e.target.value)}
                          className="w-full rounded-xl border py-2.5 pl-4 pr-16 text-[14px] font-bold outline-none focus:ring-2"
                          style={{ borderColor: T.border, background: T.panel, color: T.text,
                            "--tw-ring-color": T.emBdr }} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold"
                          style={{ color: T.textDim }}>RITUAL</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: T.textDim }}>Note (optional)</p>
                      <textarea rows={2} value={offerNote} onChange={e => setOfferNote(e.target.value)}
                        placeholder="Introduce yourself or explain your offer…"
                        className="w-full resize-none rounded-xl border px-4 py-2.5 text-[12px] outline-none"
                        style={{ borderColor: T.border, background: T.panel, color: T.text }} />
                    </div>
                    <EmeraldBtn full disabled={signing}>
                      {signing ? "Waiting for signature…" : "Sign & Send Offer"}
                    </EmeraldBtn>
                    <EmeraldBtn outline onClick={() => setMode(null)} full>Cancel</EmeraldBtn>
                  </form>
                )}
              </div>
            </div>

            {/* Seller card */}
            <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: T.textDim }}>Seller</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }}>
                  {deal.sellerAddress?.slice(2, 4).toUpperCase() ?? "??"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px] font-semibold" style={{ color: T.text }}>
                    {deal.sellerAddress || "Anonymous"}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: T.emBg, border: `1px solid ${T.emBdr}`, color: T.em }}>
                    {(deal.sellerTrust || "New").replace("-", " ")}
                  </span>
                </div>
              </div>
              {/* Live on-chain reputation */}
              {deal.sellerAddress && (
                <div className="mt-3">
                  <ReputationBadge address={deal.sellerAddress} compact={false} />
                </div>
              )}
              {!deal.sellerAddress && (
                <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  {[["Total deals", deal.sellerDeals ?? "0"], ["Success rate", "100%"]].map(([l, v], i) => (
                    <div key={l} className="px-4 py-3 text-center" style={{ background: T.panel, borderRight: i === 0 ? `1px solid ${T.border}` : "none" }}>
                      <p className="text-[15px] font-bold" style={{ color: T.text }}>{v}</p>
                      <p className="mt-0.5 text-[10px]" style={{ color: T.textDim }}>{l}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Safety note */}
            <div className="rounded-xl px-4 py-3.5" style={{ background: T.emBg, border: `1px solid ${T.emBdr}` }}>
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: T.em }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <p className="text-[11px] leading-relaxed" style={{ color: T.emMid }}>
                  This is a <strong>testnet OTC marketplace</strong>. All transactions use Ritual Testnet tokens. Do not send real funds. Always verify the seller's wallet before transferring any assets.
                </p>
              </div>
            </div>

            <button className="w-full rounded-xl py-2.5 text-[12px] font-semibold transition-all"
              style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c" }}>
              ⚠ Report Issue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
