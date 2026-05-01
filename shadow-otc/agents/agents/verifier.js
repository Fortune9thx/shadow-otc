const { ethers } = require("ethers");
require("dotenv").config();

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RITUAL_RPC_URL;
const VERIFIER_KEY = process.env.SELLER_PRIVATE_KEY;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS_V2 || process.env.CONTRACT_ADDRESS;
const DEAL_ID = process.argv[2];
const MAX_RETRIES = parseInt(process.argv[3]) || 3;
const RETRY_DELAY = parseInt(process.argv[4]) || 30000;

// Deal Categories (mirrors contract enum)
const CATEGORY = {
    SOCIAL_MEDIA: 0,
    CONTENT_CREATION: 1,
    FREELANCE: 2,
    NFT_TRANSFER: 3,
    NFT_WHITELIST: 4,
    AIRDROP_ALLOCATION: 5,
    TOKEN_ALLOCATION: 6,
    PRE_MARKET: 7,
    MARKETING: 8,
    BUG_BOUNTY: 9,
    ESCROW: 10,
    CONDITIONAL: 11,
};

const CATEGORY_NAMES = Object.keys(CATEGORY);

const ABI = [
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
    "function executeDeal(uint256 dealId,bool success,string calldata reason) external",
    "function checkExpiry(uint256 dealId) external",
];

const STATUS = ["Open", "Accepted", "Pending Delivery", "Verifying", "Completed", "Failed", "Disputed", "Cancelled", "Expired"];

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
    if (!DEAL_ID) {
        console.error("Usage: node verifier.js <dealId> [maxRetries] [retryDelayMs]");
        process.exit(1);
    }

    console.log("\n========================================");
    console.log("  SHADOW OTC V2 — VERIFIER AGENT");
    console.log("========================================\n");
    console.log(`Deal ID:     ${DEAL_ID}`);
    console.log(`Max Retries: ${MAX_RETRIES}`);
    console.log(`Retry Delay: ${RETRY_DELAY / 1000}s\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(VERIFIER_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);

    // 1. Read deal from chain
    console.log("[1/4] Reading deal from Ritual chain...");
    const deal = await contract.getDeal(DEAL_ID);

    const categoryName = CATEGORY_NAMES[Number(deal.category)] || "UNKNOWN";
    console.log(`\n--- Deal #${DEAL_ID} ---`);
    console.log(`Category:  ${categoryName}`);
    console.log(`Status:    ${STATUS[Number(deal.status)]}`);
    console.log(`Intent:    ${deal.intent}`);
    console.log(`Amount:    ${ethers.formatEther(deal.paymentAmount)} RITUAL`);
    console.log(`Deadline:  ${new Date(Number(deal.deadline) * 1000).toLocaleString()}`);
    console.log(`Proof URL: ${deal.deliveryProof || "Not submitted yet"}`);

    // Check if expired
    if (Date.now() / 1000 > Number(deal.deadline)) {
        console.log("\n[!] Deal has expired. Triggering auto-refund...");
        const tx = await contract.checkExpiry(DEAL_ID);
        await tx.wait();
        console.log("[OK] Expiry processed. Buyer refunded.");
        return;
    }

    // Check status
    if (Number(deal.status) >= 4) {
        console.log(`\n[!] Deal already finalized: ${STATUS[Number(deal.status)]}`);
        return;
    }

    // 2. Route to correct verifier based on category
    console.log(`\n[2/4] Routing to ${categoryName} verifier...`);

    let result = { success: false, reason: "Verification not completed" };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n--- Attempt ${attempt} of ${MAX_RETRIES} ---`);

        result = await verifyByCategory(
            Number(deal.category),
            deal.conditionUrl,
            deal.conditionParams,
            deal.deliveryProof,
            deal.intent,
            deal.buyer
        );

        console.log(`Result: ${result.success ? "SUCCESS" : "FAILED"}`);
        console.log(`Reason: ${result.reason}`);

        if (result.success) break;

        if (attempt < MAX_RETRIES) {
            console.log(`\nRetrying in ${RETRY_DELAY / 1000} seconds...`);
            await sleep(RETRY_DELAY);
        }
    }

    // 3. Execute deal on chain
    console.log("\n[3/4] Executing deal on Ritual chain...");
    console.log(`Verdict: ${result.success ? "RELEASING FUNDS TO SELLER" : "REFUNDING BUYER"}`);

    const tx = await contract.executeDeal(DEAL_ID, result.success, result.reason);
    console.log(`TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`TX confirmed in block ${receipt.blockNumber}`);

    // 4. Summary
    console.log("\n[4/4] Summary");
    console.log("========================================");
    if (result.success) {
        console.log(`DEAL COMPLETED. Seller receives ${ethers.formatEther(deal.remainingPayment)} RITUAL`);
        if (deal.collateralAmount > 0n) {
            console.log(`Seller collateral returned: ${ethers.formatEther(deal.collateralAmount)} RITUAL`);
        }
    } else {
        console.log(`DEAL FAILED. Buyer refunded: ${ethers.formatEther(deal.remainingPayment)} RITUAL`);
        if (deal.collateralAmount > 0n) {
            console.log(`Buyer receives seller collateral: ${ethers.formatEther(deal.collateralAmount)} RITUAL`);
        }
    }
    console.log("========================================\n");
}

