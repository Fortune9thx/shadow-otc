import React from "react";

const T = {
  card:    "#ffffff",
  panel:   "#F3F6F4",
  border:  "rgba(11,107,75,0.18)",
  text:    "#1B1F1D",
  textSub: "#51605A",
  textMid: "#51605A",
  textDim: "#7B8A84",
  em:      "#0B6B4B",
  emMid:   "#084C38",
  emBg:    "#EAF4EF",
  emBdr:   "rgba(11,107,75,0.30)",
  shadow:  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
};

const CAT = {
  premarket: { label: "Pre-Market", dot: "#7c3aed", bg: "#f5f3ff", border: "rgba(124,58,237,0.15)",  text: "#5b21b6" },
  airdrop:   { label: "Airdrop",    dot: "#1d4ed8", bg: "#eff6ff", border: "rgba(29,78,216,0.15)",   text: "#1e40af" },
  nft:       { label: "NFT Deal",   dot: "#6d28d9", bg: "#f5f3ff", border: "rgba(109,40,217,0.15)",  text: "#4c1d95" },
  bundle:    { label: "Bundle",     dot: "#475569", bg: "#f8fafc", border: "rgba(71,85,105,0.12)",   text: "#334155" },
};

const TRUST = {
  verified:    { label: "Verified",   bg: "#ecfdf5",   border: "#6ee7b7",           text: "#064e3b",      icon: true },
  "high-trust":{ label: "High Trust", bg: "#111827", border: "rgba(0,0,0,0)",  text: "#ffffff",  icon: false },
  new:         { label: "New",        bg: T.panel,  border: "1px solid rgba(0,0,0,0.11)",          text: "#6b7280",  icon: false },
};

export default function DealCard({
  asset, category = "premarket", side = "sell",
  price, marketPrice, discount, vesting, quantity,
  sellerAddress = "0x0000...0000", sellerTrust = "new",
  isCopied, onClick, onCopyLink, onShareX,
}) {
  const cat   = CAT[category]      ?? CAT.premarket;
  const trust = TRUST[sellerTrust] ?? TRUST.new;
  const computedDiscount = discount ?? (marketPrice && price
    ? Math.round(((marketPrice - price) / marketPrice) * 100) : null);

  return (
    <div className="group relative flex flex-col overflow-hidden transition-all duration-200"
      style={{ borderRadius: "12px", background: "linear-gradient(180deg,#ffffff 0%,#F6F8F7 100%)", border: "1px solid rgba(11,107,75,0.22)", boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(11,107,75,0.06)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(11,107,75,0.28), 0 12px 32px rgba(0,0,0,0.09), 0 0 0 1px rgba(11,107,75,0.10)"; e.currentTarget.style.borderColor = "rgba(11,107,75,0.32)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(11,107,75,0.06)"; e.currentTarget.style.borderColor = "rgba(11,107,75,0.22)"; }}>

      <button type="button" onClick={onClick} className="flex flex-col text-left flex-1 w-full focus:outline-none" aria-label={`View ${asset}`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.dot }} />
            {cat.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={side === "sell"
                ? { background: "#ecfdf5", border: `1px solid ${"#6ee7b7"}`, color: T.em }
                : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
              {side === "sell" ? "SELL" : "WTB"}
            </span>
            {computedDiscount > 0 && (
              <span className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                -{computedDiscount}%
              </span>
            )}
          </div>
        </div>

        <h3 className="px-5 pb-1 text-[15px] font-semibold leading-snug tracking-tight" style={{ color: T.text }}>
          {asset}
        </h3>

        <dl className="grid grid-cols-2 gap-x-4 px-5 pb-5 pt-2.5 flex-1">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.14em] mb-1" style={{ color: T.textDim }}>Quantity</dt>
            <dd className="text-[13px] font-semibold" style={{ color: T.textSub }}>{quantity || "N/A"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.14em] mb-1" style={{ color: T.textDim }}>Vesting</dt>
            <dd className="text-[13px] font-semibold" style={{ color: T.textSub }}>{vesting || "Instant"}</dd>
          </div>
        </dl>

        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(0,0,0,0.06),transparent)", margin: "0 20px" }} />

        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "rgba(0,0,0,0.025)" }}>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] mb-0.5" style={{ color: T.textDim }}>Price</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-bold tracking-tight" style={{ color: T.text }}>{price}</span>
              <span className="text-[11px] font-medium" style={{ color: T.textMid }}>RITUAL</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold"
            style={{ background: trust.bg, border: `1px solid ${trust.border}`, color: trust.text }}>
            {trust.icon && (
              <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.7 5.7a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 10.1a1 1 0 011.4-1.4L8.5 12.5l6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
              </svg>
            )}
            {trust.label}
          </span>
        </div>
      </button>

      <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: "1px solid rgba(11,107,75,0.14)", background: "rgba(0,0,0,0.02)" }}>
        <span className="font-mono text-[11px] truncate max-w-[130px]" style={{ color: T.textDim }}>{sellerAddress}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={onCopyLink}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all"
            style={{ background: isCopied ? "#ecfdf5" : "transparent", border: `1px solid ${isCopied ? "#6ee7b7" : T.border}`, color: isCopied ? T.em : T.textMid }}>
            {isCopied ? (
              <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
            ) : (
              <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>Share</>
            )}
          </button>
          <button onClick={onShareX}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{ border: "1px solid rgba(11,107,75,0.18)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(11,107,75,0.06)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill={"#6b7280"}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
