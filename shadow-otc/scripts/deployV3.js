const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("═══════════════════════════════════════════");
  console.log("  SHADOW OTC V3 — DEPLOYMENT");
  console.log("═══════════════════════════════════════════");
  console.log("Deployer:     ", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:      ", hre.ethers.formatEther(balance), "RITUAL");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.01) {
    console.error("\n❌ Insufficient balance. Need at least 0.01 RITUAL for deployment.");
    console.error("   Get testnet RITUAL from the Ritual faucet.");
    process.exit(1);
  }

  const platformWallet = deployer.address; // your treasury wallet
  const platformFee    = 100;              // 1% (100 basis points out of 10000)

  console.log("\nDeploying ShadowOTCV3...");
  const ShadowOTCV3 = await hre.ethers.getContractFactory("ShadowOTCV3");
  const contract    = await ShadowOTCV3.deploy(platformWallet, platformFee);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ ShadowOTC V3 deployed to:", address);
  console.log("   Platform wallet:", platformWallet);
  console.log("   Platform fee:   ", platformFee / 100 + "%");

  // Authorize deployer's SELLER_PRIVATE_KEY wallet as the verifier agent
  const verifierWallet = process.env.SELLER_PRIVATE_KEY
    ? new hre.ethers.Wallet(process.env.SELLER_PRIVATE_KEY).address
    : deployer.address;

  console.log("\nAuthorizing verifier wallet:", verifierWallet);
  const tx1 = await contract.addAuthorizedVerifier(verifierWallet);
  await tx1.wait();
  console.log("✅ Verifier authorized.");

  // Also authorize deployer (for testing)
  if (verifierWallet !== deployer.address) {
    const tx2 = await contract.addAuthorizedVerifier(deployer.address);
    await tx2.wait();
    console.log("✅ Deployer also authorized as verifier.");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  NEXT STEPS");
  console.log("═══════════════════════════════════════════");
  console.log("\n1️⃣  Update your .env file:");
  console.log(`   CONTRACT_ADDRESS_V3=${address}`);
  console.log(`   CONTRACT_ADDRESS_V2=${address}   ← (also update this so verifier uses V3)`);

  console.log("\n2️⃣  Update frontend/src/lib/contract.js:");
  console.log(`   export const CONTRACT_ADDRESS = "${address}";`);

  console.log("\n3️⃣  Redeploy frontend:");
  console.log("   git add -A && git commit -m 'chore: point to V3 contract' && git push");

  console.log("\n4️⃣  Start the Telegram bot:");
  console.log("   node agents/telegram-bot.js");

  console.log("\n═══════════════════════════════════════════");
  console.log(`Contract address: ${address}`);
  console.log("Explorer: https://explorer.ritualfoundation.org/address/" + address);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