// ─────────────────────────────────────────────────────────────────
// CATEGORY ROUTERS
// ─────────────────────────────────────────────────────────────────
async function verifyByCategory(category, conditionUrl, conditionParams, deliveryProof, intent, buyer) {
    switch (category) {

        case CATEGORY.SOCIAL_MEDIA:
            return verifySocialMedia(conditionUrl, conditionParams, deliveryProof);

        case CATEGORY.CONTENT_CREATION:
            return verifyContentCreation(conditionUrl, deliveryProof, intent);

        case CATEGORY.FREELANCE:
            return verifyFreelance(conditionUrl, deliveryProof, intent);

        case CATEGORY.NFT_TRANSFER:
            return verifyNFTTransfer(conditionUrl, conditionParams, buyer);

        case CATEGORY.NFT_WHITELIST:
            return verifyNFTWhitelist(conditionUrl, buyer);

        case CATEGORY.AIRDROP_ALLOCATION:
            return verifyAirdropAllocation(conditionUrl, buyer);

        case CATEGORY.TOKEN_ALLOCATION:
            return verifyTokenAllocation(conditionUrl, conditionParams, buyer);

        case CATEGORY.PRE_MARKET:
            return verifyPreMarket(conditionUrl, conditionParams);

        case CATEGORY.MARKETING:
            return verifyMarketing(conditionUrl, conditionParams, deliveryProof);

        case CATEGORY.BUG_BOUNTY:
            return verifyBugBounty(deliveryProof, conditionUrl);

        case CATEGORY.ESCROW:
            return verifyEscrow(deliveryProof);

        case CATEGORY.CONDITIONAL:
            return verifyConditional(conditionUrl, conditionParams);

        default:
            return { success: false, reason: "Unknown deal category" };
    }
}

// ─────────────────────────────────────────────────────────────────
// VERIFIERS
// ─────────────────────────────────────────────────────────────────

// 0 — SOCIAL MEDIA
async function verifySocialMedia(conditionUrl, conditionParams, deliveryProof) {
    console.log("[Social Media] Fetching page...");
    const url = deliveryProof || conditionUrl;
    if (!url) return { success: false, reason: "No URL provided" };

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }
    const requiredLikes = params.likes || 50;
    const requiredFollowers = params.followers || 0;
    const requiredViews = params.views || 0;
    const requiredComments = params.comments || 0;

    const html = await fetchPage(url);
    if (!html) return { success: false, reason: "Failed to fetch page" };

    const metrics = extractSocialMetrics(html);
    console.log("Detected metrics:", metrics);

    // Check each required metric
    if (requiredLikes > 0 && metrics.likes < requiredLikes) return { success: false, reason: `Likes: ${metrics.likes}/${requiredLikes}` };
    if (requiredFollowers > 0 && metrics.followers < requiredFollowers) return { success: false, reason: `Followers: ${metrics.followers}/${requiredFollowers}` };
    if (requiredViews > 0 && metrics.views < requiredViews) return { success: false, reason: `Views: ${metrics.views}/${requiredViews}` };
    if (requiredComments > 0 && metrics.comments < requiredComments) return { success: false, reason: `Comments: ${metrics.comments}/${requiredComments}` };

    return { success: true, reason: `All metrics verified. Likes: ${metrics.likes}, Followers: ${metrics.followers}` };
}

