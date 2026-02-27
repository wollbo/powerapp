import { parseAbi } from "viem";

export const forwarderAbi = parseAbi([
  "function forward(address consumer, bytes metadata, bytes report) external",
]);
