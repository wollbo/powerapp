// src/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, defineChain } from "viem";
import { sepolia } from "viem/chains";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";

const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_ANVIL_RPC_URL] },
    public: { http: [import.meta.env.VITE_ANVIL_RPC_URL] },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "PowerIndex",
  projectId: "powerindex-local-dev",
  wallets: [{ groupName: "Recommended", wallets: [metaMaskWallet] }],
  chains: [anvil, sepolia],
  transports: {
    [anvil.id]: http(import.meta.env.VITE_ANVIL_RPC_URL),
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
  },
});
