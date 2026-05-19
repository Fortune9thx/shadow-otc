import { useEffect, useRef, useState } from "react";
import Homepage        from "./components/Homepage";
import DealDetails     from "./components/DealDetails";
import CreateDeal      from "./components/CreateDeal";
import Dashboard       from "./components/Dashboard";
import PrivateDealRoom from "./components/PrivateDealRoom";
import MarketPage      from "./components/MarketPage";
import { sbGetDeals, sbUpsertDeal, supabaseConfigured } from "./lib/supabase";
import { getContract, parseDeal, fetchMyDeals, STATUS_LABELS } from "./lib/contract";

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
              const raw = await contract.getDeal(dealId);
              const deal = parseDeal(dealId, raw);
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

      {/* ── Disconnect button (fixed top-right when wallet connected) ── */}
      {wallet && (
        <button
          onClick={disconnectWallet}
          title="Disconnect wallet"
          style={{
            position: "fixed", top: wrongNetwork && wallet ? 50 : 12, right: 14,
            zIndex: 9998,
            background: "rgba(15,20,18,0.85)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(11,107,75,0.35)",
            borderRadius: 8, padding: "5px 10px",
            color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
          <span style={{ color:"#4ade80" }}>●</span>
          {wallet.slice(0, 6)}…{wallet.slice(-4)}
          <span style={{ marginLeft: 4, opacity: 0.6 }}>✕</span>
        </button>
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
