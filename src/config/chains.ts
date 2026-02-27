export const ANVIL = {
  id: 31337,
  name: "Anvil",
  explorerTx: (hash: string) => null as string | null, // no explorer
};

export const SEPOLIA = {
  id: 11155111,
  name: "Sepolia",
  explorerTx: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
};

export const SUPPORTED_CHAIN_IDS = [ANVIL.id, SEPOLIA.id] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(id: number): id is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);
}
