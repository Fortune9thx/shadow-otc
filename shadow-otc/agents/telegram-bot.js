/**
 * Shadow OTC — Telegram Bot
 * Notifies sellers when new intents are posted.
 * Notifies both parties on every deal status change.
 *
 * Commands:
 *   /start             — welcome + instructions
 *   /register <wallet> — link wallet to this chat
 *   /status <dealId>   — get current status of any deal
 *   /mydeals           — list your active deals
 *   /help              — command list
 */

const TelegramBot = require("node-telegram-bot-api");
const { ethers }  = require("ethers");
const fs          = require("fs");
const path        = require("path");
require("dotenv").config();

const TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const RPC_URL    = process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
const CONTRACT   = process.env.CONTRACT_ADDRESS_V3 || process.env.CONTRACT_ADDRESS_V2 || process.env.CONTRACT_ADDRESS;
const USERS_FILE = path.join(__dirname, "data", "telegram-users.json");
const POLL_MS    = 30_000;

if (!TOKEN) {
  console.warn("[Bot] TELEGRAM_BOT_TOKEN not set — exiting");
  process.exit(0);
}

// ── User registry helpers ─────────────────────────────────
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch { return {}; }
}
function saveUsers(u) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2), "utf8");
  } catch (e) { console.error("[Bot] save failed:", e.message); }
}

// ── Contract ABI ──────────────────────────────────────────
const ABI = [
  "function dealCounter() external view returns (uint256)",
  "function getDeal(uint256) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
  "function getBuyerDeals(address) external view returns (uint256[])",
  "function getSellerDeals(address) external view returns (uint256[])",
];

const STATUS_LABELS   = ["Seeking","Accepted","Pending Delivery","Verifying","Completed","Failed","Disputed","Cancelled","Expired"];
const STATUS_EMOJI    = ["🔍","🤝","📦","🤖","✅","❌","⚠️","🚫","⏰"];
const CATEGORY_LABELS = ["Social Media","Content Creation","Freelance","NFT Transfer","NFT Whitelist","Airdrop Allocation","Token Allocation","Pre-Market","Marketing","Bug Bounty","Escrow","Conditional"];

function getContract() {
  if (!CONTRACT) return null;
  return new ethers.Contract(CONTRACT, ABI, new ethers.JsonRpcProvider(RPC_URL));
}

// ── Format deal for Telegram ──────────────────────────────
function fmt(id, d) {
  const amount   = parseFloat(ethers.formatEther(d.paymentAmount)).toFixed(4);
  const status   = STATUS_LABELS[Number(d.status)]   || "Unknown";
  const emoji    = STATUS_EMOJI[Number(d.status)]    || "•";
  const category = CATEGORY_LABELS[Number(d.category)] || "Unknown";
  const deadline = new Date(Number(d.deadline)).toLocaleDateString("en-GB",
    { day:"2-digit", month:"short", year:"numeric" });
  const intent   = (d.intent || "").slice(0, 100);
  return (
    `${emoji} *Deal #${id}* — ${status}\n` +
    `📁 ${category}\n` +
    `💬 ${intent}\n` +
    `💰 ${amount} RITUAL\n` +
    `⏰ ${deadline}\n` +
    `🔗 [View Deal](https://shadowotc.xyz/#deal=${id})`
  );
}

// ── Bot init ──────────────────────────────────────────────
const bot   = new TelegramBot(TOKEN, { polling: true });
let   users = loadUsers();
console.log("[Bot] Shadow OTC Telegram bot starting…");

// ── /start ────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 *Welcome to Shadow OTC Bot\\!*\n\n` +
    `P2P escrow on Ritual Testnet — AI\\-verified, trustless\\.\n\n` +
    `*Commands:*\n` +
    `/register — link your wallet\n` +
    `/status — check a deal\n` +
    `/mydeals — your active deals\n` +
    `/help — this menu\n\n` +
    `🌐 [shadowotc\\.xyz](https://shadowotc.xyz)`,
    { parse_mode: "MarkdownV2", disable_web_page_preview: true }
  );
});

// ── /help ─────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `*Shadow OTC Bot Commands*\n\n` +
    `/register \\<0x\\.\\.\\.\\> — link your wallet address\n` +
    `/status \\<dealId\\> — get live deal status\n` +
    `/mydeals — list your active deals\n` +
    `/start — welcome message\n\n` +
    `🌐 [shadowotc\\.xyz](https://shadowotc.xyz)`,
    { parse_mode: "MarkdownV2", disable_web_page_preview: true }
  );
});

