// src/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, defineChain } from "viem";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined;
if (!SEPOLIA_RPC) {
  // Fail early with a clear message instead of a blank page.
  throw new Error("Missing env var: VITE_SEPOLIA_RPC_URL");
}

const ANVIL_RPC = import.meta.env.VITE_ANVIL_RPC_URL as string | undefined;

const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ANVIL_RPC ?? "http://127.0.0.1:8545"] },
    public: { http: [ANVIL_RPC ?? "http://127.0.0.1:8545"] },
  },
});

// Prod: Sepolia only
const prodConfig = getDefaultConfig({
  appName: "PowerIndex",
  projectId: "powerindex-local-dev",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
  },
});

// Dev: include Anvil too (uses env or localhost fallback)
const devConfig = getDefaultConfig({
  appName: "PowerIndex",
  projectId: "powerindex-local-dev",
  chains: [anvil, sepolia],
  transports: {
    [anvil.id]: http(ANVIL_RPC ?? "http://127.0.0.1:8545"),
    [sepolia.id]: http(SEPOLIA_RPC),
  },
});

export const wagmiConfig = import.meta.env.PROD ? prodConfig : devConfig;