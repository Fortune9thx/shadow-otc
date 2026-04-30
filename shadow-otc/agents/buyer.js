const { ethers } = require("ethers");
require("dotenv").config();

// Contract ABI (only the functions we need)
const ABI = [
    "function createDeal(string calldata intent) external payable returns (uint256)",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer, address seller, uint256 amount, string intent, uint8 status))",
    "event DealCreated(uint256 indexed dealId, address buyer, string intent, uint256 amount)",
    "event DealAccepted(uint256 indexed dealId, address seller)",
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const BUYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RITUAL_RPC_URL;

// Deal parameters
const INTENT = "Promote my tweet and reach 50 likes - URL: https://x.com/example/status/123456";
const BUDGET_RITUAL = "0.01"; // 0.01 RITUAL

async function main() {
    console.log("=== BUYER AGENT STARTING ===");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(BUYER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    const balance = await provider.getBalance(wallet.address);
    console.log("Buyer address:", wallet.address);
    console.log("Buyer balance:", ethers.formatEther(balance), "RITUAL");

    // Step 1: Create the deal
    console.log("\n[Step 1] Creating deal...");
    console.log("Intent:", INTENT);
    console.log("Budget:", BUDGET_RITUAL, "RITUAL");

    const tx = await contract.createDeal(INTENT, {
        value: ethers.parseEther(BUDGET_RITUAL),
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");

    // Get dealId from event
    const event = receipt.logs.find(log => {
        try {
            const parsed = contract.interface.parseLog(log);
            return parsed.name === "DealCreated";
        } catch { return false; }
    });

    const parsed = contract.interface.parseLog(event);
    const dealId = parsed.args.dealId;
    console.log("\n✅ Deal created! Deal ID:", dealId.toString());

    // Step 2: Wait and watch for seller
    console.log("\n[Step 2] Waiting for seller to accept...");
    console.log("Watching for DealAccepted event...\n");

    let accepted = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!accepted && attempts < maxAttempts) {
        const deal = await contract.getDeal(dealId);
        const statusMap = ["Open", "Accepted", "Completed", "Failed"];
        console.log(`[Check ${attempts + 1}] Deal status: ${statusMap[deal.status]}`);

        if (deal.status >= 1) {
            console.log("\n✅ Deal accepted by seller:", deal.seller);
            console.log("Funds locked in contract. Seller will now complete the task.");
            accepted = true;
        } else {
            attempts++;
            await sleep(5000); // check every 5 seconds
        }
    }

    if (!accepted) {
        console.log("No seller accepted within timeout. Run seller agent.");
    }

    console.log("\n=== BUYER AGENT DONE ===");
    console.log("Deal ID to share with seller:", dealId.toString());
    console.log("Contract:", CONTRACT_ADDRESS);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error("BUYER ERROR:", err.message);
    process.exit(1);
});