// ── /register ────────────────────────────────────────────
bot.onText(/\/register(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const wallet = (match[1] || "").trim().toLowerCase();

  if (!wallet || !ethers.isAddress(wallet)) {
    bot.sendMessage(chatId,
      "Please provide a valid wallet address.\n\nExample:\n/register 0xYourWallet",
      {}
    );
    return;
  }

  users[wallet] = { ...(users[wallet] || {}), chatId: String(chatId), registeredAt: Date.now() };
  saveUsers(users);

  bot.sendMessage(chatId,
    `Wallet linked: ${wallet}\n\nYou will receive notifications for every status change on your deals.\n\nOpen the app: https://shadowotc.xyz`,
    {}
  );
});

// ── /status ───────────────────────────────────────────────
bot.onText(/\/status(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const id     = match[1] ? parseInt(match[1]) : NaN;

  if (isNaN(id)) {
    bot.sendMessage(chatId, "Usage: /status <dealId>\nExample: /status 5");
    return;
  }

  const c = getContract();
  if (!c) { bot.sendMessage(chatId, "Contract address not configured on server."); return; }

  try {
    await bot.sendMessage(chatId, "Loading deal from Ritual Chain...");
    const raw = await c.getDeal(id);
    const amount   = parseFloat(ethers.formatEther(raw.paymentAmount)).toFixed(4);
    const status   = STATUS_LABELS[Number(raw.status)]   || "Unknown";
    const category = CATEGORY_LABELS[Number(raw.category)] || "Unknown";
    const deadline = new Date(Number(raw.deadline)).toLocaleDateString("en-GB",
      { day:"2-digit", month:"short", year:"numeric" });

    bot.sendMessage(chatId,
      `Deal #${id} — ${status}\n` +
      `Category: ${category}\n` +
      `Intent: ${(raw.intent || "").slice(0, 120)}\n` +
      `Amount: ${amount} RITUAL\n` +
      `Deadline: ${deadline}\n\n` +
      `View: https://shadowotc.xyz/#deal=${id}`,
      {}
    );
  } catch (e) {
    bot.sendMessage(chatId, `Could not load deal #${id}: ${e.message}`);
  }
});

// ── /mydeals ──────────────────────────────────────────────
bot.onText(/\/mydeals/, async (msg) => {
  const chatId = String(msg.chat.id);
  const entry  = Object.entries(users).find(([, v]) => String(v && v.chatId) === chatId);

  if (!entry) {
    bot.sendMessage(msg.chat.id, "No wallet linked.\n\nUse /register <wallet> first.");
    return;
  }

  const [wallet] = entry;
  const c = getContract();
  if (!c) { bot.sendMessage(msg.chat.id, "Contract not configured."); return; }

  try {
    await bot.sendMessage(msg.chat.id, "Loading your deals from Ritual Chain...");
    const [bIds, sIds] = await Promise.all([
      c.getBuyerDeals(wallet).catch(() => []),
      c.getSellerDeals(wallet).catch(() => []),
    ]);
    const allIds = [...new Set([...bIds, ...sIds].map(Number))];

    if (!allIds.length) {
      bot.sendMessage(msg.chat.id, "No deals yet.\n\nCreate one: https://shadowotc.xyz");
      return;
    }

    const results = await Promise.allSettled(allIds.map(id => c.getDeal(id)));
    const active  = results
      .map((r, i) => ({ ok: r.status === "fulfilled", id: allIds[i], d: r.value }))
      .filter(({ ok, d }) => ok && Number(d.status) <= 3);

    if (!active.length) {
      bot.sendMessage(msg.chat.id,
        `Found ${allIds.length} deal(s) — all finished or cancelled.\n\nView: https://shadowotc.xyz`
      );
      return;
    }

    await bot.sendMessage(msg.chat.id, `${active.length} active deal(s) of ${allIds.length} total:`);

    for (const { id, d } of active.slice(0, 5)) {
      const amount   = parseFloat(ethers.formatEther(d.paymentAmount)).toFixed(4);
      const status   = STATUS_LABELS[Number(d.status)]   || "Unknown";
      const category = CATEGORY_LABELS[Number(d.category)] || "Unknown";
      await bot.sendMessage(msg.chat.id,
        `Deal #${id} — ${status}\n${category}\n${(d.intent || "").slice(0, 80)}\n${amount} RITUAL\nhttps://shadowotc.xyz/#deal=${id}`
      );
    }
    if (active.length > 5) {
      bot.sendMessage(msg.chat.id, `...and ${active.length - 5} more.\nhttps://shadowotc.xyz`);
    }
  } catch (e) {
    bot.sendMessage(msg.chat.id, `Error: ${e.message}`);
  }
});

