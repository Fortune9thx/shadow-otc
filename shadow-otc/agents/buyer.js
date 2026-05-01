const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RITUAL_RPC_URL;
const BUYER_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS_V2 || process.env.CONTRACT_ADDRESS;

const ABI = [
    "function createDeal(uint8 category,string calldata intent,string calldata conditionUrl,string calldata conditionParams,uint256 deadlineHours,uint256 commitFeePercent,uint8 collateral,uint8 verificationMethod) external payable returns (uint256)",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
    "function cancelDeal(uint256 dealId) external",
    "function raiseDispute(uint256 dealId,string calldata reason) external",
    "function dealCounter() external view returns (uint256)",
    "event DealCreated(uint256 indexed dealId,address indexed buyer,uint8 category,uint256 amount,uint256 deadline)",
];

// Deal category presets
const DEAL_PRESETS = {
    social: {
        category: 0, // SOCIAL_MEDIA
        collateral: 1, // PARTIAL
        verification: 0, // HTTP_FETCH
        deadlineHours: 72,
        commitFeePercent: 0,
        description: "Social Media Engagement",
    },
    content: {
        category: 1, // CONTENT_CREATION
        collateral: 1, // PARTIAL
        verification: 0, // HTTP_FETCH
        deadlineHours: 168,
        commitFeePercent: 10,
        description: "Content Creation",
    },
    freelance: {
        category: 2, // FREELANCE
        collateral: 2, // FULL
        verification: 0, // HTTP_FETCH
        deadlineHours: 336,
        commitFeePercent: 20,
        description: "Freelance Service",
    },
    nft: {
        category: 3, // NFT_TRANSFER
        collateral: 2, // FULL
        verification: 1, // ON_CHAIN_READ
        deadlineHours: 48,
        commitFeePercent: 0,
        description: "NFT OTC Sale",
    },
    whitelist: {
        category: 4, // NFT_WHITELIST
        collateral: 2, // FULL
        verification: 3, // DUAL
        deadlineHours: 720,
        commitFeePercent: 0,
        description: "NFT Whitelist Spot",
    },
    airdrop: {
        category: 5, // AIRDROP_ALLOCATION
        collateral: 2, // FULL
        verification: 3, // DUAL
        deadlineHours: 168,
        commitFeePercent: 0,
        description: "Airdrop Allocation",
    },
    allocation: {
        category: 6, // TOKEN_ALLOCATION
        collateral: 3, // DOUBLE
        verification: 1, // ON_CHAIN_READ
        deadlineHours: 720,
        commitFeePercent: 0,
        description: "Token Allocation OTC",
    },
    premarket: {
        category: 7, // PRE_MARKET
        collateral: 3, // DOUBLE
        verification: 1, // ON_CHAIN_READ
        deadlineHours: 2160,
        commitFeePercent: 0,
        description: "Pre-Market Token Deal",
    },
    marketing: {
        category: 8, // MARKETING
        collateral: 1, // PARTIAL
        verification: 0, // HTTP_FETCH
        deadlineHours: 168,
        commitFeePercent: 10,
        description: "Marketing and Promotion",
    },
    bounty: {
        category: 9, // BUG_BOUNTY
        collateral: 0, // NONE
        verification: 0, // HTTP_FETCH
        deadlineHours: 72,
        commitFeePercent: 0,
        description: "Bug Bounty",
    },
    escrow: {
        category: 10, // ESCROW
        collateral: 0, // NONE
        verification: 2, // MANUAL
        deadlineHours: 168,
        commitFeePercent: 0,
        description: "Generic Escrow",
    },
    conditional: {
        category: 11, // CONDITIONAL
        collateral: 0, // NONE
        verification: 0, // HTTP_FETCH
        deadlineHours: 168,
        commitFeePercent: 0,
        description: "Conditional Payment",
    },
};

