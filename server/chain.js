const { ethers } = require("ethers");
require("dotenv").config();

const ABI = [
    "function createDeal(string calldata intent) external payable returns (uint256)",
    "function acceptDeal(uint256 dealId) external",
    "function executeDeal(uint256 dealId, bool success) external",
    "function getDeal(uint256 dealId) external view returns (tuple(address buyer, address seller, uint256 amount, string intent, uint8 status))",
    "function dealCounter() external view returns (uint256)",
    "event DealCreated(uint256 indexed dealId, address buyer, string intent, uint256 amount)",
    "event DealAccepted(uint256 indexed dealId, address seller)",
    "event DealExecuted(uint256 indexed dealId, bool success)",
];

const STATUS = ["Open", "Accepted", "Completed", "Failed"];

function getProvider() {
    return new ethers.JsonRpcProvider(process.env.RITUAL_RPC_URL);
}

function getBuyerWallet() {
    return new ethers.Wallet(process.env.PRIVATE_KEY, getProvider());
}

function getSellerWallet() {
    return new ethers.Wallet(process.env.SELLER_PRIVATE_KEY, getProvider());
}

function getContract(wallet) {
    return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);
}

async function createDeal(intent, budgetEther) {
    console.log(`[Chain] Creating deal: "${intent}" for ${budgetEther} RITUAL`);
    const wallet = getBuyerWallet();
    const contract = getContract(wallet);
    const tx = await contract.createDeal(intent, {
        value: ethers.parseEther(budgetEther),
    });
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
        try { return contract.interface.parseLog(log).name === "DealCreated"; }
        catch { return false; }
    });
    const parsed = contract.interface.parseLog(event);
    const dealId = parsed.args.dealId.toString();
    console.log(`[Chain] Deal created — ID: ${dealId}`);
    return { dealId, txHash: tx.hash };
}

async function acceptDeal(dealId) {
    console.log(`[Chain] Accepting deal ${dealId}`);
    const wallet = getSellerWallet();
    const contract = getContract(wallet);
    const tx = await contract.acceptDeal(dealId);
    await tx.wait();
    console.log(`[Chain] Deal ${dealId} accepted`);
    return { txHash: tx.hash };
}

async function executeDeal(dealId, success) {
    console.log(`[Chain] Executing deal ${dealId} — success: ${success}`);
    const wallet = getSellerWallet();
    const contract = getContract(wallet);
    const tx = await contract.executeDeal(dealId, success);
    await tx.wait();
    console.log(`[Chain] Deal ${dealId} executed`);
    return { txHash: tx.hash };
}

async function getDeal(dealId) {
    const wallet = getBuyerWallet();
    const contract = getContract(wallet);
    const deal = await contract.getDeal(dealId);
    return {
        dealId,
        buyer: deal.buyer,
        seller: deal.seller,
        amount: ethers.formatEther(deal.amount),
        intent: deal.intent,
        status: STATUS[Number(deal.status)],
        statusCode: Number(deal.status),
    };
}

async function getTotalDeals() {
    const wallet = getBuyerWallet();
    const contract = getContract(wallet);
    const count = await contract.dealCounter();
    return count.toString();
}

module.exports = { createDeal, acceptDeal, executeDeal, getDeal, getTotalDeals };