// ── Status-change poller ──────────────────────────────────
const knownStatus = {};

const STATUS_MSG = {
  1: "A seller has accepted your deal!",
  2: "Delivery proof submitted — ready to verify.",
  3: "Verification agent is running...",
  4: "Deal complete! Funds released to seller.",
  5: "Deal failed — buyer has been refunded.",
  6: "Dispute raised on this deal.",
  7: "Deal cancelled.",
  8: "Deal expired.",
};

async function pollChanges() {
  const c = getContract();
  if (!c) return;
  const wallets = Object.keys(users).filter(w => users[w] && users[w].chatId);
  if (!wallets.length) return;

  const idSets = await Promise.allSettled(
    wallets.flatMap(w => [c.getBuyerDeals(w).catch(() => []), c.getSellerDeals(w).catch(() => [])])
  );
  const allIds = [...new Set(
    idSets.filter(r => r.status === "fulfilled").flatMap(r => r.value.map(Number))
  )];

  for (const id of allIds) {
    try {
      const raw    = await c.getDeal(id);
      const status = Number(raw.status);
      if (knownStatus[id] === undefined) { knownStatus[id] = status; continue; }
      if (knownStatus[id] === status) continue;
      knownStatus[id] = status;

      const note = STATUS_MSG[status];
      if (!note) continue;

      const amount   = parseFloat(ethers.formatEther(raw.paymentAmount)).toFixed(4);
      const text     =
        `${note}\n\n` +
        `Deal #${id}\n` +
        `${(raw.intent || "").slice(0, 80)}\n` +
        `${amount} RITUAL\n` +
        `https://shadowotc.xyz/#deal=${id}`;

      const buyer  = raw.buyer  && raw.buyer.toLowerCase();
      const seller = raw.seller && raw.seller.toLowerCase();

      if (buyer  && users[buyer]  && users[buyer].chatId)  bot.sendMessage(users[buyer].chatId,  text).catch(() => {});
      if (seller && seller !== buyer && users[seller] && users[seller].chatId) bot.sendMessage(users[seller].chatId, text).catch(() => {});
    } catch {}
  }
}

// ── New-deal notifier ─────────────────────────────────────
let lastCount = 0;

async function notifyNew() {
  const c = getContract();
  if (!c) return;
  try {
    const count = Number(await c.dealCounter());
    if (count <= lastCount) return;

    for (let id = lastCount; id < count; id++) {
      try {
        const raw = await c.getDeal(id);
        if (Number(raw.status) !== 0) continue;
        const amount   = parseFloat(ethers.formatEther(raw.paymentAmount)).toFixed(4);
        const category = CATEGORY_LABELS[Number(raw.category)] || "Unknown";
        const text =
          `New intent posted!\n\n` +
          `Deal #${id}\n` +
          `${category}\n` +
          `${(raw.intent || "").slice(0, 100)}\n` +
          `${amount} RITUAL\n` +
          `Accept it: https://shadowotc.xyz/#deal=${id}`;

        const sellers = Object.entries(users).filter(([, v]) => v && v.role === "seller" && v.chatId);
        for (const [, v] of sellers) {
          bot.sendMessage(v.chatId, text).catch(() => {});
        }
      } catch {}
    }
    lastCount = count;
  } catch {}
}

// ── Start polling loop ────────────────────────────────────
(async () => {
  const c = getContract();
  if (c) {
    try {
      lastCount = Number(await c.dealCounter());
      console.log(`[Bot] Starting from deal #${lastCount}`);
    } catch (e) {
      console.warn("[Bot] Could not read deal count:", e.message);
    }
  }

  setInterval(async () => {
    try { await pollChanges(); } catch (e) { console.error("[Bot] poll error:", e.message); }
    try { await notifyNew();   } catch (e) { console.error("[Bot] new error:",  e.message); }
  }, POLL_MS);

  console.log("[Bot] Online — polling every 30s");
})();

bot.on("polling_error", e => console.error("[Bot] polling:", e.code, e.message));
bot.on("error",         e => console.error("[Bot] error:",   e.message));
