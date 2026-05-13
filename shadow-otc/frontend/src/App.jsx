import { useEffect, useState } from "react";
import Homepage        from "./components/Homepage";
import DealDetails     from "./components/DealDetails";
import CreateDeal      from "./components/CreateDeal";
import Dashboard       from "./components/Dashboard";
import PrivateDealRoom from "./components/PrivateDealRoom";

const API              = "https://shadow-otc.onrender.com";
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

export default function App() {
  const [page, setPage]                 = useState("home");
  const [wallet, setWallet]             = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [deals, setDeals]               = useState(() => loadLocalListings());
  const [settlements, setSettlements]   = useState([]);
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);

  /* ── handle share link on load ──────────────────────── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#listing=")) {
      const id = hash.split("=")[1];
      sessionStorage.setItem("pendingListing", id);
    }
    if (hash.startsWith("#deal=")) {
      setPage("private");
    }
  }, []);

  /* ── fetch real listings from backend ───────────────── */
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(API + "/deals");
        const data = await res.json();
        if (data.deals?.length) {
          // Merge backend deals with local listings, dedupe by id
          setDeals(prev => {
            const backendIds = new Set(data.deals.map(d => String(d.id)));
            const localOnly  = prev.filter(d => !backendIds.has(String(d.id)));
            const merged     = [...data.deals, ...localOnly];
            saveLocalListings(merged);
            return merged;
          });
          const done = data.deals.filter(
            d => d.status === "Completed" || d.statusId === 3
          );
          setSettlements(done);

          // Resolve pending share link
          const pending = sessionStorage.getItem("pendingListing");
          if (pending) {
            const deal = data.deals.find(d => String(d.id) === pending);
            if (deal) { setSelectedDeal(deal); setPage("detail"); }
            sessionStorage.removeItem("pendingListing");
          }
        }
      } catch {
        // backend offline - use localStorage listings, no fake data added
        const pending = sessionStorage.getItem("pendingListing");
        if (pending) {
          const deal = loadLocalListings().find(d => String(d.id) === pending);
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
    const h = (a) => setWallet(a[0] ?? null);
    window.ethereum.on("accountsChanged", h);
    return () => window.ethereum.removeListener("accountsChanged", h);
  }, []);

  /* ── navigation helpers ─────────────────────────────── */
  function openDeal(deal) {
    setSelectedDeal(deal);
    setPage("detail");
    window.scrollTo(0, 0);
  }

  function goHome() {
    setSelectedDeal(null);
    setPage("home");
    window.scrollTo(0, 0);
    history.pushState("", document.title, window.location.pathname);
  }

  /* ── new listing submitted via wizard ───────────────── */
  function handleNewListing(listing) {
    setDeals(prev => {
      const updated = [listing, ...prev];
      saveLocalListings(updated);
      return updated;
    });
    goHome();
    // Scroll to listings section after short delay so DOM updates
    setTimeout(() => {
      const el = document.getElementById("listings-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  function handleJoinEarlyAccess() {
    // TODO: replace with proper modal/form — window.prompt is not production-grade
    const email = window.prompt("Enter your email for early access:");
    if (email?.includes("@")) {
      // Show a styled in-page notification instead of alert()
      const toast = document.createElement("div");
      toast.textContent = `✓ ${email} added to early access list`;
      Object.assign(toast.style, {
        position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
        background: "#0B6B4B", color: "#fff", padding: "12px 20px",
        borderRadius: "10px", fontSize: "13px", fontWeight: "600",
        boxShadow: "0 4px 20px rgba(0,0,0,0.20)", zIndex: "9999",
        transition: "opacity 0.3s",
      });
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 3000);
    }
  }

  /* ── routing ────────────────────────────────────────── */
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
        onSubmit={handleNewListing}
      />
    );
  }

  if (page === "dashboard") {
    return (
      <Dashboard
        wallet={wallet}
        onConnect={connectWallet}
        onBack={goHome}
        deals={deals}
        settlements={settlements}
      />
    );
  }

  if (page === "private") {
    return (
      <PrivateDealRoom
        wallet={wallet}
        onConnect={connectWallet}
        onBack={goHome}
        deal={selectedDeal}
      />
    );
  }

  return (
    <Homepage
      deals={deals}
      settlements={settlements}
      requests={requests}
      loading={loading}
      wallet={wallet}
      onConnect={connectWallet}
      onDealClick={openDeal}
      onCreateListing={() => setPage("create")}
      onJoinEarlyAccess={handleJoinEarlyAccess}
      onDashboard={() => setPage("dashboard")}
      onStartOTCRoom={() => setPage("private")}
    />
  );
}
