import { useEffect, useRef, useState } from "react";
import Homepage        from "./components/Homepage";
import DealDetails     from "./components/DealDetails";
import CreateDeal      from "./components/CreateDeal";
import Dashboard       from "./components/Dashboard";
import PrivateDealRoom from "./components/PrivateDealRoom";
import MarketPage      from "./components/MarketPage";
import { sbGetDeals, sbUpsertDeal, supabaseConfigured } from "./lib/supabase";
import { getContract, parseDeal, fetchMyDeals, STATUS_LABELS, RITUAL_FAUCET_URL } from "./lib/contract";
import { ethers } from "ethers";

// ── profile helpers (localStorage, no import needed) ──
const PROFILE_LS_KEY = (w) => `shadowotc_profile_${w?.toLowerCase() ?? "anon"}`;
function getLocalProfile(wallet) {
  try {
    const raw = localStorage.getItem(PROFILE_LS_KEY(wallet));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const API              = import.meta.env.VITE_API_URL || "https://shadow-otc.onrender.com";
const LS_KEY           = "shadowotc_listings_v2";

/* ── load / save listings from localStorage ─────────── */
function loadLocalListings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveLocalListings(listings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(listings)); } catch {}
}

/* ── notification toast helpers ─────────────────────── */
const STATUS_CHANGE_MSGS = {
  1: "🤝 Seller accepted your deal",
  2: "📦 Delivery submitted — ready to verify",
  3: "🔍 Verification agent running",
  4: "✅ Deal completed! Funds released",
  5: "❌ Deal failed — buyer refunded",
  6: "⚠️ Dispute raised",
  7: "🚫 Deal cancelled",
};

const RITUAL_CHAIN_ID = "0x7bb"; // 1979 decimal — MetaMask returns lowercase

