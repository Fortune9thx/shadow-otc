const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ShadowOTC V2 with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "RITUAL");

  const platformWallet = deployer.address; // change to your treasury wallet
  const platformFee = 100; // 1% (100 basis points)

  const ShadowOTCV2 = await hre.ethers.getContractFactory("ShadowOTCV2");
  const contract = await ShadowOTCV2.deploy(platformWallet, platformFee);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nShadowOTC V2 deployed to:", address);
  console.log("Platform wallet:", platformWallet);
  console.log("Platform fee:", platformFee / 100 + "%");
  console.log("\nAdd to your .env file:");
  console.log(`CONTRACT_ADDRESS_V2=${address}`);

  // Authorize deployer as verifier
  const tx = await contract.addAuthorizedVerifier(deployer.address);
  await tx.wait();
  console.log("\nDeployer authorized as verifier.");
  console.log("\nAll 12 deal templates initialized:");
  console.log("  0. Social Media Engagement");
  console.log("  1. Content Creation");
  console.log("  2. Freelance Service");
  console.log("  3. NFT OTC Sale");
  console.log("  4. NFT Whitelist Spot");
  console.log("  5. Airdrop Allocation");
  console.log("  6. Token Allocation OTC");
  console.log("  7. Pre-Market Token Deal");
  console.log("  8. Marketing and Promotion");
  console.log("  9. Bug Bounty");
  console.log(" 10. Generic Escrow");
  console.log(" 11. Conditional Payment");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});