/**
 * Shadow OTC — Telegram Notification Bot
 * Uses only built-in Node.js https + ethers (already installed).
 * No extra npm packages required.
 *
 * Setup:
 *   1. Message @BotFather on Telegram → /newbot → copy the token
 *   2. Add TELEGRAM_BOT_TOKEN=your_token to .env
 *   3. node agents/telegram-bot.js
 */

const https  = require("https");
const fs     = require("fs");
const path   = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const RPC_URL     = process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
const CONTRACT    = process.env.CONTRACT_ADDRESS_V2 || process.env.CONTRACT_ADDRESS || "0xe48aB58BEA9AD3d4c94A3d09c5Fd98320151bF80";
const CHANNEL_ID  = process.env.TELEGRAM_CHANNEL_ID || null;  // optional public channel
const USERS_FILE  = path.join(__dirname, "data", "telegram-users.json");

const CATEGORY_NAMES = [
  "Social Media","Content Creation","Freelance","NFT Transfer",
  "NFT Whitelist","Airdrop","Token Allocation","Pre-Market",
  "Marketing","Bug Bounty","Escrow","Conditional",
];
const STATUS_NAMES = [
  "Open","Accepted","Pending Delivery","Verifying",
  "Completed","Failed","Disputed","Cancelled","Expired",
];

const ABI = [
  "event DealCreated(uint256 indexed dealId, address indexed buyer, uint8 category, uint256 amount, uint256 deadline)",
  "event DealAccepted(uint256 indexed dealId, address indexed seller, uint256 collateral)",
  "event DealCompleted(uint256 indexed dealId, uint256 sellerPayout, uint256 platformFee)",
  "event DealFailed(uint256 indexed dealId, string reason)",
  "event DeliverySubmitted(uint256 indexed dealId, address indexed seller, string proofUrl)",
  "event DisputeRaised(uint256 indexed dealId, address indexed by, string reason)",
  "function getDeal(uint256) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
];

// ─────────────────────────────────────────────────────────────────
// USER STORE  (wallet ↔ { chatId, skills[], role })
// ─────────────────────────────────────────────────────────────────
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch { return {}; }
}

function saveUsers(users) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) { console.error("saveUsers error:", e.message); }
}

// Normalise entry — supports old format (plain chatId number) or new object
function normaliseEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "number" || typeof entry === "string") {
    return { chatId: Number(entry), skills: [], role: null };
  }
  return { chatId: entry.chatId, skills: entry.skills || [], role: entry.role || null };
}

function registerUser(wallet, chatId) {
  const users  = loadUsers();
  const key    = wallet.toLowerCase();
  const prev   = normaliseEntry(users[key]);
  users[key]   = { chatId, skills: prev?.skills || [], role: prev?.role || null };
  saveUsers(users);
}

function registerSellerSkills(wallet, chatId, skills) {
  const users = loadUsers();
  const key   = wallet.toLowerCase();
  users[key]  = { chatId, skills, role: "seller" };
  saveUsers(users);
}

function getChatId(wallet) {
  if (!wallet || wallet === ethers.ZeroAddress) return null;
  const users = loadUsers();
  const entry = normaliseEntry(users[wallet.toLowerCase()]);
  return entry?.chatId || null;
}

// Return all registered sellers whose skills include categoryId
function getMatchingSellers(categoryId) {
  const users = loadUsers();
  return Object.entries(users)
    .map(([wallet, entry]) => ({ wallet, ...normaliseEntry(entry) }))
    .filter(u => u.role === "seller" && u.skills.includes(Number(categoryId)));
}

