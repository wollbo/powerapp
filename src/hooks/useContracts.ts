// src/hooks/useContracts.ts
import { useChainId } from "wagmi";
import { CONTRACTS } from "../config/contracts";
import { isSupportedChainId } from "../config/chains";

export function useContracts() {
  const chainId = useChainId();
  if (!isSupportedChainId(chainId)) return { chainId, contracts: null as any };
  return { chainId, contracts: CONTRACTS[chainId] };
}