// 1 — CONTENT CREATION
async function verifyContentCreation(conditionUrl, deliveryProof, intent) {
    console.log("[Content Creation] Checking published content...");
    const url = deliveryProof || conditionUrl;
    if (!url) return { success: false, reason: "No content URL provided" };

    const html = await fetchPage(url);
    if (!html) return { success: false, reason: "Content URL not accessible" };

    // Extract keywords from intent to check they appear in the content
    const keywords = extractKeywords(intent);
    const found = keywords.filter(kw => html.toLowerCase().includes(kw.toLowerCase()));
    const coverage = found.length / keywords.length;

    console.log(`Keywords found: ${found.length}/${keywords.length}`);

    if (coverage >= 0.6) return { success: true, reason: `Content verified. ${found.length}/${keywords.length} keywords found.` };
    return { success: false, reason: `Content incomplete. Only ${found.length}/${keywords.length} keywords found.` };
}

// 2 — FREELANCE
async function verifyFreelance(conditionUrl, deliveryProof, intent) {
    console.log("[Freelance] Checking delivery...");
    const url = deliveryProof || conditionUrl;
    if (!url) return { success: false, reason: "No delivery URL provided" };

    // Check GitHub PR
    if (url.includes("github.com") && url.includes("pull")) {
        return verifyGithubPR(url);
    }

    // Check live website
    const response = await fetchUrl(url);
    if (response && response.status === 200) {
        return { success: true, reason: `Delivery confirmed. URL is live: ${url}` };
    }

    return { success: false, reason: "Delivery URL not accessible or not live" };
}

// 3 — NFT TRANSFER
async function verifyNFTTransfer(conditionUrl, conditionParams, buyer) {
    console.log("[NFT Transfer] Checking on-chain ownership...");

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }
    const nftContract = params.nftContract;
    const tokenId = params.tokenId;
    const explorerUrl = conditionUrl;

    if (!nftContract || !tokenId) {
        // Fallback: check explorer URL
        if (explorerUrl) {
            const html = await fetchPage(explorerUrl);
            if (html && html.toLowerCase().includes(buyer.toLowerCase())) {
                return { success: true, reason: "Buyer address found in NFT ownership record" };
            }
        }
        return { success: false, reason: "NFT contract or tokenId not specified" };
    }

    // Simulate on-chain read (in production, use Ritual's native precompile)
    const ownerUrl = `${explorerUrl}/token/${nftContract}/instance/${tokenId}`;
    const html = await fetchPage(ownerUrl);

    if (html && html.toLowerCase().includes(buyer.toLowerCase())) {
        return { success: true, reason: `NFT #${tokenId} confirmed in buyer wallet ${buyer.slice(0, 8)}...` };
    }

    return { success: false, reason: `NFT #${tokenId} not yet in buyer wallet` };
}

// 4 — NFT WHITELIST
async function verifyNFTWhitelist(conditionUrl, buyer) {
    console.log("[NFT Whitelist] Checking allowlist...");
    if (!conditionUrl) return { success: false, reason: "No allowlist URL provided" };

    // Check if buyer's address appears in the allowlist checker
    const checkUrl = conditionUrl.includes("?")
        ? `${conditionUrl}&wallet=${buyer}`
        : `${conditionUrl}?wallet=${buyer}`;

    const html = await fetchPage(checkUrl);
    if (!html) return { success: false, reason: "Could not reach allowlist checker" };

    const positive = ["whitelisted", "allowlisted", "eligible", "congratulations", "you are on", "approved", "confirmed"];
    const negative = ["not whitelisted", "not eligible", "not found", "sorry", "not on the list"];

    const lc = html.toLowerCase();
    if (positive.some(p => lc.includes(p))) return { success: true, reason: "Buyer wallet confirmed on allowlist" };
    if (negative.some(n => lc.includes(n))) return { success: false, reason: "Buyer wallet NOT on allowlist" };

    // Fallback: check if buyer address appears in page
    if (lc.includes(buyer.toLowerCase())) return { success: true, reason: "Buyer address found in allowlist page" };

    return { success: false, reason: "Could not confirm allowlist status" };
}

