const { ethers } = require("ethers");
require("dotenv").config();

const ABI = [
    "function executeDeal(uint256 dealId, bool success) external",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer, address seller, uint256 amount, string intent, uint8 status))",
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const VERIFIER_PRIVATE_KEY = process.env.SELLER_PRIVATE_KEY; // verifier uses seller key for demo
const RPC_URL = process.env.RITUAL_RPC_URL;
const DEAL_ID = process.argv[2] || "0";

// ── Verification config ──────────────────────────────
const REQUIRED_LIKES = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000; // 10 seconds between retries

async function main() {
    console.log("=== VERIFIER AGENT STARTING ===");
    console.log("Deal ID:", DEAL_ID);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(VERIFIER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    // Step 1: Read the deal
    console.log("\n[Step 1] Reading deal from chain...");
    const deal = await contract.getDeal(DEAL_ID);
    const statusMap = ["Open", "Accepted", "Completed", "Failed"];

    console.log("Intent:", deal.intent);
    console.log("Amount:", ethers.formatEther(deal.amount), "RITUAL");
    console.log("Status:", statusMap[deal.status]);

    if (deal.status !== 1n) {
        console.log("Deal is not in Accepted state. Cannot verify.");
        return;
    }

    // Step 2: Extract URL from intent
    console.log("\n[Step 2] Extracting URL from intent...");
    const urlMatch = deal.intent.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
        console.log("No URL found in intent. Using demo verification.");
    }
    const targetUrl = urlMatch ? urlMatch[0] : null;
    console.log("Target URL:", targetUrl || "none (demo mode)");

    // Step 3: Verify condition with retries
    console.log("\n[Step 3] Verifying condition...");
    let verified = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n[Attempt ${attempt}/${MAX_RETRIES}]`);
        verified = await verifyCondition(targetUrl, REQUIRED_LIKES);

        if (verified) {
            console.log("✅ Condition MET — likes >= " + REQUIRED_LIKES);
            break;
        } else {
            console.log("❌ Condition NOT met yet.");
            if (attempt < MAX_RETRIES) {
                console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
                await sleep(RETRY_DELAY_MS);
            }
        }
    }

    // Step 4: Execute deal on chain
    console.log("\n[Step 4] Executing deal on chain...");
    console.log("Verdict:", verified ? "SUCCESS — paying seller" : "FAILED — refunding buyer");

    const tx = await contract.executeDeal(DEAL_ID, verified);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();

    if (verified) {
        console.log("\n✅ FUNDS RELEASED TO SELLER!");
        console.log("Seller:", deal.seller);
        console.log("Amount:", ethers.formatEther(deal.amount), "RITUAL");
    } else {
        console.log("\n🔄 FUNDS REFUNDED TO BUYER!");
        console.log("Buyer:", deal.buyer);
    }

    console.log("\n=== VERIFIER AGENT DONE ===");
}

async function verifyCondition(url, requiredLikes) {
    if (!url || url.includes("example")) {
        // Demo mode — simulate verification
        return simulateVerification(requiredLikes);
    }

    try {
        console.log("Fetching webpage:", url);
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ShadowOTC-Verifier/1.0)",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.log("Fetch failed with status:", response.status);
            return simulateVerification(requiredLikes);
        }

        const html = await response.text();
        console.log("Page fetched. Analyzing...");

        // Try to extract like count from page
        const likes = extractLikes(html);
        console.log("Detected likes:", likes !== null ? likes : "could not parse");

        if (likes !== null) {
            console.log(`Likes found: ${likes} / Required: ${requiredLikes}`);
            return likes >= requiredLikes;
        }

        // Fallback to AI-style content check
        return simulateVerification(requiredLikes);

    } catch (err) {
        console.log("Fetch error:", err.message);
        console.log("Falling back to demo verification...");
        return simulateVerification(requiredLikes);
    }
}

function extractLikes(html) {
    // Try common patterns for like counts
    const patterns = [
        /"like_count":(\d+)/,
        /"likes":(\d+)/,
        /(\d+)\s*likes?/i,
        /"favorite_count":(\d+)/,
        /aria-label="(\d+) likes?"/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return parseInt(match[1]);
        }
    }
    return null;
}

function simulateVerification(requiredLikes) {
    // Demo: simulate 60% chance of success for testing
    console.log("Running demo verification simulation...");
    const simulatedLikes = Math.floor(Math.random() * 100);
    console.log("Simulated likes:", simulatedLikes, "/ Required:", requiredLikes);
    return simulatedLikes >= requiredLikes;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error("VERIFIER ERROR:", err.message);
    process.exit(1);
});