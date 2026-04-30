/**
 * Verification Agent — Shadow OTC MVP (THE CORE RITUAL MAGIC)
 *
 * Triggers on-chain web verification via the Ritual HTTP precompile.
 * The contract fetches the URL, parses the likes count, and automatically
 * releases funds if the condition is met — all on-chain, no middleman.
 *
 * Features used:
 *   - HTTP precompile (0x0801) — on-chain web fetch
 *   - TEEServiceRegistry        — executor discovery
 *   - Retry loop with backoff   — persistence
 *
 * Usage:
 *   DEAL_ID=1 npx ts-node agents/verifier.ts
 */

import "dotenv/config";
import { formatEther } from "viem";
import { getClients, findExecutor, log } from "../lib/ritual.js";
import {
  SHADOW_OTC_ADDRESS,
  SHADOW_OTC_ABI,
  DealState,
  Capability,
} from "../lib/addresses.js";

const AGENT = "VerifierAgent";

// Retry config
const MAX_AGENT_RETRIES = Number(process.env.MAX_AGENT_RETRIES ?? "5");
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS ?? "15000"); // 15s between retries

async function main() {
  // ── Validate env ──────────────────────────────────────────────────────────
  const pk = process.env.VERIFIER_PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("VERIFIER_PRIVATE_KEY not set in .env");
  if (!SHADOW_OTC_ADDRESS) throw new Error("SHADOW_OTC_ADDRESS not set in .env");

  const dealIdRaw = process.env.DEAL_ID;
  if (!dealIdRaw) throw new Error("DEAL_ID not set. Run: DEAL_ID=<n> npx ts-node agents/verifier.ts");
  const dealId = BigInt(dealIdRaw);

  const { publicClient, walletClient, account } = getClients(pk);
  log(AGENT, `Wallet:   ${account.address}`);
  log(AGENT, `Contract: ${SHADOW_OTC_ADDRESS}`);
  log(AGENT, `Deal ID:  ${dealId}`);
  log(AGENT, "");

  // ── Read deal ─────────────────────────────────────────────────────────────
  const deal = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "getDeal",
    args: [dealId],
  }) as any;

  log(AGENT, `Deal: "${deal.intent}"`);
  log(AGENT, `State:       ${DealState[deal.state]}`);
  log(AGENT, `Verify URL:  ${deal.verifyUrl}`);
  log(AGENT, `Target:      ${deal.likesTarget} likes`);
  log(AGENT, `Max retries: ${deal.maxRetries} (contract) / ${MAX_AGENT_RETRIES} (agent)`);
  log(AGENT, "");

  if (deal.state !== 1 /* ACCEPTED */ && deal.state !== 0 /* OPEN */) {
    log(AGENT, `Deal is ${DealState[deal.state]} — verification not needed.`);
    process.exit(0);
  }

  if (deal.seller === "0x0000000000000000000000000000000000000000") {
    log(AGENT, "No seller yet — wait for seller to accept the deal.");
    process.exit(1);
  }

  // ── Find TEE executor for HTTP_CALL ───────────────────────────────────────
  log(AGENT, "Querying TEEServiceRegistry for HTTP_CALL executor...");
  const executor = await findExecutor(publicClient, Capability.HTTP_CALL);
  log(AGENT, `Executor TEE address: ${executor.teeAddress}`);
  log(AGENT, "");

  // ── Check RitualWallet fees ───────────────────────────────────────────────
  const fees = await publicClient.readContract({
    address: SHADOW_OTC_ADDRESS,
    abi: SHADOW_OTC_ABI,
    functionName: "feesBalance",
  }) as bigint;

  log(AGENT, `Contract RitualWallet balance: ${formatEther(fees)} RITUAL`);

  if (fees < BigInt("10000000000000000")) { // < 0.01 RITUAL
    log(AGENT, "⚠️  Low fee balance. Topping up RitualWallet...");
    const topUpHash = await walletClient.writeContract({
      address: SHADOW_OTC_ADDRESS,
      abi: SHADOW_OTC_ABI,
      functionName: "depositFees",
      value: BigInt("100000000000000000"), // 0.1 RITUAL
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: topUpHash });
    log(AGENT, "Fees topped up.");
  }

  // ── Verification loop with retry ──────────────────────────────────────────
  log(AGENT, "=== STARTING ON-CHAIN VERIFICATION ===");
  log(AGENT, "The HTTP precompile will fetch the URL inside the TEE and");
  log(AGENT, "parse the likes count on-chain. No API. No middleman.");
  log(AGENT, "");

  for (let attempt = 1; attempt <= MAX_AGENT_RETRIES; attempt++) {
    log(AGENT, `--- Attempt ${attempt}/${MAX_AGENT_RETRIES} ---`);
    log(AGENT, "Fetching webpage...");
    log(AGENT, `  URL: ${deal.verifyUrl}`);
    log(AGENT, "Verifying condition on-chain...");

    try {
      const verifyHash = await walletClient.writeContract({
        address: SHADOW_OTC_ADDRESS,
        abi: SHADOW_OTC_ABI,
        functionName: "runVerification",
        args: [dealId, executor.teeAddress],
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
        gas: 3_000_000n,
      });

      log(AGENT, `Tx submitted: ${verifyHash}`);
      log(AGENT, "Waiting for Ritual executor to settle...");
      log(AGENT, "(The executor fetches the URL in a TEE, result injected on-chain)");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: verifyHash,
        timeout: 120_000, // 2 min timeout
      });

      log(AGENT, `Settled in block ${receipt.blockNumber}`);

      // ── Check deal state after verification ──────────────────────────────
      const updated = await publicClient.readContract({
        address: SHADOW_OTC_ADDRESS,
        abi: SHADOW_OTC_ABI,
        functionName: "getDeal",
        args: [dealId],
      }) as any;

      const stateStr = DealState[updated.state] ?? `Unknown(${updated.state})`;
      log(AGENT, `Deal state: ${stateStr}`);
      log(AGENT, `Retry count: ${updated.retryCount}/${updated.maxRetries}`);

      if (updated.state === 3 /* COMPLETE */) {
        log(AGENT, "");
        log(AGENT, "╔═══════════════════════════════════════════╗");
        log(AGENT, "║  ✅ VERIFICATION PASSED — DEAL COMPLETE   ║");
        log(AGENT, "╚═══════════════════════════════════════════╝");
        log(AGENT, `💰 ${formatEther(deal.amount)} RITUAL automatically released to seller`);
        log(AGENT, `   Seller: ${deal.seller}`);
        log(AGENT, `   Explorer: https://explorer.ritualfoundation.org/tx/${verifyHash}`);
        log(AGENT, "");
        log(AGENT, "No marketplace. No middleman. No API.");
        log(AGENT, "Just autonomous agents making and enforcing deals on Ritual.");
        process.exit(0);
      }

      if (updated.state === 4 /* FAILED */) {
        log(AGENT, "");
        log(AGENT, "❌ Max contract retries reached. Deal failed. Buyer refunded.");
        process.exit(1);
      }

      if (updated.state === 1 /* ACCEPTED = retry state */) {
        log(AGENT, `Condition not yet met. Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
        await sleep(RETRY_DELAY_MS);
      }

    } catch (err: any) {
      log(AGENT, `Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_AGENT_RETRIES) {
        log(AGENT, `Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  log(AGENT, "Max agent retries exhausted. Run again later.");
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("[VerifierAgent] Fatal:", err.message);
  process.exit(1);
});
