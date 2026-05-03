const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS: allow Vercel frontend + localhost ──────────────────────────────────
app.use(cors({
    origin: [
        'https://shadow-otc.vercel.app',
        'http://localhost:3000',
        'http://localhost:5000',
        /\.vercel\.app$/
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ── Ritual Chain provider ────────────────────────────────────────────────────
const RPC_URL = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS_V2 || '0xe48aB58BEA9AD3d4c94A3d09c5Fd98320151bF80';

const ABI = [
    "function dealCount() view returns (uint256)",
    "function getDeal(uint256 dealId) view returns (tuple(address buyer, address seller, uint256 amount, uint256 collateral, uint8 category, uint8 status, string proofUrl, uint256 createdAt, uint256 completedAt))",
    "event DealCreated(uint256 indexed dealId, address indexed buyer, uint8 category, uint256 amount)",
    "event DealCompleted(uint256 indexed dealId)",
    "event DealDisputed(uint256 indexed dealId)"
];

// Status map
const STATUS = ['Open', 'Accepted', 'Delivered', 'Completed', 'Disputed', 'Cancelled'];
const CATEGORY = [
    'Social Media', 'Content Creation', 'Freelance', 'NFT OTC Sale',
    'NFT Whitelist', 'Airdrop Allocation', 'Token Allocation', 'Pre-Market',
    'Marketing', 'Bug Bounty', 'Escrow', 'Conditional'
];

let provider;
let contract;

async function initChain() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const network = await provider.getNetwork();
        console.log(`✅ Connected to Ritual Chain ID: ${network.chainId}`);
    } catch (err) {
        console.error('❌ Chain connection failed:', err.message);
    }
}
initChain();

// ── Helper: fetch all deals ──────────────────────────────────────────────────
async function fetchAllDeals() {
    const count = await contract.dealCount();
    const total = Number(count);
    const deals = [];

    for (let i = 0; i < total; i++) {
        try {
            const d = await contract.getDeal(i);
            deals.push({
                id: i,
                buyer: d.buyer,
                seller: d.seller,
                amount: ethers.formatEther(d.amount),
                collateral: ethers.formatEther(d.collateral),
                category: CATEGORY[Number(d.category)] || `Category ${d.category}`,
                categoryId: Number(d.category),
                status: STATUS[Number(d.status)] || `Status ${d.status}`,
                statusId: Number(d.status),
                proofUrl: d.proofUrl,
                createdAt: Number(d.createdAt),
                completedAt: Number(d.completedAt)
            });
        } catch (e) {
            console.error(`Error fetching deal ${i}:`, e.message);
        }
    }
    return deals;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Shadow OTC Backend', network: 'Ritual Testnet', chainId: 1979 });
});

// GET /deals — summary stats
app.get('/deals', async (req, res) => {
    try {
        const deals = await fetchAllDeals();
        const open = deals.filter(d => d.statusId === 0).length;
        const completed = deals.filter(d => d.statusId === 3).length;
        const disputed = deals.filter(d => d.statusId === 4).length;
        const totalLocked = deals.reduce((sum, d) => sum + parseFloat(d.amount), 0);

        res.json({
            total: deals.length,
            open,
            completed,
            disputed,
            totalLocked: totalLocked.toFixed(4),
            deals
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /deal/:id — single deal
app.get('/deal/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const d = await contract.getDeal(id);
        res.json({
            id,
            buyer: d.buyer,
            seller: d.seller,
            amount: ethers.formatEther(d.amount),
            collateral: ethers.formatEther(d.collateral),
            category: CATEGORY[Number(d.category)] || `Category ${d.category}`,
            categoryId: Number(d.category),
            status: STATUS[Number(d.status)] || `Status ${d.status}`,
            statusId: Number(d.status),
            proofUrl: d.proofUrl,
            createdAt: Number(d.createdAt),
            completedAt: Number(d.completedAt)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /deal/create — pipeline trigger (agents handle actual tx)
app.post('/deal/create', (req, res) => {
    const { category, amount } = req.body;
    if (!category || !amount) {
        return res.status(400).json({ error: 'category and amount required' });
    }
    res.json({
        message: 'Deal creation queued',
        category,
        amount,
        note: 'Run: node agents/buyer.js ' + category + ' ' + amount
    });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Shadow OTC backend running on port ${PORT}`);
    console.log(`📡 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}`);
});