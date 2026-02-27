import type { SupportedChainId } from "./chains";
import { ANVIL, SEPOLIA } from "./chains";

export type Contracts = {
  consumer: `0x${string}`;
  forwarder?: `0x${string}`;
  market?: `0x${string}`;
};


export const CONTRACTS: Record<SupportedChainId, Contracts> = {
  [ANVIL.id]: {
    consumer: (import.meta.env.VITE_ANVIL_CONSUMER_ADDRESS ?? "0xe7f1...") as `0x${string}`,
    forwarder: (import.meta.env.VITE_ANVIL_FORWARDER_ADDRESS ?? "0x5FbD...") as `0x${string}`,
  },
  [SEPOLIA.id]: {
    consumer: (import.meta.env.VITE_SEPOLIA_CONSUMER_ADDRESS ?? "0x215BffcdbAD4B09bdF2Dc63c375E6DeE81fEb907") as `0x${string}`,
    // forwarder: undefined,
  },
};