async function main() {
    const args = process.argv.slice(2);
    const dealType = args[0] || "social";
    const budget = args[1] || "0.01";

    console.log("\n========================================");
    console.log("  SHADOW OTC V2 — BUYER AGENT");
    console.log("========================================\n");

    const preset = DEAL_PRESETS[dealType];
    if (!preset) {
        console.error(`Unknown deal type: ${dealType}`);
        console.error(`Available types: ${Object.keys(DEAL_PRESETS).join(", ")}`);
        process.exit(1);
    }

    console.log(`Deal Type:   ${preset.description}`);
    console.log(`Budget:      ${budget} RITUAL`);
    console.log(`Deadline:    ${preset.deadlineHours} hours`);
    console.log(`Collateral:  ${["None", "Partial (30%)", "Full (100%)", "Double (200%)"][preset.collateral]}`);
    console.log(`Commit Fee:  ${preset.commitFeePercent}%`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(BUYER_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);

    const balance = await provider.getBalance(wallet.address);
    console.log(`\nBuyer: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} RITUAL`);

    // Build deal parameters based on type
    const { intent, conditionUrl, conditionParams } = buildDealParams(dealType);

    console.log(`\n--- Creating Deal ---`);
    console.log(`Intent: ${intent}`);
    console.log(`Condition URL: ${conditionUrl}`);

    const tx = await contract.createDeal(
        preset.category,
        intent,
        conditionUrl,
        conditionParams,
        preset.deadlineHours,
        preset.commitFeePercent,
        preset.collateral,
        preset.verification,
        { value: ethers.parseEther(budget) }
    );

    console.log(`\nTX sent: ${tx.hash}`);
    const receipt = await tx.wait();

    // Get deal ID from event
    const iface = new ethers.Interface(ABI);
    let dealId = null;
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed.name === "DealCreated") {
                dealId = parsed.args.dealId.toString();
                break;
            }
        } catch (e) { }
    }

    console.log(`\nDeal created successfully!`);
    console.log(`Deal ID: ${dealId}`);
    console.log(`\nNext steps:`);
    console.log(`  Seller accepts:  node agents/seller.js ${dealId}`);
    console.log(`  Verify deal:     node agents/verifier.js ${dealId}`);
    console.log(`  Check status:    GET http://localhost:3001/deal/${dealId}`);
}

function buildDealParams(dealType) {
    const params = {
        social: {
            intent: "Promote my tweet and reach 50 likes. URL: https://x.com/example/status/123456",
            conditionUrl: "https://x.com/example/status/123456",
            conditionParams: JSON.stringify({ likes: 50, followers: 0, views: 0 }),
        },
        content: {
            intent: "Write and publish a blog post about Shadow OTC on Ritual Chain with at least 500 words",
            conditionUrl: "https://your-blog.com/shadow-otc-post",
            conditionParams: JSON.stringify({ minWords: 500, keywords: ["Shadow OTC", "Ritual"] }),
        },
        freelance: {
            intent: "Build a landing page for my project and deploy it live at the agreed URL",
            conditionUrl: "https://my-project.vercel.app",
            conditionParams: JSON.stringify({ expectedTitle: "My Project" }),
        },
        nft: {
            intent: "Transfer NFT #4269 from BoredApes collection to my wallet via OTC deal",
            conditionUrl: "https://explorer.ritualfoundation.org",
            conditionParams: JSON.stringify({ nftContract: "0xBC4CA0...", tokenId: "4269" }),
        },
        whitelist: {
            intent: "Transfer your NFT mint whitelist spot to my wallet before the public mint",
            conditionUrl: "https://mint.nftproject.xyz/check",
            conditionParams: JSON.stringify({ projectName: "NFT Project", mintDate: "2026-05-01" }),
        },
        airdrop: {
            intent: "Transfer your confirmed airdrop allocation to my wallet address",
            conditionUrl: "https://claim.protocol.xyz/check",
            conditionParams: JSON.stringify({ protocol: "Protocol XYZ", estimatedTokens: 10000 }),
        },
        allocation: {
            intent: "Sell your 50,000 TOKEN seed round allocation at 0.02 RITUAL per token",
            conditionUrl: "https://vesting.protocol.xyz/beneficiary",
            conditionParams: JSON.stringify({ tokenSymbol: "TOKEN", amount: 50000, pricePerToken: 0.02 }),
        },
        premarket: {
            intent: "Buy 100,000 TOKEN at pre-TGE price of 0.001 RITUAL each, delivery on TGE date",
            conditionUrl: "https://api.coingecko.com/api/v3/simple/price?ids=token&vs_currencies=usd",
            conditionParams: JSON.stringify({ targetPrice: 0.001, symbol: "TOKEN", deliveryDate: "2026-06-01" }),
        },
        marketing: {
            intent: "Get my project featured with a backlink on your high-DA crypto blog",
            conditionUrl: "https://cryptoblog.xyz/sponsored-post",
            conditionParams: JSON.stringify({ keyword: "Shadow OTC", link: "shadowotc.xyz" }),
        },
        bounty: {
            intent: "Find and report a valid bug on my dapp that affects user funds",
            conditionUrl: "https://github.com/myproject/dapp/issues",
            conditionParams: JSON.stringify({ severity: "high", reward: "0.05" }),
        },
        escrow: {
            intent: "Escrow for private domain name transfer. Domain: shadowotc.xyz",
            conditionUrl: "https://who.is/whois/shadowotc.xyz",
            conditionParams: JSON.stringify({ domain: "shadowotc.xyz" }),
        },
        conditional: {
            intent: "Pay only if my GitHub repo reaches 100 stars by the deadline",
            conditionUrl: "https://api.github.com/repos/Fortune9thx/shadow-otc",
            conditionParams: JSON.stringify({ contains: "stargazers_count", minValue: 100 }),
        },
    };

    return params[dealType] || params.social;
}

main().catch(err => {
    console.error("\nBUYER ERROR:", err.message);
    process.exit(1);
});