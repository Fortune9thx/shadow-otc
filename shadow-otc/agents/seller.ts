/**
 * Seller Agent — Shadow OTC MVP
 *
 * Watches for open deals, accepts a specific deal, simulates task execution,
 * then notifies the verifier to run.
 *
 * Usage:
 *   DEAL_ID=1 npx ts-node agents/seller.ts
 */

import "dotenv/config";
import { formatEther } from "viem";
import { getClients, log } from "../lib/ritual.js";
import {
  SHADOW_OTC_ADDRESS,
  SHADOW_OTC_ABI,
  DealState,
} from "../lib/addresses.js";

const AGENT = "SellerAgent";

async function main() {
  // ── Validate env ──────────────────────────────────────────────────────────
  const pk = process.env.SELLER_PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("SELLER_PRIVATE_KEY not set in .env");
  if (!SHADOW_OTC_ADDRESS) throw new Error("SHADOW_OTC_ADDRESS not set in .env");

  const dealIdRaw = process.env.DEAL_ID;
  if (!dealIdRaw) throw new Error("DEAL_ID not set. Run: DEAL_ID=<n> npx ts-node agents/seller.ts");
  const dealId = BigInt(dealIdRaw);

  const { publicClient, walletClient, account } = getClients(pk);
  log(AGENT, `Wallet: ${account.address}`);

  // ── Read the deal ─────────────────────────────────────────────────────────
  const deal = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "getDeal",
    args: [dealId],
  }) as any;

  log(AGENT, `Found Deal ${dealId}:`);
  log(AGENT, `  Intent:       ${deal.intent}`);
  log(AGENT, `  Buyer:        ${deal.buyer}`);
  log(AGENT, `  Amount:       ${formatEther(deal.amount)} RITUAL`);
  log(AGENT, `  State:        ${DealState[deal.state] ?? deal.state}`);
  log(AGENT, `  Verify URL:   ${deal.verifyUrl}`);
  log(AGENT, `  Likes target: ${deal.likesTarget}`);

  if (deal.state !== 0) { // 0 = OPEN
    log(AGENT, `Deal is ${DealState[deal.state]} — cannot accept.`);
    process.exit(0);
  }

  // ── Negotiation logic ─────────────────────────────────────────────────────
  // Simple: accept if the amount is above our minimum floor.
  const MIN_FLOOR_WEI = BigInt(process.env.MIN_FLOOR_WEI ?? "1000000000000000"); // 0.001 RITUAL
  if (deal.amount < MIN_FLOOR_WEI) {
    log(AGENT, `Deal amount ${formatEther(deal.amount)} RITUAL is below floor ${formatEther(MIN_FLOOR_WEI)} RITUAL.`);
    log(AGENT, "Rejecting deal.");
    process.exit(0);
  }

  log(AGENT, `✅ Deal looks good. Accepting...`);
  log(AGENT, `   Evaluating offer: ${formatEther(deal.amount)} RITUAL for "${deal.intent}"`);

  // ── Accept deal ───────────────────────────────────────────────────────────
  const hash = await walletClient.writeContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "acceptDeal",
    args: [dealId],
    maxFeePerGas: 30_000_000_000n,
    maxPriorityFeePerGas: 2_000_000_000n,
  });

  log(AGENT, `Tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log(AGENT, `Confirmed in block ${receipt.blockNumber}`);

  // ── Confirm state ─────────────────────────────────────────────────────────
  const updated = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "getDeal",
    args: [dealId],
  }) as any;

  log(AGENT, `🤝 Deal state: ${DealState[updated.state]}`);

  // ── Simulate task execution ───────────────────────────────────────────────
  log(AGENT, "");
  log(AGENT, "=== PERFORMING TASK ===");
  log(AGENT, `Task: ${deal.intent}`);
  log(AGENT, "Simulating: posting content and building engagement...");
  await sleep(2000);
  log(AGENT, "[Simulation] Content posted.");
  await sleep(1000);
  log(AGENT, "[Simulation] Engagement growing...");
  await sleep(1000);
  log(AGENT, "[Simulation] Task complete — condition should now be met.");

  // ── Instruct next step ────────────────────────────────────────────────────
  log(AGENT, "");
  log(AGENT, "=== NEXT STEP ===");
  log(AGENT, "Run the verifier to check the condition on-chain:");
  log(AGENT, `  DEAL_ID=${dealId} npx ts-node agents/verifier.ts`);
  log(AGENT, "");
  log(AGENT, "Verifier will:");
  log(AGENT, `  1. Fetch: ${deal.verifyUrl}`);
  log(AGENT, `  2. Parse likes count from response`);
  log(AGENT, `  3. Check if >= ${deal.likesTarget}`);
  log(AGENT, `  4. Auto-release ${formatEther(deal.amount)} RITUAL to you if passed`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("[SellerAgent] Fatal:", err.message);
  process.exit(1);
});
