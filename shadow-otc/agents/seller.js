const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RITUAL_RPC_URL;
const SELLER_KEY = process.env.SELLER_PRIVATE_KEY;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS_V2 || process.env.CONTRACT_ADDRESS;
const DEAL_ID = process.argv[2];
const PROOF_URL = process.argv[3] || "";

const ABI = [
    "function acceptDeal(uint256 dealId) external payable",
    "function submitDelivery(uint256 dealId,string calldata proofUrl) external",
    "function raiseDispute(uint256 dealId,string calldata reason) external",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
    "function getRequiredCollateral(uint256 dealId) external view returns (uint256)",
];

const CATEGORY_NAMES = ["Social Media", "Content Creation", "Freelance", "NFT Transfer", "NFT Whitelist", "Airdrop Allocation", "Token Allocation", "Pre-Market", "Marketing", "Bug Bounty", "Escrow", "Conditional"];
const STATUS = ["Open", "Accepted", "Pending Delivery", "Verifying", "Completed", "Failed", "Disputed", "Cancelled", "Expired"];
const COLLATERAL_NAMES = ["None", "Partial (30%)", "Full (100%)", "Double (200%)"];

async function main() {
    if (!DEAL_ID) {
        console.error("Usage: node seller.js <dealId> [proofUrl]");
        process.exit(1);
    }

    console.log("\n========================================");
    console.log("  SHADOW OTC V2 — SELLER AGENT");
    console.log("========================================\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(SELLER_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Seller: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} RITUAL\n`);

    // Read deal
    const deal = await contract.getDeal(DEAL_ID);
    const category = CATEGORY_NAMES[Number(deal.category)] || "Unknown";
    const status = STATUS[Number(deal.status)];
    const collateral = COLLATERAL_NAMES[Number(deal.collateralRequirement)] || "None";

    console.log(`--- Deal #${DEAL_ID} ---`);
    console.log(`Category:    ${category}`);
    console.log(`Status:      ${status}`);
    console.log(`Intent:      ${deal.intent}`);
    console.log(`Payment:     ${ethers.formatEther(deal.paymentAmount)} RITUAL`);
    console.log(`Commit Fee:  ${ethers.formatEther(deal.commitmentFee)} RITUAL (released on accept)`);
    console.log(`Remaining:   ${ethers.formatEther(deal.remainingPayment)} RITUAL (released on completion)`);
    console.log(`Collateral:  ${collateral}`);
    console.log(`Deadline:    ${new Date(Number(deal.deadline) * 1000).toLocaleString()}`);
    console.log(`Condition:   ${deal.conditionUrl}`);

    // Check if expired
    if (Date.now() / 1000 > Number(deal.deadline)) {
        console.log("\n[!] This deal has already expired.");
        return;
    }

    // PHASE 1: Accept the deal
    if (Number(deal.status) === 0) {
        await acceptDealFlow(DEAL_ID, deal, contract, wallet);
        return;
    }

    // PHASE 2: Submit delivery proof
    if (Number(deal.status) === 1) {
        if (!PROOF_URL) {
            console.log("\n[!] Deal is accepted. Submit your delivery proof:");
            console.log(`    node agents/seller.js ${DEAL_ID} <your-proof-url>`);
            console.log("\nWhat to submit as proof:");
            printProofGuide(Number(deal.category));
            return;
        }
        await submitDeliveryFlow(DEAL_ID, PROOF_URL, contract);
        return;
    }

    console.log(`\n[!] Deal is currently: ${status}`);
    console.log("No action needed from seller at this stage.");
}

async function acceptDealFlow(dealId, deal, contract, wallet) {
    console.log("\n[Step 1] Evaluating deal offer...");

    // Minimum viable check
    const payment = parseFloat(ethers.formatEther(deal.paymentAmount));
    if (payment < 0.005) {
        console.log(`[REJECT] Payment too low: ${payment} RITUAL`);
        return;
    }

    console.log(`[ACCEPT] Offer acceptable: ${payment} RITUAL`);

    // Get required collateral
    const requiredCollateral = await contract.getRequiredCollateral(dealId);
    const collateralEth = ethers.formatEther(requiredCollateral);

    console.log(`\nRequired collateral: ${collateralEth} RITUAL`);

    if (requiredCollateral > 0n) {
        const balance = await wallet.provider.getBalance(wallet.address);
        if (balance < requiredCollateral) {
            console.log(`[ERROR] Insufficient balance for collateral. Need ${collateralEth} RITUAL`);
            return;
        }
    }

    console.log("\nAccepting deal on-chain...");
    const tx = await contract.acceptDeal(dealId, { value: requiredCollateral });
    console.log(`TX: ${tx.hash}`);
    await tx.wait();

    console.log(`\n[OK] Deal accepted!`);
    if (deal.commitmentFee > 0n) {
        console.log(`[OK] Commit fee received: ${ethers.formatEther(deal.commitmentFee)} RITUAL`);
    }

    console.log(`\nNow complete the task and submit proof:`);
    console.log(`  node agents/seller.js ${dealId} <your-proof-url>`);
    console.log(`\nTask to complete:`);
    console.log(`  ${deal.intent}`);
    printProofGuide(Number(deal.category));
}

async function submitDeliveryFlow(dealId, proofUrl, contract) {
    console.log(`\n[Step 2] Submitting delivery proof...`);
    console.log(`Proof URL: ${proofUrl}`);

    const tx = await contract.submitDelivery(dealId, proofUrl);
    console.log(`TX: ${tx.hash}`);
    await tx.wait();

    console.log(`\n[OK] Delivery submitted!`);
    console.log(`\nVerifier will now check your proof. Run:`);
    console.log(`  node agents/verifier.js ${dealId}`);
}

function printProofGuide(category) {
    const guides = {
        0: `  Proof: URL of the post with required engagement (e.g. https://x.com/user/status/123)`,
        1: `  Proof: URL of the published content (blog post, article, video link)`,
        2: `  Proof: Live URL of the deployed work or GitHub PR link`,
        3: `  Proof: Transaction hash or explorer link showing NFT transfer`,
        4: `  Proof: Screenshot URL or allowlist checker showing buyer's wallet is whitelisted`,
        5: `  Proof: Protocol claim page URL showing buyer's wallet has allocation`,
        6: `  Proof: Vesting contract URL or explorer link showing buyer as beneficiary`,
        7: `  Proof: Token listing URL on DEX or exchange showing price`,
        8: `  Proof: URL of the published promotion, backlink, or newsletter`,
        9: `  Proof: GitHub issue or PR URL containing the bug report or fix`,
        10: `  Proof: Any URL confirming the agreed exchange has been completed`,
        11: `  Proof: URL where the condition can be verified`,
    };
    console.log("\nProof guidance for this deal type:");
    console.log(guides[category] || "  Submit the URL that proves your work is done");
}

main().catch(err => {
    console.error("\nSELLER ERROR:", err.message);
    process.exit(1);
});