const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const ShadowOTC = await hre.ethers.getContractFactory("ShadowOTC");
    const contract = await ShadowOTC.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("ShadowOTC deployed to:", address);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});