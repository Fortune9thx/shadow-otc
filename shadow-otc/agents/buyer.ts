/**
 * Buyer Agent — Shadow OTC MVP
 *
 * Creates a deal on-chain, locking funds in the ShadowOTC escrow.
 * Watches for the DealAccepted event to confirm the seller joined.
 *
 * Usage:
 *   npx ts-node agents/buyer.ts
 */

import "dotenv/config";
import { parseEther, formatEther } from "viem";
import { getClients, log } from "../lib/ritual.js";
import {
  SHADOW_OTC_ADDRESS,
  SHADOW_OTC_ABI,
  DealState,
} from "../lib/addresses.js";

const AGENT = "BuyerAgent";

async function main() {
  // ── Validate env ──────────────────────────────────────────────────────────
  const pk = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("BUYER_PRIVATE_KEY not set in .env");
  if (!SHADOW_OTC_ADDRESS) throw new Error("SHADOW_OTC_ADDRESS not set in .env");

  const { publicClient, walletClient, account } = getClients(pk);
  log(AGENT, `Wallet: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  log(AGENT, `Balance: ${formatEther(balance)} RITUAL`);

  // ── Deal parameters ───────────────────────────────────────────────────────
  //
  // verifyUrl    — a URL that returns JSON with a likes/engagement count.
  //                For the MVP we use a public mock endpoint. Replace with
  //                the real post URL or a lightweight API wrapper.
  //
  // contentKey   — the JSON key to search after in the HTTP response.
  //                e.g.  '"like_count":'  →  extracts the number after it.
  //
  // Real X posts use the Twitter v2 API:
  //   GET /2/tweets/:id?tweet.fields=public_metrics
  //   Response: {"data":{"public_metrics":{"like_count":67,...}}}
  //   contentKey: '"like_count":'
  //
  const DEAL_PARAMS = {
    intent: "Post my content and reach 50 likes",
    verifyUrl: process.env.VERIFY_URL ??
      "https://jsonplaceholder.typicode.com/todos/1", // mock for demo
    contentKey: process.env.CONTENT_KEY ?? '"userId":', // demo: checks userId field
    likesTarget: BigInt(process.env.LIKES_TARGET ?? "1"), // demo: userId >= 1
    maxRetries: 3n,
    durationBlocks: 100_000n,   // ~9.7 hours at 350ms/block
    escrowAmount: parseEther(process.env.ESCROW_AMOUNT ?? "0.01"),
  };

  log(AGENT, "Deal parameters:");
  log(AGENT, `  Intent:       ${DEAL_PARAMS.intent}`);
  log(AGENT, `  Verify URL:   ${DEAL_PARAMS.verifyUrl}`);
  log(AGENT, `  Content key:  ${DEAL_PARAMS.contentKey}`);
  log(AGENT, `  Likes target: ${DEAL_PARAMS.likesTarget}`);
  log(AGENT, `  Escrow:       ${formatEther(DEAL_PARAMS.escrowAmount)} RITUAL`);

  // ── Create deal ───────────────────────────────────────────────────────────
  log(AGENT, "Creating deal on-chain...");

  const hash = await walletClient.writeContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "createDeal",
    args: [
      DEAL_PARAMS.intent,
      DEAL_PARAMS.verifyUrl,
      DEAL_PARAMS.contentKey,
      DEAL_PARAMS.likesTarget,
      DEAL_PARAMS.maxRetries,
      DEAL_PARAMS.durationBlocks,
    ],
    value: DEAL_PARAMS.escrowAmount,
    maxFeePerGas: 30_000_000_000n,
    maxPriorityFeePerGas: 2_000_000_000n,
  });

  log(AGENT, `Tx submitted: ${hash}`);
  log(AGENT, "Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log(AGENT, `Confirmed in block ${receipt.blockNumber}`);

  // ── Decode dealId from DealCreated event ──────────────────────────────────
  const dealId = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "dealCount",
  });

  log(AGENT, `✅ Deal created! Deal ID: ${dealId}`);

  // ── Read back the deal ────────────────────────────────────────────────────
  const deal = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "getDeal",
    args: [dealId],
  }) as any;

  log(AGENT, "Deal state:");
  log(AGENT, `  State:        ${DealState[deal.state] ?? deal.state}`);
  log(AGENT, `  Amount:       ${formatEther(deal.amount)} RITUAL`);
  log(AGENT, `  Verify URL:   ${deal.verifyUrl}`);
  log(AGENT, `  Likes target: ${deal.likesTarget}`);

  // ── Watch for DealAccepted ────────────────────────────────────────────────
  log(AGENT, "Watching for seller to accept the deal...");

  const unwatch = publicClient.watchContractEvent({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    eventName: "DealAccepted",
    onLogs: (logs) => {
      for (const evt of logs as any[]) {
        if (evt.args?.dealId?.toString() === dealId.toString()) {
          log(AGENT, `🤝 Deal ${dealId} accepted by seller: ${evt.args.seller}`);
          log(AGENT, "Seller is now performing the task. Run verifier.ts to verify.");
          unwatch();
          process.exit(0);
        }
      }
    },
  });

  log(AGENT, `Listening... (Ctrl+C to exit)`);
  log(AGENT, `Share Deal ID ${dealId} with the seller.`);
  log(AGENT, `Seller runs: DEAL_ID=${dealId} npx ts-node agents/seller.ts`);

  // Keep alive for 10 minutes then exit
  setTimeout(() => {
    log(AGENT, "Timeout — exiting. Seller hasn't accepted yet.");
    process.exit(0);
  }, 10 * 60 * 1000);
}

main().catch((err) => {
  console.error("[BuyerAgent] Fatal:", err.message);
  process.exit(1);
});
