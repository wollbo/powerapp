import { keccak256, stringToBytes } from "viem";

export function areaToAreaId(area: string) {
  return keccak256(stringToBytes(area));
}