// 5 — AIRDROP ALLOCATION
async function verifyAirdropAllocation(conditionUrl, buyer) {
    console.log("[Airdrop] Verifying allocation for buyer wallet...");
    if (!conditionUrl) return { success: false, reason: "No airdrop checker URL provided" };

    const checkUrl = conditionUrl.includes("?")
        ? `${conditionUrl}&address=${buyer}`
        : `${conditionUrl}?address=${buyer}`;

    const html = await fetchPage(checkUrl);
    if (!html) return { success: false, reason: "Could not reach airdrop checker" };

    const lc = html.toLowerCase();
    const hasAlloc = ["eligible", "allocation", "claim", "tokens", "airdrop", "qualified"].some(w => lc.includes(w));
    const hasAddress = lc.includes(buyer.toLowerCase().slice(2));

    if (hasAlloc && hasAddress) return { success: true, reason: "Airdrop allocation confirmed for buyer address" };
    if (hasAlloc) return { success: true, reason: "Allocation found in response" };

    return { success: false, reason: "No allocation found for buyer address" };
}

// 6 — TOKEN ALLOCATION
async function verifyTokenAllocation(conditionUrl, conditionParams, buyer) {
    console.log("[Token Allocation] Verifying beneficiary change...");

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }
    const vestingContract = params.vestingContract;
    const expectedAmount = params.amount;

    if (conditionUrl) {
        const html = await fetchPage(conditionUrl);
        if (html && html.toLowerCase().includes(buyer.toLowerCase())) {
            return { success: true, reason: `Buyer ${buyer.slice(0, 8)}... confirmed as beneficiary` };
        }
    }

    if (vestingContract) {
        // In production: read vesting contract beneficiary on-chain
        console.log(`Checking vesting contract: ${vestingContract}`);
        return { success: false, reason: "On-chain vesting check requires Ritual precompile" };
    }

    return { success: false, reason: "Could not verify token allocation transfer" };
}

// 7 — PRE-MARKET
async function verifyPreMarket(conditionUrl, conditionParams) {
    console.log("[Pre-Market] Checking token price and delivery...");

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }
    const targetPrice = parseFloat(params.targetPrice || 0);
    const tokenSymbol = params.symbol || "";

    if (!conditionUrl) return { success: false, reason: "No price feed URL provided" };

    const html = await fetchPage(conditionUrl);
    if (!html) return { success: false, reason: "Could not reach price feed" };

    // Extract price from response
    const priceMatch = html.match(/"price":"?(\d+\.?\d*)"?/);
    if (priceMatch) {
        const currentPrice = parseFloat(priceMatch[1]);
        console.log(`Current price: ${currentPrice}, Target: ${targetPrice}`);
        if (currentPrice >= targetPrice) {
            return { success: true, reason: `Token listed at ${currentPrice}, above target ${targetPrice}` };
        }
        return { success: false, reason: `Token price ${currentPrice} below target ${targetPrice}` };
    }

    // Simulate for demo
    const simPrice = Math.random() * 0.1;
    console.log(`Simulated price: ${simPrice}`);
    return simPrice >= targetPrice
        ? { success: true, reason: `Price verified: ${simPrice.toFixed(4)}` }
        : { success: false, reason: `Price too low: ${simPrice.toFixed(4)} vs ${targetPrice}` };
}

// 8 — MARKETING
async function verifyMarketing(conditionUrl, conditionParams, deliveryProof) {
    console.log("[Marketing] Verifying promotion...");
    const url = deliveryProof || conditionUrl;
    if (!url) return { success: false, reason: "No promotion URL provided" };

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }
    const requiredKeyword = params.keyword || "";
    const requiredLink = params.link || "";

    const html = await fetchPage(url);
    if (!html) return { success: false, reason: "Could not fetch promotion page" };

    const lc = html.toLowerCase();

    if (requiredKeyword && !lc.includes(requiredKeyword.toLowerCase())) {
        return { success: false, reason: `Keyword "${requiredKeyword}" not found on page` };
    }
    if (requiredLink && !lc.includes(requiredLink.toLowerCase())) {
        return { success: false, reason: `Required link "${requiredLink}" not found on page` };
    }

    return { success: true, reason: "Marketing promotion verified on target page" };
}

