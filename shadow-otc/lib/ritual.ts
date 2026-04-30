import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RITUAL_CHAIN_ID, RITUAL_RPC, RITUAL_EXPLORER } from "./addresses.js";

// ─── Ritual Chain Definition ──────────────────────────────────────────────────
export const ritualChain = defineChain({
  id: RITUAL_CHAIN_ID,
  name: "Ritual",
  nativeCurrency: { name: "Ritual", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.RITUAL_RPC_URL ?? RITUAL_RPC],
      webSocket: [process.env.RITUAL_WS_URL ?? "wss://rpc.ritualfoundation.org/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Ritual Explorer", url: RITUAL_EXPLORER },
  },
  contracts: {
    multicall3: { address: "0x5577Ea679673Ec7508E9524100a188E7600202a3" },
  },
});

// ─── Viem clients ─────────────────────────────────────────────────────────────
export function getClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: ritualChain,
    transport: http(),
  }) as PublicClient;
  const walletClient = createWalletClient({
    account,
    chain: ritualChain,
    transport: http(),
  }) as WalletClient;
  return { publicClient, walletClient, account };
}

// ─── TEEServiceRegistry helpers ───────────────────────────────────────────────
const TEE_REGISTRY_ABI = [
  {
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
    ],
    name: "getServicesByCapability",
    outputs: [
      {
        type: "tuple[]",
        components: [
          {
            name: "node",
            type: "tuple",
            components: [
              { name: "paymentAddress", type: "address" },
              { name: "teeAddress",     type: "address" },
              { name: "teeType",        type: "uint8"   },
              { name: "publicKey",      type: "bytes"   },
              { name: "endpoint",       type: "string"  },
              { name: "certPubKeyHash", type: "bytes32" },
              { name: "capability",     type: "uint8"   },
            ],
          },
          { name: "isValid",    type: "bool"    },
          { name: "workloadId", type: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Find an executor that supports the given capability.
 * Capability 0 = HTTP_CALL.
 */
export async function findExecutor(
  publicClient: PublicClient,
  capability: number
): Promise<{ teeAddress: `0x${string}`; publicKey: `0x${string}` }> {
  const services = await publicClient.readContract({
    address: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
    abi: TEE_REGISTRY_ABI,
    functionName: "getServicesByCapability",
    args: [capability, true],
  });

  if (!services || services.length === 0) {
    throw new Error(`No executor found for capability ${capability}`);
  }

  const svc = services[0] as any;
  return {
    teeAddress: svc.node.teeAddress as `0x${string}`,
    publicKey:  svc.node.publicKey  as `0x${string}`,
  };
}

// ─── Logging helpers ──────────────────────────────────────────────────────────
export function log(agent: string, msg: string) {
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] [${agent}] ${msg}`);
}

export function logJson(agent: string, label: string, data: unknown) {
  log(agent, `${label}: ${JSON.stringify(data, null, 2)}`);
}
