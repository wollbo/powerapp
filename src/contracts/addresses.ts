export type ChainKey = "anvil" | "sepolia";

export const CHAIN_ID_TO_KEY: Record<number, ChainKey> = {
  31337: "anvil",
  11155111: "sepolia",
};

function optEnv(name: string) {
  const v = import.meta.env[name];
  return (v && String(v).trim().length > 0) ? (v as string) : undefined;
}

export function getAddresses(chainId?: number) {
  const key = chainId ? CHAIN_ID_TO_KEY[chainId] : undefined;

  // Prefer explicit chainId. If none, prefer sepolia in prod.
  const k: ChainKey = key ?? "sepolia";

  const consumer =
    (k === "anvil" ? optEnv("VITE_ANVIL_CONSUMER_ADDRESS") : optEnv("VITE_SEPOLIA_CONSUMER_ADDRESS")) as
      | `0x${string}`
      | undefined;

  const forwarder =
    (k === "anvil" ? optEnv("VITE_ANVIL_FORWARDER_ADDRESS") : optEnv("VITE_SEPOLIA_FORWARDER_ADDRESS")) as
      | `0x${string}`
      | undefined;

  const registry =
    (k === "anvil" ? optEnv("VITE_ANVIL_REGISTRY_ADDRESS") : optEnv("VITE_SEPOLIA_REGISTRY_ADDRESS")) as
      | `0x${string}`
      | undefined;

  const rpcUrl = k === "anvil" ? optEnv("VITE_ANVIL_RPC_URL") : optEnv("VITE_SEPOLIA_RPC_URL");

  const factory =
    (k === "anvil" ? optEnv("VITE_ANVIL_FACTORY_ADDRESS") : optEnv("VITE_SEPOLIA_FACTORY_ADDRESS")) as
      | `0x${string}`
      | undefined;

  return { chainKey: k, rpcUrl, consumer, forwarder, registry, factory };
}