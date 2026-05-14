/**
 * Shadow OTC — Smart Contract Interface
 * Contract: 0xe48aB58BEA9AD3d4c94A3d09c5Fd98320151bF80
 * Network:  Ritual Testnet (Chain ID 1979)
 */
import { ethers } from "ethers";

export const CONTRACT_ADDRESS = "0xe48aB58BEA9AD3d4c94A3d09c5Fd98320151bF80";
export const RPC_URL          = "https://rpc.ritualfoundation.org";

export const STATUS_LABELS = [
  "Open", "Accepted", "Pending Delivery",
  "Verifying", "Completed", "Failed",
  "Disputed", "Cancelled", "Expired",
];

export const CATEGORY_LABELS = [
  "Social Media", "Content Creation", "Freelance",
  "NFT Transfer", "NFT Whitelist", "Airdrop Allocation",
  "Token Allocation", "Pre-Market", "Marketing",
  "Bug Bounty", "Escrow", "Conditional",
];

export const CATEGORY_ICONS = [
  "📣","✍️","💼","🖼️","📋","🪂","🪙","🚀","📢","🐛","🔒","⚡",
];

const ABI = [
  // Read
  "function dealCounter() external view returns (uint256)",
  "function getDeal(uint256) external view returns (tuple(address buyer,address seller,address verifier,uint8 category,uint8 status,uint8 verificationMethod,uint8 collateralRequirement,uint256 paymentAmount,uint256 collateralAmount,uint256 commitmentFee,uint256 remainingPayment,uint256 createdAt,uint256 acceptedAt,uint256 deadline,uint256 deliveryClaimedAt,string intent,string conditionUrl,string conditionParams,string deliveryProof,bool requiresCollateral,bool partialPaymentEnabled,bool autoRefundOnExpiry,bool disputed))",
  "function getBuyerDeals(address) external view returns (uint256[])",
  "function getSellerDeals(address) external view returns (uint256[])",
  "function getRequiredCollateral(uint256) external view returns (uint256)",
  // Write
  "function createDeal(uint8,string,string,string,uint256,uint256,uint8,uint8) external payable returns (uint256)",
  "function acceptDeal(uint256) external payable",
  "function submitDelivery(uint256,string) external",
  "function cancelDeal(uint256) external",
  "function raiseDispute(uint256,string) external",
  // Events
  "event DealCreated(uint256 indexed dealId,address indexed buyer,uint8 category,uint256 amount,uint256 deadline)",
  "event DealAccepted(uint256 indexed dealId,address indexed seller,uint256 collateral)",
  "event DealCompleted(uint256 indexed dealId,uint256 sellerPayout,uint256 platformFee)",
  "event DealFailed(uint256 indexed dealId,string reason)",
  "event DeliverySubmitted(uint256 indexed dealId,address indexed seller,string proofUrl)",
];

/* ── read-only provider (no wallet needed) ── */
export function getReadProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

/* ── signer from MetaMask ── */
export function getSigner() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const web3Provider = new ethers.BrowserProvider(window.ethereum);
  return web3Provider.getSigner();
}

/* ── read-only contract ── */
export function getContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
}

/* ── write contract (requires wallet) ── */
export async function getWriteContract() {
  const signer = await getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

/* ── fetch all on-chain deals ── */
export async function fetchOnChainDeals() {
  const contract = getContract();
  const count = Number(await contract.dealCounter());
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i);
  const results = await Promise.allSettled(ids.map(id => contract.getDeal(id)));

  return results
    .map((r, id) => r.status === "fulfilled" ? parseDeal(id, r.value) : null)
    .filter(Boolean);
}

