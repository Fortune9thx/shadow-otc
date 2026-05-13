import { useState } from "react";

const CATS = {
  premarket: { label: "Pre-Market", dot: "#a78bfa", bg: "rgba(46,16,101,0.30)",  border: "rgba(109,40,217,0.22)", text: "rgba(196,181,253,0.85)" },
  airdrop:   { label: "Airdrop",    dot: "#60a5fa", bg: "rgba(23,37,84,0.30)",   border: "rgba(29,78,216,0.22)",  text: "rgba(147,197,253,0.85)" },
  nft:       { label: "NFT Deal",   dot: "#818cf8", bg: "rgba(30,27,75,0.30)",   border: "rgba(55,48,163,0.22)",  text: "rgba(165,180,252,0.85)" },
  bundle:    { label: "Bundle",     dot: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.45)" },
};

const TRUST = {
  verified:    { label: "Verified",   border: "rgba(5,150,105,0.35)",  bg: "rgba(6,78,59,0.35)",      text: "rgba(52,211,153,0.85)",  icon: true },
  "high-trust":{ label: "High Trust", border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.07)",  text: "rgba(255,255,255,0.65)", icon: false },
  new:         { label: "New",        border: "rgba(255,255,255,0.06)", bg: "rgba(255,255,255,0.025)", text: "rgba(255,255,255,0.28)", icon: false },
};

const VESTING_SCHEDULE = {
  "12mo linear":     [["3 months","25%"],["6 months","50%"],["9 months","75%"],["12 months","100%"]],
  "6mo linear":      [["2 months","33%"],["4 months","66%"],["6 months","100%"]],
  "cliff3":          [["3 months cliff","100%"]],
  "cliff6-12linear": [["6 months (cliff)","0%"],["12 months","33%"],["18 months","66%"],["24 months","100%"]],
};

function EmeraldBtn({ onClick, children, disabled, full, outline }) {
  if (outline) return (
    <button onClick={onClick} className={`${full?"w-full":""} flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[13px] font-semibold transition-all hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white/85`} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.55)" }}>{children}</button>
  );
  return (
    <button onClick={onClick} disabled={disabled} className={`${full?"w-full":""} relative overflow-hidden rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2`} style={{ background:"linear-gradient(160deg,#059669,#064e3b)", boxShadow:"0 2px 14px rgba(5,150,105,0.30), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 to-transparent" />
      {children}
    </button>
  );
}

function Tile({ label, value, accent }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.25)" }}>{label}</p>
      <p className="text-[13px] font-semibold" style={{ color: accent||"rgba(255,255,255,0.72)" }}>{value}</p>
    </div>
  );
}