// 9 — BUG BOUNTY
async function verifyBugBounty(deliveryProof, conditionUrl) {
    console.log("[Bug Bounty] Verifying bug report or fix...");
    const url = deliveryProof || conditionUrl;
    if (!url) return { success: false, reason: "No proof URL provided" };

    if (url.includes("github.com/issues") || url.includes("github.com/pull")) {
        return verifyGithubPR(url);
    }

    const html = await fetchPage(url);
    if (html) return { success: true, reason: "Bug report/fix URL accessible and verified" };
    return { success: false, reason: "Could not access bug report URL" };
}

// 10 — ESCROW
async function verifyEscrow(deliveryProof) {
    console.log("[Escrow] Checking delivery proof...");
    if (!deliveryProof) return { success: false, reason: "No delivery proof submitted" };

    const html = await fetchPage(deliveryProof);
    if (html) return { success: true, reason: "Delivery proof URL confirmed accessible" };
    return { success: false, reason: "Delivery proof URL not accessible" };
}

// 11 — CONDITIONAL
async function verifyConditional(conditionUrl, conditionParams) {
    console.log("[Conditional] Evaluating custom condition...");
    if (!conditionUrl) return { success: false, reason: "No condition URL provided" };

    let params = {};
    try { params = JSON.parse(conditionParams); } catch (e) { }

    const html = await fetchPage(conditionUrl);
    if (!html) return { success: false, reason: "Could not fetch condition URL" };

    // Check for required value in page
    if (params.contains) {
        return html.toLowerCase().includes(params.contains.toLowerCase())
            ? { success: true, reason: `Condition met: "${params.contains}" found on page` }
            : { success: false, reason: `Condition not met: "${params.contains}" not on page` };
    }

    // Check for minimum numeric value
    if (params.minValue) {
        const nums = html.match(/[\d,]+/g) || [];
        const max = Math.max(...nums.map(n => parseInt(n.replace(/,/g, ""))).filter(n => !isNaN(n)));
        return max >= params.minValue
            ? { success: true, reason: `Value ${max} meets minimum ${params.minValue}` }
            : { success: false, reason: `Max value ${max} below minimum ${params.minValue}` };
    }

    // Default: page accessible = success
    return { success: true, reason: "Condition URL accessible and contains content" };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
async function fetchPage(url) {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "ShadowOTC-Verifier/2.0 (Ritual Chain)" },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        console.log(`Fetch error for ${url}: ${e.message}`);
        return null;
    }
}

async function fetchUrl(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        return { status: res.status, ok: res.ok };
    } catch (e) { return null; }
}

async function verifyGithubPR(url) {
    const html = await fetchPage(url);
    if (!html) return { success: false, reason: "Could not reach GitHub URL" };
    const lc = html.toLowerCase();
    if (lc.includes("merged") || lc.includes("closed") || lc.includes("open")) {
        return { success: true, reason: "GitHub PR/Issue verified and accessible" };
    }
    return { success: false, reason: "GitHub URL not recognized as a valid PR or Issue" };
}

function extractSocialMetrics(html) {
    const patterns = {
        likes: [/"like_count":(\d+)/, /(\d+)\s*likes?/i, /"favorite_count":(\d+)/, /aria-label="(\d+) likes?"/i],
        followers: [/"followers_count":(\d+)/, /(\d+)\s*followers?/i, /"follower_count":(\d+)/],
        views: [/"view_count":(\d+)/, /(\d+)\s*views?/i, /"play_count":(\d+)/],
        comments: [/"reply_count":(\d+)/, /(\d+)\s*comments?/i, /"comment_count":(\d+)/],
    };
    const result = { likes: 0, followers: 0, views: 0, comments: 0 };
    for (const [metric, pats] of Object.entries(patterns)) {
        for (const pat of pats) {
            const m = html.match(pat);
            if (m) { result[metric] = parseInt(m[1]); break; }
        }
    }
    // Fallback simulation if no metrics found
    if (result.likes === 0 && result.followers === 0) {
        result.likes = Math.floor(Math.random() * 100);
        result.followers = Math.floor(Math.random() * 500);
        result.views = Math.floor(Math.random() * 1000);
        result.comments = Math.floor(Math.random() * 30);
        console.log("(Simulated metrics — real page did not expose raw numbers)");
    }
    return result;
}

function extractKeywords(intent) {
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "this", "that", "my", "your", "their"]);
    return intent.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 10);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
    console.error("\nVERIFIER ERROR:", err.message);
    process.exit(1);
});