export default function App() {
  const [page, setPage]                 = useState("home");
  const [wallet, setWallet]             = useState(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [ritualBalance, setRitualBalance] = useState(null); // null = unknown
  const [faucetDismissed, setFaucetDismissed] = useState(
    () => localStorage.getItem("shadowotc_faucet_dismissed") === "1"
  );
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [intentForRoom, setIntentForRoom] = useState(null);
  const [deals, setDeals]               = useState(() => loadLocalListings());
  const [settlements, setSettlements]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [toasts, setToasts]             = useState([]);  // [{id, msg, dealId, ts}]
  const lastStates                      = useRef({});    // dealId → status

  /* ── notification polling ────────────────────────────── */
  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;

    async function poll() {
      try {
        const myDeals = await fetchMyDeals(wallet);
        if (cancelled) return;
        myDeals.forEach(d => {
          const prev = lastStates.current[d.id];
          if (prev !== undefined && prev !== d.status) {
            const msg = STATUS_CHANGE_MSGS[d.status];
            if (msg) {
              // In-app toast
              const toastId = `${d.id}-${d.status}-${Date.now()}`;
              setToasts(t => [...t, { id: toastId, msg, dealId: d.id, ts: Date.now() }]);
              setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 6000);

              // Email notification (non-fatal, fire-and-forget)
              const profile = getLocalProfile(wallet);
              if (profile?.email && profile.email.includes("@")) {
                fetch(API + "/notify", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ email: profile.email, dealId: d.id, status: d.status, msg }),
                }).catch(() => {});
              }
            }
          }
          lastStates.current[d.id] = d.status;
        });
      } catch { /* silent */ }
    }

    // Seed initial states without triggering toasts
    fetchMyDeals(wallet)
      .then(ds => ds.forEach(d => { lastStates.current[d.id] = d.status; }))
      .catch(() => {});

    const timer = setInterval(poll, 20_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [wallet]);

  /* ── handle share link on load ──────────────────────── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#listing=")) {
      const id = hash.split("=")[1];
      sessionStorage.setItem("pendingListing", id);
    }
    // #deal=N → navigate directly to DealDetails for that on-chain deal
    if (hash.startsWith("#deal=")) {
      const dealId = Number(hash.split("=")[1]);
      if (!isNaN(dealId)) {
        sessionStorage.setItem("pendingDealId", dealId);
      }
    }
    // #room=X → open Private Deal Room directly
    if (hash.startsWith("#room=")) {
      setPage("private");
    }
  }, []);

  /* ── fetch + sync listings ───────────────────────────── */
  useEffect(() => {
    async function load() {
      // Always start with whatever is in localStorage — instant render
      const localListings = loadLocalListings();

      try {
        let authoritative = [];

        // ── 1. Try Supabase first (persistent, cross-device) ──────────
        if (supabaseConfigured) {
          const sbDeals = await sbGetDeals();
          if (sbDeals) authoritative = sbDeals;
        }

        // ── 2. Fall back to Render backend if Supabase not configured ─
        if (!supabaseConfigured || authoritative.length === 0) {
          try {
            const res  = await fetch(API + "/deals");
            const data = await res.json();
            const renderDeals = Array.isArray(data.deals) ? data.deals : [];
            if (renderDeals.length > 0) authoritative = renderDeals;
          } catch { /* Render offline — fine */ }
        }

        // ── 3. Merge: authoritative + local-only listings ─────────────
        const authIds   = new Set(authoritative.map(d => String(d.id)));
        const localOnly = localListings.filter(d => !authIds.has(String(d.id)));
        const merged    = [...authoritative, ...localOnly];
        saveLocalListings(merged);
        setDeals(merged);

        // ── 4. Self-healing sync: push local-only to all backends ──────
        if (localOnly.length > 0) {
          localOnly.forEach(deal => {
            // Push to Supabase if configured
            if (supabaseConfigured) sbUpsertDeal(deal).catch(() => {});
            // Also push to Render as secondary backup
            fetch(API + "/deals", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify(deal),
            }).catch(() => {});
          });
        }

        // Settlements
        const done = merged.filter(
          d => d.status === "Completed" || d.status === "completed" || d.statusId === 3
        );
        setSettlements(done);

        // Resolve pending share link against full merged set
        const pending = sessionStorage.getItem("pendingListing");
        if (pending) {
          const deal = merged.find(d => String(d.id) === pending);
          if (deal) { setSelectedDeal(deal); setPage("detail"); }
          sessionStorage.removeItem("pendingListing");
        }

        // Resolve #deal=N deep-link — fetch directly from chain
        const pendingDealId = sessionStorage.getItem("pendingDealId");
        if (pendingDealId) {
          sessionStorage.removeItem("pendingDealId");
          try {
            const c   = getContract();
            const raw = await c.getDeal(Number(pendingDealId));
            const d   = parseDeal(Number(pendingDealId), raw);
            setSelectedDeal(d);
            setPage("detail");
          } catch {
            setSelectedDeal({ id: Number(pendingDealId), stub: true });
            setPage("detail");
          }
        }

      } catch {
        // All backends offline — stay with localStorage, still functional
        setDeals(localListings);
        const done = localListings.filter(
          d => d.status === "Completed" || d.status === "completed"
        );
        setSettlements(done);

        const pending = sessionStorage.getItem("pendingListing");
        if (pending) {
          const deal = localListings.find(d => String(d.id) === pending);
          if (deal) { setSelectedDeal(deal); setPage("detail"); }
          sessionStorage.removeItem("pendingListing");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── wallet connection ──────────────────────────────── */
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install it.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setWallet(accounts[0]);
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x7BB" }],
        });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x7BB",
              chainName: "Ritual Testnet",
              rpcUrls: ["https://rpc.ritualfoundation.org"],
              nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
              blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
            }],
          });
        }
      }
    } catch (err) {
      console.error("Wallet error:", err);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (a) => setWallet(a[0] ?? null);
    const onChain    = (chainId) => setWrongNetwork(chainId?.toLowerCase() !== RITUAL_CHAIN_ID);
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged",    onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged",    onChain);
    };
  }, []);

  // Auto-reconnect wallet on page load (no prompt)
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" })
      .then(accounts => { if (accounts?.[0]) setWallet(accounts[0]); })
      .catch(() => {});
    // Check current chain
    window.ethereum.request({ method: "eth_chainId" })
      .then(chainId => setWrongNetwork(chainId?.toLowerCase() !== RITUAL_CHAIN_ID))
      .catch(() => {});
  }, []);

  // Check RITUAL balance when wallet changes
  useEffect(() => {
    if (!wallet || !window.ethereum) { setRitualBalance(null); return; }
    const { JsonRpcProvider } = ethers;
    const provider = new JsonRpcProvider("https://rpc.ritualfoundation.org");
    provider.getBalance(wallet)
      .then(bal => setRitualBalance(parseFloat(ethers.formatEther(bal))))
      .catch(() => setRitualBalance(null));
  }, [wallet]);

  /* ── navigation helpers ─────────────────────────────── */
  function openDeal(deal) {
    setSelectedDeal(deal);
    setPage("detail");
    window.scrollTo(0, 0);
  }

  function respondToIntent(deal) {
    setIntentForRoom(deal);
    setPage("private");
  }

  function goHome() {
    setSelectedDeal(null);
    setIntentForRoom(null);
    setPage("home");
    window.scrollTo(0, 0);
    history.pushState("", document.title, window.location.pathname);
  }

  function goMarket() {
    setIntentForRoom(null);
    setPage("market");
    window.scrollTo(0, 0);
  }

  /* ── new listing submitted via wizard ───────────────── */
  async function handleNewListing(listing) {
    // Stamp the creator's wallet onto the listing for ownership filtering
    const stamped = { ...listing, walletAddress: wallet || null, createdAt: listing.createdAt || Date.now() };

    // Optimistic update — user sees it immediately
    setDeals(prev => {
      const updated = [stamped, ...prev];
      saveLocalListings(updated);
      return updated;
    });

    // POST to Supabase (primary) + Render (secondary backup)
    if (supabaseConfigured) {
      sbUpsertDeal(stamped).catch(() => {});
    }
    try {
      await fetch(API + "/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stamped),
      });
    } catch {
      // Backend offline — listing still lives in localStorage + Supabase
    }

    // Auto-tweet new listing via bot
    try {
      await fetch(API + "/tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset:    stamped.asset,
          price:    stamped.price,
          side:     stamped.side,
          category: stamped.category,
          url:      "https://shadow-otc.vercel.app",
        }),
      });
    } catch {
      // Twitter bot offline — non-fatal
    }

    goHome();
    setTimeout(() => {
      const el = document.getElementById("listings-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  function handleJoinEarlyAccess() {
    // Early access just navigates to the Dashboard where they can save their email
    setPage("dashboard");
  }

  function disconnectWallet() {
    setWallet(null);
  }

  /* ── routing ────────────────────────────────────────── */
  function pageContent() {
    if (page === "detail" && selectedDeal) {
      return (
        <DealDetails
          deal={selectedDeal}
          wallet={wallet}
          onConnect={connectWallet}
          onBack={goHome}
        />
      );
    }
    if (page === "create") {
      return (
        <CreateDeal
          wallet={wallet}
          onConnect={connectWallet}
          onBack={goHome}
          onViewDeal={async (dealId) => {
            try {
              const contract = getContract();
              const raw  = await contract.getDeal(dealId);
              const deal = parseDeal(dealId, raw);

              // Persist with correct on-chain ID to all backends
              const stamped = { ...deal, walletAddress: wallet || null };
              setDeals(prev => {
                if (prev.some(d => String(d.id) === String(dealId))) return prev;
                const updated = [stamped, ...prev];
                saveLocalListings(updated);
                return updated;
              });
              if (supabaseConfigured) sbUpsertDeal(stamped).catch(() => {});
              fetch(API + "/deals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(stamped),
              }).catch(() => {});

              openDeal(deal);
            } catch {
              openDeal({ id: dealId, stub: true });
            }
          }}
        />
      );
    }
    if (page === "dashboard") {
      return (
        <Dashboard
          wallet={wallet}
          onConnect={connectWallet}
          onBack={goHome}
          onDealClick={openDeal}
          onStartOTCRoom={() => setPage("private")}
        />
      );
    }
    if (page === "private") {
      return (
        <PrivateDealRoom
          wallet={wallet}
          onConnect={connectWallet}
          onBack={goHome}
          intentData={intentForRoom}
        />
      );
    }
    if (page === "market") {
      return (
        <MarketPage
          wallet={wallet}
          onConnect={connectWallet}
          onBack={goHome}
          onDealClick={openDeal}
          onCreateListing={() => setPage("create")}
          onDashboard={() => setPage("dashboard")}
          onStartOTCRoom={() => setPage("private")}
          onRespondToIntent={respondToIntent}
        />
      );
    }
    return (
      <Homepage
        deals={deals}
        settlements={settlements}
        loading={loading}
        wallet={wallet}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        onDealClick={openDeal}
        onCreateListing={() => setPage("create")}
        onJoinEarlyAccess={handleJoinEarlyAccess}
        onDashboard={() => setPage("dashboard")}
        onStartOTCRoom={() => setPage("private")}
        onMarket={goMarket}
        onRespondToIntent={respondToIntent}
      />
    );
  }

  return (
    <>
      {pageContent()}

      {/* ── Zero-balance faucet prompt ──────────────────────────────── */}
      {wallet && ritualBalance !== null && ritualBalance === 0 && !faucetDismissed && !wrongNetwork && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 10001,
          background: "linear-gradient(90deg,#0B6B4B,#0d8a5e)",
          color: "#fff", padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          fontSize: 13, fontWeight: 600, fontFamily: "monospace",
          flexWrap: "wrap",
        }}>
          <span>🪙 Your wallet has 0 RITUAL — you need testnet tokens to create deals.</span>
          <a href={RITUAL_FAUCET_URL} target="_blank" rel="noopener noreferrer"
            style={{
              background: "rgba(255,255,255,0.20)", border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 6, padding: "4px 12px", color: "#fff",
              fontSize: 12, fontWeight: 700, textDecoration: "none",
            }}>
            Get free RITUAL →
          </a>
          <button onClick={() => { setFaucetDismissed(true); localStorage.setItem("shadowotc_faucet_dismissed","1"); }}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.60)", fontSize:16, cursor:"pointer", padding:"0 4px" }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Wrong network banner ──────────────────────────────────────── */}
      {wrongNetwork && wallet && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
          background: "#7c2d12", color: "#fde8d8",
          padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          fontSize: 13, fontWeight: 600, fontFamily: "monospace",
        }}>
          <span>⚠️ Wrong network — please switch to</span>
          <button
            onClick={async () => {
              try {
                await window.ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: "0x7bb" }],
                });
              } catch (e) {
                if (e.code === 4902) {
                  await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                      chainId: RITUAL_CHAIN_ID,
                      chainName: "Ritual Testnet",
                      rpcUrls: ["https://rpc.ritualfoundation.org"],
                      nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
                      blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
                    }],
                  });
                }
              }
            }}
            style={{
              background: "#fde8d8", color: "#7c2d12",
              border: "none", borderRadius: 6, padding: "4px 12px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
            Switch to Ritual Testnet
          </button>
        </div>
      )}


      {/* ── Notification toasts (fixed overlay — works on all pages) ── */}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed", bottom: 24, right: 20,
          zIndex: 9999, display: "flex", flexDirection: "column", gap: 8,
          pointerEvents: "none",
        }}>
          {toasts.map(t => (
            <div key={t.id}
              style={{
                pointerEvents: "all",
                display: "flex", alignItems: "center", gap: 10,
                background: "#0F1F1A",
                border: "1px solid rgba(11,107,75,0.40)",
                borderRadius: 14,
                padding: "10px 14px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.30)",
                cursor: "pointer",
                minWidth: 240, maxWidth: 320,
                animation: "slideInToast 0.25s ease",
              }}
              onClick={() => {
                setToasts(prev => prev.filter(x => x.id !== t.id));
                // Navigate to the deal
                const c = getContract();
                c.getDeal(t.dealId)
                  .then(raw => openDeal(parseDeal(t.dealId, raw)))
                  .catch(() => openDeal({ id: t.dealId, stub: true }));
              }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔔</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", margin: 0, lineHeight: 1.4 }}>
                  Deal #{t.dealId}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.60)", margin: 0, marginTop: 1 }}>
                  {t.msg}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}
                style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background:"none", border:"none", cursor:"pointer", flexShrink:0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      {["home","market","create","dashboard"].includes(page) && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9990,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          display: "flex", alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -2px 20px rgba(0,0,0,0.06)",
        }} className="sm:hidden">
          {[
            {
              id: "home", label: "Home",
              paths: ["M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"],
            },
            {
              id: "market", label: "Market",
              paths: ["M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"],
            },
            { id: "create", label: "Post", special: true },
            {
              id: "dashboard", label: "Profile",
              paths: ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", "M12 11a4 4 0 100-8 4 4 0 000 8z"],
            },
          ].map(tab => {
            const active = page === tab.id;
            if (tab.special) {
              return (
                <button key={tab.id}
                  onClick={() => { setPage("create"); window.scrollTo(0, 0); }}
                  style={{
                    flex: 1, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                    gap: 3, padding:"8px 4px 10px",
                    background:"none", border:"none", cursor:"pointer",
                  }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: active ? "#0B6B4B" : "#EAF4EF",
                    border: "1.5px solid rgba(11,107,75,0.28)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow: "0 2px 12px rgba(11,107,75,0.22)",
                  }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"
                      stroke={active ? "#fff" : "#0B6B4B"} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </div>
                  <span style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? "#0B6B4B" : "#9CA3AF", letterSpacing:"0.01em" }}>
                    {tab.label}
                  </span>
                </button>
              );
            }
            return (
              <button key={tab.id}
                onClick={() => {
                  if (tab.id === "market") goMarket();
                  else { setPage(tab.id); setIntentForRoom(null); window.scrollTo(0, 0); }
                }}
                style={{
                  flex: 1, display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  gap: 4, padding:"10px 4px 12px",
                  background:"none", border:"none", cursor:"pointer",
                  position:"relative",
                }}>
                {active && (
                  <span style={{
                    position:"absolute", top: 0, left:"50%", transform:"translateX(-50%)",
                    width: 20, height: 2, borderRadius:"0 0 2px 2px",
                    background:"#0B6B4B",
                  }}/>
                )}
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
                  stroke={active ? "#0B6B4B" : "#9CA3AF"}
                  strokeWidth={active ? 2.2 : 1.7}
                  strokeLinecap="round" strokeLinejoin="round">
                  {tab.paths.map((p, i) => <path key={i} d={p}/>)}
                </svg>
                <span style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? "#0B6B4B" : "#9CA3AF", letterSpacing:"0.01em" }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Bottom padding on mobile so nav doesn't cover content */}
      {["home","market","create","dashboard"].includes(page) && (
        <div className="h-16 sm:hidden" />
      )}

      {/* Toast slide-in keyframe */}
      <style>{`
        @keyframes slideInToast {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </>
  );
}
