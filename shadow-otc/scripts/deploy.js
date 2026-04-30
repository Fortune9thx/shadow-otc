const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "RITUAL");

  if (balance === 0n) {
    throw new Error("Wallet has no funds! Get testnet RITUAL from https://faucet.ritualfoundation.org");
  }

  const ShadowOTC = await hre.ethers.getContractFactory("ShadowOTC");
  const contract = await ShadowOTC.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("ShadowOTC deployed to:", address);
}

main().catch((err) => {
  console.error("DEPLOY ERROR:", err.message);
  process.exit(1);
});