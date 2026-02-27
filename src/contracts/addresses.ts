export type ChainKey = "anvil" | "sepolia";

export const CHAIN_ID_TO_KEY: Record<number, ChainKey> = {
  31337: "anvil",
  11155111: "sepolia",
};

function mustEnv(name: string) {
  const v = import.meta.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v as string;
}

export function getAddresses(chainId?: number) {
  const key = chainId ? CHAIN_ID_TO_KEY[chainId] : undefined;

  // default to anvil if not connected yet
  const k: ChainKey = key ?? "anvil";

  const consumer =
    (k === "anvil"
      ? mustEnv("VITE_ANVIL_CONSUMER_ADDRESS")
      : mustEnv("VITE_SEPOLIA_CONSUMER_ADDRESS")) as `0x${string}`;

  const forwarder =
    (k === "anvil"
      ? mustEnv("VITE_ANVIL_FORWARDER_ADDRESS")
      : mustEnv("VITE_SEPOLIA_FORWARDER_ADDRESS")) as `0x${string}`;

  const registry =
    (k === "anvil"
      ? mustEnv("VITE_ANVIL_REGISTRY_ADDRESS")
      : mustEnv("VITE_SEPOLIA_REGISTRY_ADDRESS")) as `0x${string}`;

  // Optional: helps ensure reads use the connected chain’s RPC
  const rpcUrl =
    (k === "anvil"
      ? mustEnv("VITE_ANVIL_RPC_URL")
      : mustEnv("VITE_SEPOLIA_RPC_URL"));
      
  const factory =
    (k === "anvil"
        ? mustEnv("VITE_ANVIL_FACTORY_ADDRESS")
        : mustEnv("VITE_SEPOLIA_FACTORY_ADDRESS")) as `0x${string}`;

  return { chainKey: k, rpcUrl, consumer, forwarder, registry, factory }
}