// ─────────────────────────────────────────────────────────────────
// TELEGRAM API  (pure HTTPS — zero npm packages)
// ─────────────────────────────────────────────────────────────────
function tgRequest(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: "api.telegram.org",
      path:     `/bot${BOT_TOKEN}/${method}`,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sendMessage(chatId, text, extra = {}) {
  if (!chatId) return;
  try {
    return await tgRequest("sendMessage", {
      chat_id:                  chatId,
      text,
      parse_mode:               "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  } catch (e) { console.error(`sendMessage error to ${chatId}:`, e.message); }
}

// ─────────────────────────────────────────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────────────────────────────────────────
const CATEGORY_SHORT = [
  "0:Social","1:Content","2:Freelance","3:NFT Transfer",
  "4:NFT WL","5:Airdrop","6:Token","7:Pre-Market",
  "8:Marketing","9:Bug Bounty","10:Escrow","11:Conditional",
];

const WELCOME = `👋 <b>Welcome to Shadow OTC Bot</b>

I watch the Ritual Chain and notify you when your deals move:

📦 <b>New deal</b> — posted to the market
🤝 <b>Accepted</b> — seller locked in
🔍 <b>Verifying</b> — agent is checking condition
✅ <b>Completed</b> — funds released to seller
❌ <b>Failed/Disputed</b> — deal needs attention

<b>Buyer — link your wallet:</b>
<code>/register 0xYourWalletAddress</code>

<b>Seller — register + set skills to get matched:</b>
<code>/sell 0xYourWallet 0 1 5</code>  (space-separated category IDs)

Categories: ${CATEGORY_SHORT.join(", ")}

<b>Other commands:</b>
<code>/status &lt;dealId&gt;</code> — check a deal
<code>/help</code> — show this message`;

async function handleUpdate(update, contract) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const parts  = text.split(/\s+/);
  const cmd    = parts[0].toLowerCase().replace("@shadowotc_bot", "");

  if (cmd === "/start" || cmd === "/help") {
    await sendMessage(chatId, WELCOME);
    return;
  }

  if (cmd === "/register") {
    const wallet = parts[1];
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      await sendMessage(chatId, "❌ <b>Invalid address.</b>\n\nFormat: <code>/register 0x1234...abcd</code>");
      return;
    }
    registerUser(wallet, chatId);
    await sendMessage(chatId,
      `✅ <b>Wallet registered!</b>\n\n` +
      `<code>${wallet}</code>\n\n` +
      `You'll now receive alerts for all deals where you're buyer or seller.\n\n` +
      `<a href="https://shadow-otc.vercel.app">Open Shadow OTC →</a>`
    );
    return;
  }

  if (cmd === "/sell") {
    const wallet = parts[1];
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      await sendMessage(chatId,
        "❌ <b>Usage:</b> <code>/sell 0xYourWallet 0 1 5</code>\n\n" +
        "Categories: " + CATEGORY_SHORT.join(", ")
      );
      return;
    }
    const skills = parts.slice(2).map(Number).filter(n => n >= 0 && n <= 11 && !isNaN(n));
    if (skills.length === 0) {
      await sendMessage(chatId,
        "❌ <b>No valid category IDs provided.</b>\n\n" +
        "Categories: " + CATEGORY_SHORT.join(", ") + "\n\n" +
        "Example: <code>/sell 0xYourWallet 0 2 7</code>"
      );
      return;
    }
    registerSellerSkills(wallet, chatId, skills);
    const skillNames = skills.map(s => CATEGORY_NAMES[s] || s).join(", ");
    await sendMessage(chatId,
      `🎯 <b>Seller profile saved!</b>\n\n` +
      `Wallet: <code>${wallet}</code>\n` +
      `Skills: <b>${skillNames}</b>\n\n` +
      `You'll get a DM when a matching deal goes live.\n\n` +
      `<a href="https://shadow-otc.vercel.app">Open Shadow OTC →</a>`
    );
    return;
  }

  if (cmd === "/status") {
    const dealId = parts[1];
    if (!dealId || isNaN(Number(dealId))) {
      await sendMessage(chatId, "Usage: <code>/status 42</code>");
      return;
    }
    try {
      const deal = await contract.getDeal(dealId);
      const cat    = CATEGORY_NAMES[Number(deal.category)] || "Unknown";
      const status = STATUS_NAMES[Number(deal.status)]     || "Unknown";
      const amount = ethers.formatEther(deal.paymentAmount);
      const deadline = new Date(Number(deal.deadline) * 1000).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
      const isExpired = Date.now() > Number(deal.deadline) * 1000;

      await sendMessage(chatId,
        `📊 <b>Deal #${dealId}</b>\n\n` +
        `Status:   <b>${status}${isExpired && Number(deal.status) < 4 ? " (Expired)" : ""}</b>\n` +
        `Category: ${cat}\n` +
        `Amount:   ${amount} RITUAL\n` +
        `Deadline: ${deadline}\n` +
        `Intent:   ${deal.intent.slice(0, 120)}${deal.intent.length > 120 ? "…" : ""}\n\n` +
        `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">View on Shadow OTC →</a>`
      );
    } catch (e) {
      await sendMessage(chatId, `❌ Could not fetch deal #${dealId}: ${e.message}`);
    }
    return;
  }

  // Unknown command
  await sendMessage(chatId, `Unknown command. Type /help to see what I can do.`);
}

// ─────────────────────────────────────────────────────────────────
// CHAIN EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────
function attachListeners(contract) {
  // ── DealCreated ──────────────────────────────────────────────────
  contract.on("DealCreated", async (dealId, buyer, category, amount, deadline) => {
    const cat    = CATEGORY_NAMES[Number(category)] || "Unknown";
    const amt    = ethers.formatEther(amount);
    const dlDate = new Date(Number(deadline) * 1000).toLocaleDateString("en-GB", { day:"2-digit", month:"short" });

    const publicMsg =
      `🆕 <b>New Deal #${dealId} — ${cat}</b>\n\n` +
      `💰 ${amt} RITUAL locked in escrow\n` +
      `⏰ Deadline: ${dlDate}\n` +
      `👤 Buyer: <code>${buyer.slice(0,6)}…${buyer.slice(-4)}</code>\n\n` +
      `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">View & Accept Deal →</a>`;

    // Broadcast to public channel
    if (CHANNEL_ID) await sendMessage(CHANNEL_ID, publicMsg);

    // DM the buyer
    const buyerChat = getChatId(buyer);
    if (buyerChat) {
      await sendMessage(buyerChat,
        `✅ <b>Deal #${dealId} is live!</b>\n\nCategory: ${cat}\nAmount: ${amt} RITUAL\n\nWaiting for a seller to accept.\n\n` +
        `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">Track your deal →</a>`
      );
    }

    // ── Seller matching: DM all registered sellers with matching skills ──
    const matchedSellers = getMatchingSellers(Number(category));
    let matchCount = 0;
    for (const seller of matchedSellers) {
      // Don't ping the buyer themselves if they have a seller profile
      if (seller.wallet === buyer.toLowerCase()) continue;
      await sendMessage(seller.chatId,
        `🎯 <b>New deal matches your skills!</b>\n\n` +
        `<b>Deal #${dealId}</b> — ${cat}\n` +
        `💰 ${amt} RITUAL locked in escrow\n` +
        `⏰ Deadline: ${dlDate}\n\n` +
        `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">Accept Deal →</a>`
      ).catch(() => {});
      matchCount++;
    }
    console.log(`[Bot] DealCreated #${dealId} (${cat}, ${amt} RITUAL) — notified ${matchCount} matched sellers`);
  });

  // ── DealAccepted ─────────────────────────────────────────────────
  contract.on("DealAccepted", async (dealId, seller, collateral) => {
    const deal = await contract.getDeal(dealId).catch(() => null);
    if (!deal) return;
    const col = ethers.formatEther(collateral);

    const buyerMsg =
      `🤝 <b>Deal #${dealId} — Seller Accepted!</b>\n\n` +
      `Seller: <code>${seller.slice(0,6)}…${seller.slice(-4)}</code>\n` +
      `Collateral locked: ${col} RITUAL\n\n` +
      `The seller is now working on your deal. You'll be notified when they submit delivery.\n\n` +
      `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">Track Deal →</a>`;

    const sellerMsg =
      `✅ <b>You accepted Deal #${dealId}</b>\n\n` +
      `Your ${col} RITUAL collateral is locked.\n` +
      `Complete the work and submit your proof URL on the deal page.\n\n` +
      `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">Submit Delivery →</a>`;

    const buyerChat  = getChatId(deal.buyer);
    const sellerChat = getChatId(seller);
    if (buyerChat)  await sendMessage(buyerChat,  buyerMsg);
    if (sellerChat) await sendMessage(sellerChat, sellerMsg);
    console.log(`[Bot] DealAccepted #${dealId} by ${seller.slice(0,8)}…`);
  });

  // ── DeliverySubmitted ────────────────────────────────────────────
  contract.on("DeliverySubmitted", async (dealId, seller, proofUrl) => {
    const deal = await contract.getDeal(dealId).catch(() => null);
    if (!deal) return;

    const buyerMsg =
      `🔍 <b>Deal #${dealId} — Delivery Submitted</b>\n\n` +
      `The seller has submitted proof. The verification agent is now checking the condition.\n\n` +
      `Proof: <a href="${proofUrl}">${proofUrl.slice(0, 60)}…</a>\n\n` +
      `You'll be notified with the final result.`;

    const sellerMsg =
      `📤 <b>Delivery submitted for Deal #${dealId}</b>\n\n` +
      `The agent is verifying your proof now. This usually takes 1–5 minutes.\n\n` +
      `Proof: ${proofUrl}`;

    const buyerChat  = getChatId(deal.buyer);
    const sellerChat = getChatId(seller);
    if (buyerChat)  await sendMessage(buyerChat,  buyerMsg);
    if (sellerChat) await sendMessage(sellerChat, sellerMsg);
    console.log(`[Bot] DeliverySubmitted #${dealId}`);
  });

  // ── DealCompleted ────────────────────────────────────────────────
  contract.on("DealCompleted", async (dealId, sellerPayout, platformFee) => {
    const deal = await contract.getDeal(dealId).catch(() => null);
    if (!deal) return;
    const payout = ethers.formatEther(sellerPayout);

    const sellerMsg =
      `🎉 <b>Deal #${dealId} Complete — You've been paid!</b>\n\n` +
      `✅ ${payout} RITUAL sent to your wallet\n` +
      `Your collateral has been returned.\n\n` +
      `Your reputation score has increased. Keep it up! 🚀`;

    const buyerMsg =
      `✅ <b>Deal #${dealId} Complete!</b>\n\n` +
      `The agent confirmed the condition was met.\n` +
      `The seller received ${payout} RITUAL.\n\n` +
      `Thanks for using Shadow OTC!`;

    const completionMsg =
      `✅ <b>Deal #${dealId} Completed</b>\n` +
      `${payout} RITUAL released to seller\n` +
      `<a href="https://shadow-otc.vercel.app/#deal=${dealId}">View →</a>`;

    if (CHANNEL_ID) await sendMessage(CHANNEL_ID, completionMsg);

    const sellerChat = getChatId(deal.seller);
    const buyerChat  = getChatId(deal.buyer);
    if (sellerChat) await sendMessage(sellerChat, sellerMsg);
    if (buyerChat)  await sendMessage(buyerChat,  buyerMsg);
    console.log(`[Bot] DealCompleted #${dealId} — ${payout} RITUAL paid out`);
  });

  // ── DealFailed ───────────────────────────────────────────────────
  contract.on("DealFailed", async (dealId, reason) => {
    const deal = await contract.getDeal(dealId).catch(() => null);
    if (!deal) return;
    const refund = ethers.formatEther(deal.remainingPayment);
    const col    = deal.collateralAmount > 0n ? ethers.formatEther(deal.collateralAmount) : null;

    const sellerMsg =
      `❌ <b>Deal #${dealId} Failed</b>\n\n` +
      `Reason: ${reason}\n\n` +
      `Your collateral has been sent to the buyer as compensation.\n` +
      `Your reputation score has decreased.`;

    const buyerMsg =
      `❌ <b>Deal #${dealId} Failed</b>\n\n` +
      `Reason: ${reason}\n\n` +
      `Refund: <b>${refund} RITUAL</b> returned to your wallet` +
      (col ? `\nSeller collateral: <b>${col} RITUAL</b> also sent to you` : "");

    const sellerChat = getChatId(deal.seller);
    const buyerChat  = getChatId(deal.buyer);
    if (sellerChat) await sendMessage(sellerChat, sellerMsg);
    if (buyerChat)  await sendMessage(buyerChat,  buyerMsg);
    console.log(`[Bot] DealFailed #${dealId}: ${reason}`);
  });

  // ── DisputeRaised ────────────────────────────────────────────────
  contract.on("DisputeRaised", async (dealId, by, reason) => {
    const deal = await contract.getDeal(dealId).catch(() => null);
    if (!deal) return;

    const msg =
      `⚠️ <b>Dispute Raised — Deal #${dealId}</b>\n\n` +
      `By: <code>${by.slice(0,6)}…${by.slice(-4)}</code>\n` +
      `Reason: ${reason}\n\n` +
      `The Shadow OTC team will review and resolve within 24–48h.\n` +
      `All funds remain locked in escrow until resolution.`;

    const sellerChat = getChatId(deal.seller);
    const buyerChat  = getChatId(deal.buyer);
    if (sellerChat) await sendMessage(sellerChat, msg);
    if (buyerChat)  await sendMessage(buyerChat,  msg);
    console.log(`[Bot] DisputeRaised #${dealId} by ${by.slice(0,8)}…`);
  });

  console.log("📡 Chain event listeners attached.");
}

// ─────────────────────────────────────────────────────────────────
// TELEGRAM UPDATE POLLER
// ─────────────────────────────────────────────────────────────────
async function pollUpdates(offset, contract) {
  try {
    const res     = await tgRequest("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
    const updates = res.result || [];
    for (const upd of updates) {
      await handleUpdate(upd, contract).catch(e => console.error("handleUpdate error:", e.message));
      offset = upd.update_id + 1;
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  }
  setTimeout(() => pollUpdates(offset, contract), 1000);
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🤖 Shadow OTC Telegram Bot");
  console.log("══════════════════════════════");

  if (!BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set in .env");
    console.error("   Get one from @BotFather on Telegram → /newbot");
    process.exit(1);
  }

  // Test bot token
  const me = await tgRequest("getMe", {});
  if (!me.ok) {
    console.error("❌ Invalid bot token:", JSON.stringify(me));
    process.exit(1);
  }
  console.log(`✅ Bot: @${me.result.username} (${me.result.first_name})`);

  // Set up chain provider + contract
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT, ABI, provider);
  console.log(`📡 Connected to Ritual Chain: ${RPC_URL}`);
  console.log(`📄 Contract: ${CONTRACT}`);

  // Attach chain event listeners
  attachListeners(contract);

  // Optionally post a startup message to channel
  if (CHANNEL_ID) {
    await sendMessage(CHANNEL_ID, "🤖 <b>Shadow OTC Bot online.</b> Watching Ritual Chain for new deals…").catch(() => {});
  }

  // Start polling Telegram for commands
  console.log("💬 Polling Telegram updates…\n");
  pollUpdates(0, contract);
}

main().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