/* ── fetch deals for a specific wallet ── */
export async function fetchMyDeals(walletAddress) {
  const contract = getContract();
  try {
    const [buyerIds, sellerIds] = await Promise.all([
      contract.getBuyerDeals(walletAddress),
      contract.getSellerDeals(walletAddress),
    ]);
    const allIds = [...new Set([...buyerIds, ...sellerIds].map(Number))];
    const results = await Promise.allSettled(allIds.map(id => contract.getDeal(id)));
    return results
      .map((r, i) => r.status === "fulfilled" ? parseDeal(allIds[i], r.value) : null)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/* ── parse raw contract deal into a clean object ── */
export function parseDeal(id, d) {
  const statusId   = Number(d.status);
  const categoryId = Number(d.category);
  const payment    = ethers.formatEther(d.paymentAmount);
  const remaining  = ethers.formatEther(d.remainingPayment);
  const collateral = ethers.formatEther(d.collateralAmount);

  return {
    id,
    buyer:         d.buyer,
    seller:        d.seller === ethers.ZeroAddress ? null : d.seller,
    verifier:      d.verifier === ethers.ZeroAddress ? null : d.verifier,
    category:      categoryId,
    categoryLabel: CATEGORY_LABELS[categoryId] ?? "Unknown",
    categoryIcon:  CATEGORY_ICONS[categoryId] ?? "📦",
    status:        statusId,
    statusLabel:   STATUS_LABELS[statusId] ?? "Unknown",
    payment,
    remaining,
    collateral:    collateral !== "0.0" ? collateral : null,
    commitFee:     ethers.formatEther(d.commitmentFee),
    intent:        d.intent,
    conditionUrl:  d.conditionUrl,
    deliveryProof: d.deliveryProof || null,
    deadline:      Number(d.deadline) * 1000,
    createdAt:     Number(d.createdAt) * 1000,
    acceptedAt:    d.acceptedAt > 0n ? Number(d.acceptedAt) * 1000 : null,
    isExpired:     Date.now() > Number(d.deadline) * 1000,
    requiresCollateral: d.requiresCollateral,
    disputed:      d.disputed,
    // UI helpers
    isOpen:        statusId === 0,
    isAccepted:    statusId === 1,
    isPending:     statusId === 2,
    isVerifying:   statusId === 3,
    isCompleted:   statusId === 4,
    isFailed:      statusId === 5,
  };
}

/* ── create a new deal (locks funds in escrow) ── */
export async function createDeal({
  category,        // 0–11
  intent,          // human-readable description
  conditionUrl,    // URL to verify against
  conditionParams, // JSON string of verification params
  deadlineHours,   // hours until expiry
  commitFeePercent,// 0–50 (% released to seller on accept)
  collateral,      // 0=None 1=Partial 2=Full 3=Double
  verificationMethod, // 0=HTTP 1=OnChain 2=Manual 3=Dual
  amountEth,       // RITUAL amount as string e.g. "0.1"
}) {
  const contract = await getWriteContract();
  const value    = ethers.parseEther(amountEth);
  const tx = await contract.createDeal(
    category, intent, conditionUrl, conditionParams ?? "{}",
    deadlineHours, commitFeePercent, collateral, verificationMethod,
    { value }
  );
  const receipt = await tx.wait();
  // Extract deal ID from DealCreated event
  const event = receipt.logs
    .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "DealCreated");
  return { txHash: tx.hash, dealId: event ? Number(event.args.dealId) : null };
}

/* ── seller accepts a deal ── */
export async function acceptDeal(dealId, collateralEth = "0") {
  const contract = await getWriteContract();
  const value    = ethers.parseEther(collateralEth);
  const tx = await contract.acceptDeal(dealId, { value });
  return tx.wait();
}

/* ── seller submits delivery proof ── */
export async function submitDelivery(dealId, proofUrl) {
  const contract = await getWriteContract();
  const tx = await contract.submitDelivery(dealId, proofUrl);
  return tx.wait();
}

/* ── buyer cancels open deal ── */
export async function cancelDeal(dealId) {
  const contract = await getWriteContract();
  const tx = await contract.cancelDeal(dealId);
  return tx.wait();
}