export default function DealDetails({ deal, wallet, onConnect, onBack }) {
  const [mode, setMode]       = useState(null);
  const [offerAmt, setOfferAmt] = useState(deal ? (deal.price * 0.9).toFixed(2) : "");
  const [offerNote, setOfferNote] = useState("");
  const [done, setDone]       = useState(null);

  if (!deal) return null;

  const cat      = CATS[deal.category]   ?? CATS.premarket;
  const trust    = TRUST[deal.sellerTrust] ?? TRUST.new;
  const schedule = VESTING_SCHEDULE[deal.vesting];
  const computedDiscount = deal.discount ?? (deal.marketPrice && deal.price ? Math.round(((deal.marketPrice - deal.price) / deal.marketPrice) * 100) : null);

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background:"rgba(9,16,15,0.98)" }}>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl p-8 text-center" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-900/20 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background:"rgba(5,150,105,0.12)", border:"1px solid rgba(5,150,105,0.28)", boxShadow:"0 0 28px rgba(5,150,105,0.12)" }}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color:"rgba(52,211,153,0.88)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color:"rgba(52,211,153,0.5)" }}>{done==="buy"?"Purchase Initiated":"Offer Sent"}</p>
          <h2 className="mb-2 text-[22px] font-semibold tracking-tight" style={{ color:"rgba(255,255,255,0.88)" }}>{done==="buy"?"Funds Locked":"Offer Delivered"}</h2>
          <p className="mb-7 text-[13px] leading-relaxed" style={{ color:"rgba(255,255,255,0.38)" }}>{done==="buy"?`${deal.price} RITUAL locked in Ritual Chain TEE escrow. The seller has been notified.`:`Your offer of ${offerAmt} RITUAL has been sent. The seller will respond shortly.`}</p>
          <div className="mb-6 rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
            {[["Asset",deal.asset],["Amount",`${done==="buy"?deal.price:offerAmt} RITUAL`],["Escrow","Ritual TEE · Chain 1979"]].map(([l,v],i)=>(
              <div key={l} className="flex justify-between px-4 py-3 text-[12px]" style={{ borderBottom:i<2?"1px solid rgba(255,255,255,0.05)":"none", background:i%2===0?"rgba(255,255,255,0.015)":"transparent" }}>
                <span style={{ color:"rgba(255,255,255,0.30)" }}>{l}</span>
                <span style={{ color:"rgba(255,255,255,0.72)" }}>{v}</span>
              </div>
            ))}
          </div>
          <EmeraldBtn onClick={onBack} full>Back to Marketplace</EmeraldBtn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen antialiased" style={{ background:["radial-gradient(ellipse 60% 30% at 12% 0%, rgba(6,78,59,0.18) 0%, transparent 65%)","radial-gradient(ellipse 40% 20% at 88% 8%, rgba(6,78,59,0.10) 0%, transparent 60%)","#09100f"].join(",") }}>

      {/* TOPBAR */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06]" style={{ background:"rgba(9,16,15,0.85)", backdropFilter:"blur(20px)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/[0.04]" style={{ color:"rgba(255,255,255,0.35)" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Marketplace
          </button>
          <div className="h-4 w-px" style={{ background:"rgba(255,255,255,0.08)" }} />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background:cat.bg, border:`1px solid ${cat.border}`, color:cat.text }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background:cat.dot }} />{cat.label}
            </span>
            <span className="hidden text-[13px] font-medium sm:block" style={{ color:"rgba(255,255,255,0.45)" }}>{deal.asset}</span>
          </div>
          <div className="ml-auto">
            {wallet ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                <span className="font-mono text-[12px]" style={{ color:"rgba(255,255,255,0.50)" }}>{wallet.slice(0,6)}…{wallet.slice(-4)}</span>
              </div>
            ) : (
              <button onClick={onConnect} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.55)" }}>Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-4">

            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-900/15 blur-3xl" />
              <div className="relative px-7 pt-7 pb-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background:cat.bg, border:`1px solid ${cat.border}`, color:cat.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background:cat.dot }} />{cat.label}</span>
                  {deal.side && <span className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={deal.side==="sell"?{ background:"rgba(6,78,59,0.3)", border:"1px solid rgba(5,150,105,0.2)", color:"rgba(52,211,153,0.8)" }:{ background:"rgba(30,27,75,0.3)", border:"1px solid rgba(79,70,229,0.2)", color:"rgba(165,180,252,0.8)" }}>{deal.side==="sell"?"SELL":"BUY ORDER"}</span>}
                  {computedDiscount>0 && <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background:"rgba(120,15,15,0.3)", border:"1px solid rgba(220,38,38,0.2)", color:"rgba(252,165,165,0.85)" }}>−{computedDiscount}% below market</span>}
                </div>
                <h1 className="mb-2 text-[26px] font-bold leading-tight tracking-tight" style={{ color:"rgba(255,255,255,0.90)" }}>{deal.asset}</h1>
                <p className="mb-6 text-[13px] leading-relaxed" style={{ color:"rgba(255,255,255,0.38)" }}>{deal.description||`Trade this ${cat.label.toLowerCase()} peer-to-peer. Funds lock into Ritual Chain escrow, AI agents verify delivery and release payment automatically.`}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Price"    value={`${deal.price} RITUAL`} />
                  <Tile label="Quantity" value={deal.quantity||" "} />
                  <Tile label="Discount" value={computedDiscount>0?`−${computedDiscount}%`:"Market"} accent={computedDiscount>0?"rgba(252,165,165,0.85)":undefined} />
                  <Tile label="Vesting"  value={deal.vesting||"Instant"} />
                </div>
              </div>
              <div className="mx-7" style={{ height:"1px", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)" }} />
              <div className="flex flex-wrap items-center gap-8 px-7 py-4" style={{ background:"rgba(0,0,0,0.15)" }}>
                <div>
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.22)" }}>Price</p>
                  <div className="flex items-baseline gap-1.5"><span className="text-[28px] font-bold tracking-tight" style={{ color:"rgba(255,255,255,0.9)" }}>{deal.price}</span><span className="text-[13px]" style={{ color:"rgba(255,255,255,0.30)" }}>RITUAL</span></div>
                </div>
                {deal.marketPrice && <div>
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.22)" }}>Market Value</p>
                  <div className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold" style={{ color:"rgba(255,255,255,0.50)" }}>{deal.marketPrice}</span><span className="text-[12px]" style={{ color:"rgba(255,255,255,0.25)" }}>RITUAL</span></div>
                </div>}
              </div>
            </div>

            {/* Vesting */}
            {schedule && (
              <div className="rounded-2xl p-6" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <h2 className="mb-1 text-[15px] font-semibold" style={{ color:"rgba(255,255,255,0.80)" }}>Vesting Schedule</h2>
                <p className="mb-5 text-[12px]" style={{ color:"rgba(255,255,255,0.30)" }}>Tokens unlock progressively over the vesting period.</p>
                <div className="space-y-2">
                  {schedule.map(([when,pct],i) => {
                    const done2 = i<1; const numPct = parseInt(pct);
                    return (
                      <div key={when} className="flex items-center gap-4 rounded-xl px-4 py-3" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={done2?{ background:"rgba(5,150,105,0.2)", border:"1px solid rgba(5,150,105,0.4)" }:{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)" }}>
                          {done2?<svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color:"rgba(52,211,153,0.8)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>:<div className="h-1.5 w-1.5 rounded-full" style={{ background:"rgba(255,255,255,0.2)" }} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold" style={{ color:"rgba(255,255,255,0.72)" }}>{when}</p>
                          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width:`${numPct}%`, background:"linear-gradient(90deg,#059669,rgba(52,211,153,0.6))" }} />
                          </div>
                        </div>
                        <p className="text-[13px] font-bold" style={{ color:done2?"rgba(52,211,153,0.8)":"rgba(255,255,255,0.45)" }}>{pct}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Settlement */}
            <div className="rounded-2xl p-6" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <h2 className="mb-5 text-[15px] font-semibold" style={{ color:"rgba(255,255,255,0.80)" }}>How Settlement Works</h2>
              <div className="space-y-4">
                {[["Lock funds","Buyer locks RITUAL into the Ritual Chain TEE escrow contract."],["Deliver asset","Seller transfers the asset, token allocation, NFT, or airdrop claim."],["AI verification","Ritual TEE fetches the delivery proof URL on-chain and verifies automatically."],["Auto-release","Funds release to the seller instantly. No middleman. No manual step."]].map(([t,d],i)=>(
                  <div key={t} className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.40)" }}>{i+1}</div>
                    <div><p className="text-[13px] font-semibold" style={{ color:"rgba(255,255,255,0.72)" }}>{t}</p><p className="mt-0.5 text-[12px] leading-relaxed" style={{ color:"rgba(255,255,255,0.32)" }}>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">

            {/* Action */}
            <div className="rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 pt-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.22)" }}>Asking price</p>
                <div className="flex items-baseline gap-2"><span className="text-[28px] font-bold tracking-tight" style={{ color:"rgba(255,255,255,0.90)" }}>{deal.price}</span><span className="text-[13px]" style={{ color:"rgba(255,255,255,0.28)" }}>RITUAL</span></div>
                {deal.marketPrice && <p className="mt-1 text-[11px]" style={{ color:"rgba(255,255,255,0.25)" }}>Market ~{deal.marketPrice} RITUAL{computedDiscount>0&&<span style={{ color:"rgba(252,165,165,0.7)", marginLeft:"5px" }}>({computedDiscount}% off)</span>}</p>}
              </div>
              <div className="px-5 py-5">
                {!mode ? (
                  <div className="space-y-2.5">
                    <EmeraldBtn onClick={()=>wallet?setMode("buy"):onConnect()} full>{wallet?`Buy Now, ${deal.price} RITUAL`:"Connect Wallet to Buy"}</EmeraldBtn>
                    <EmeraldBtn outline onClick={()=>wallet?setMode("offer"):onConnect()} full>Make an Offer</EmeraldBtn>
                  </div>
                ) : mode==="buy" ? (
                  <div>
                    <p className="mb-4 text-[12px] leading-relaxed" style={{ color:"rgba(255,255,255,0.38)" }}>This will lock <strong style={{ color:"rgba(255,255,255,0.65)" }}>{deal.price} RITUAL</strong> into Ritual Chain escrow. The seller will be notified to deliver.</p>
                    <div className="space-y-2">
                      <EmeraldBtn onClick={()=>setDone("buy")} full>Confirm Purchase →</EmeraldBtn>
                      <EmeraldBtn outline onClick={()=>setMode(null)} full>Cancel</EmeraldBtn>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={e=>{e.preventDefault();setDone("offer");}} className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.28)" }}>Your Offer (RITUAL)</p>
                      <div className="relative">
                        <input type="number" step="0.01" min="0.001" value={offerAmt} onChange={e=>setOfferAmt(e.target.value)} className="w-full rounded-xl py-2.5 pl-4 pr-16 text-[14px] font-bold text-white/80 outline-none" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)" }} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.35)" }}>RITUAL</span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.28)" }}>Note (optional)</p>
                      <textarea rows={2} value={offerNote} onChange={e=>setOfferNote(e.target.value)} placeholder="Introduce yourself or explain your offer…" className="w-full resize-none rounded-xl px-4 py-2.5 text-[12px] outline-none placeholder:text-white/18" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.72)" }} />
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background:"rgba(6,78,59,0.15)", border:"1px solid rgba(5,150,105,0.16)" }}>
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color:"rgba(52,211,153,0.55)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      <p className="text-[11px] leading-relaxed" style={{ color:"rgba(255,255,255,0.35)" }}>AI suggestion: fair range is <strong style={{ color:"rgba(52,211,153,0.75)" }}>{(deal.price*0.85).toFixed(2)} {(deal.price*0.95).toFixed(2)} RITUAL</strong> based on similar deals.</p>
                    </div>
                    <EmeraldBtn full>Send Offer</EmeraldBtn>
                    <EmeraldBtn outline onClick={()=>setMode(null)} full>Cancel</EmeraldBtn>
                  </form>
                )}
              </div>
            </div>

            {/* Seller */}
            <div className="rounded-2xl p-5" style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color:"rgba(255,255,255,0.22)" }}>Seller</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background:"linear-gradient(135deg,#064e3b,#022c22)", border:"1px solid rgba(5,150,105,0.2)", color:"rgba(52,211,153,0.8)" }}>{deal.sellerAddress?.slice(2,4).toUpperCase()??"??"}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px] font-semibold" style={{ color:"rgba(255,255,255,0.65)" }}>{deal.sellerAddress}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold" style={{ background:trust.bg, border:`1px solid ${trust.border}`, color:trust.text }}>
                    {trust.icon&&<svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.7a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 10.1a1 1 0 011.4-1.4L8.5 12.5l6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>}
                    {trust.label}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                {[["Total deals",deal.sellerDeals??" "],["Success rate","100%"]].map(([l,v],i)=>(
                  <div key={l} className="px-4 py-3 text-center" style={{ borderRight:i===0?"1px solid rgba(255,255,255,0.06)":"none" }}>
                    <p className="text-[16px] font-bold" style={{ color:"rgba(255,255,255,0.78)" }}>{v}</p>
                    <p className="mt-0.5 text-[10px]" style={{ color:"rgba(255,255,255,0.26)" }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety */}
            <div className="rounded-xl px-4 py-3.5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color:"rgba(52,211,153,0.40)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                <p className="text-[11px] leading-relaxed" style={{ color:"rgba(255,255,255,0.28)" }}>Funds are held in a <strong style={{ color:"rgba(255,255,255,0.50)" }}>Ritual Chain TEE escrow</strong>. Neither party can access them until delivery is AI-verified on-chain.</p>
              </div>
            </div>

            {/* Report */}
            <button className="w-full rounded-xl py-2.5 text-[12px] font-semibold transition-all hover:opacity-80" style={{ background:"rgba(120,15,15,0.12)", border:"1px solid rgba(220,38,38,0.12)", color:"rgba(252,165,165,0.55)" }}>⚠ Report Issue</button>
          </div>
        </div>
      </main>
    </div>
  );
}
