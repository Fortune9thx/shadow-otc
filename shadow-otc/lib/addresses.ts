// ─── Ritual Chain constants ───────────────────────────────────────────────────
export const RITUAL_CHAIN_ID = 1979;
export const RITUAL_RPC      = "https://rpc.ritualfoundation.org";
export const RITUAL_WS       = "wss://rpc.ritualfoundation.org/ws";
export const RITUAL_EXPLORER = "https://explorer.ritualfoundation.org";

// ─── Precompile addresses ─────────────────────────────────────────────────────
export const PRECOMPILES = {
  HTTP_CALL:  "0x0000000000000000000000000000000000000801",
  LLM:        "0x0000000000000000000000000000000000000802",
  JQ:         "0x0000000000000000000000000000000000000803",
} as const;

// ─── System contracts ─────────────────────────────────────────────────────────
export const SYSTEM = {
  RITUAL_WALLET:      "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  ASYNC_JOB_TRACKER:  "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5",
  TEE_SERVICE_REGISTRY: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  SCHEDULER:          "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  ASYNC_DELIVERY:     "0x5A16214fF555848411544b005f7Ac063742f39F6",
} as const;

// ─── TEEServiceRegistry capability IDs ───────────────────────────────────────
export const Capability = {
  HTTP_CALL: 0,
  LLM:       1,
  STREAMING: 3,
} as const;

// ─── ShadowOTC contract address (set after deploy) ────────────────────────────
export const SHADOW_OTC_ADDRESS = (
  process.env.SHADOW_OTC_ADDRESS ?? ""
) as `0x${string}`;

// ─── ShadowOTC ABI ───────────────────────────────────────────────────────────
export const SHADOW_OTC_ABI = [
  // createDeal
  {
    inputs: [
      { name: "intent",         type: "string"  },
      { name: "verifyUrl",      type: "string"  },
      { name: "contentKey",     type: "string"  },
      { name: "likesTarget",    type: "uint256" },
      { name: "maxRetries",     type: "uint256" },
      { name: "durationBlocks", type: "uint256" },
    ],
    name: "createDeal",
    outputs: [{ name: "dealId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  // acceptDeal
  {
    inputs: [{ name: "dealId", type: "uint256" }],
    name: "acceptDeal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // runVerification
  {
    inputs: [
      { name: "dealId",   type: "uint256" },
      { name: "executor", type: "address" },
    ],
    name: "runVerification",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // cancelDeal
  {
    inputs: [{ name: "dealId", type: "uint256" }],
    name: "cancelDeal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // expireDeal
  {
    inputs: [{ name: "dealId", type: "uint256" }],
    name: "expireDeal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // depositFees
  {
    inputs: [],
    name: "depositFees",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // feesBalance
  {
    inputs: [],
    name: "feesBalance",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // getDeal
  {
    inputs: [{ name: "dealId", type: "uint256" }],
    name: "getDeal",
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id",           type: "uint256" },
          { name: "buyer",        type: "address" },
          { name: "seller",       type: "address" },
          { name: "amount",       type: "uint256" },
          { name: "intent",       type: "string"  },
          { name: "verifyUrl",    type: "string"  },
          { name: "contentKey",   type: "string"  },
          { name: "likesTarget",  type: "uint256" },
          { name: "state",        type: "uint8"   },
          { name: "retryCount",   type: "uint256" },
          { name: "maxRetries",   type: "uint256" },
          { name: "expiryBlock",  type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // dealCount
  {
    inputs: [],
    name: "dealCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId",  type: "uint256" },
      { indexed: true,  name: "buyer",   type: "address" },
      { indexed: false, name: "amount",  type: "uint256" },
      { indexed: false, name: "intent",  type: "string"  },
    ],
    name: "DealCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId",  type: "uint256" },
      { indexed: true,  name: "seller",  type: "address" },
    ],
    name: "DealAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId",     type: "uint256" },
      { indexed: false, name: "valueFound", type: "uint256" },
    ],
    name: "VerificationPassed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId",     type: "uint256" },
      { indexed: false, name: "valueFound", type: "uint256" },
      { indexed: false, name: "retryCount", type: "uint256" },
      { indexed: false, name: "reason",     type: "string"  },
    ],
    name: "VerificationFailed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId",  type: "uint256" },
      { indexed: true,  name: "seller",  type: "address" },
      { indexed: false, name: "amount",  type: "uint256" },
    ],
    name: "DealComplete",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "dealId", type: "uint256" },
      { indexed: false, name: "reason", type: "string"  },
    ],
    name: "DealFailed",
    type: "event",
  },
] as const;

// ─── Deal state enum mapping ──────────────────────────────────────────────────
export const DealState: Record<number, string> = {
  0: "OPEN",
  1: "ACCEPTED",
  2: "VERIFYING",
  3: "COMPLETE",
  4: "FAILED",
  5: "CANCELLED",
};
