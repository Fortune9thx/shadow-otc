const { ethers } = require("ethers");
require("dotenv").config();

const ABI = [
    "function acceptDeal(uint256 dealId) external",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer, address seller, uint256 amount, string intent, uint8 status))",
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const SELLER_PRIVATE_KEY = process.env.SELLER_PRIVATE_KEY;
const RPC_URL = process.env.RITUAL_RPC_URL;
const DEAL_ID = process.argv[2] || "0";

async function main() {
    console.log("=== SELLER AGENT STARTING ===");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(SELLER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    console.log("Seller address:", wallet.address);

    const deal = await contract.getDeal(DEAL_ID);
    const statusMap = ["Open", "Accepted", "Completed", "Failed"];
    console.log("\n[Deal Info]");
    console.log("Buyer:", deal.buyer);
    console.log("Intent:", deal.intent);
    console.log("Amount:", ethers.formatEther(deal.amount), "RITUAL");
    console.log("Status:", statusMap[deal.status]);

    if (deal.status !== 0n) {
        console.log("Deal is not open. Cannot accept.");
        return;
    }

    const offerAmount = parseFloat(ethers.formatEther(deal.amount));
    if (offerAmount < 0.005) {
        console.log("Offer too low. Rejecting.");
        return;
    }

    console.log("\nAccepting deal...");
    const tx = await contract.acceptDeal(DEAL_ID);
    await tx.wait();
    console.log("✅ Deal accepted!");
    console.log("Now run: node agents/verifier.js", DEAL_ID);
}

main().catch(err => {
    console.error("SELLER ERROR:", err.message);
    process.exit(1);
});