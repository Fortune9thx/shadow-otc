const express = require("express");
const cors = require("cors");
require("dotenv").config();

const chain = require("./chain");
const dealManager = require("./dealManager");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ── Health check ─────────────────────────────────────
app.get("/", (req, res) => {
    res.json({
        name: "Shadow OTC API",
        network: "Ritual Testnet",
        contract: process.env.CONTRACT_ADDRESS,
        status: "running",
    });
});

// ── GET /deal/:id — fetch deal from chain ─────────────
app.get("/deal/:id", async (req, res) => {
    try {
        const deal = await chain.getDeal(req.params.id);
        const logs = dealManager.getLogs(req.params.id);
        res.json({ ...deal, logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /deals — total deal count ────────────────────
app.get("/deals", async (req, res) => {
    try {
        const total = await chain.getTotalDeals();
        res.json({ total, contract: process.env.CONTRACT_ADDRESS });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /deal/create — full automated flow ───────────
app.post("/deal/create", async (req, res) => {
    const { intent, budget } = req.body;

    if (!intent || !budget) {
        return res.status(400).json({ error: "intent and budget required" });
    }

    console.log(`\n[API] New deal request — intent: "${intent}" budget: ${budget}`);

    // Respond immediately, run deal in background
    res.json({
        message: "Deal pipeline started",
        note: "Poll GET /deal/:id for updates",
    });

    // Run full pipeline async
    dealManager.runFullDeal(intent, budget).then(result => {
        console.log("[API] Deal pipeline complete:", result);
    }).catch(err => {
        console.error("[API] Deal pipeline error:", err.message);
    });
});

// ── POST /deal/manual/accept — manual seller accept ───
app.post("/deal/manual/accept", async (req, res) => {
    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ error: "dealId required" });
    try {
        const result = await chain.acceptDeal(dealId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /deal/manual/verify — manual verify ──────────
app.post("/deal/manual/verify", async (req, res) => {
    const { dealId, forceSuccess } = req.body;
    if (!dealId) return res.status(400).json({ error: "dealId required" });
    try {
        const deal = await chain.getDeal(dealId);
        const success = forceSuccess !== undefined
            ? forceSuccess
            : await dealManager.verifyCondition(deal.intent);
        const result = await chain.executeDeal(dealId, success);
        res.json({ success, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Start server ──────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Shadow OTC Backend running on http://localhost:${PORT}`);
    console.log(`📡 Network: Ritual Testnet`);
    console.log(`📄 Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /              — health check`);
    console.log(`  GET  /deals         — total deals`);
    console.log(`  GET  /deal/:id      — get deal status`);
    console.log(`  POST /deal/create   — create + auto-run deal`);
    console.log(`  POST /deal/manual/accept  — manual accept`);
    console.log(`  POST /deal/manual/verify  — manual verify\n`);
});