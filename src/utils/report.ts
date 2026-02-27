import { encodeAbiParameters, keccak256, parseAbiParameters, toBytes } from "viem";

export function toIndexId(indexName: string) {
  return keccak256(toBytes(indexName));
}

export function toAreaId(area: string) {
  return keccak256(toBytes(area));
}

export function normalizeBytes32(input: string): `0x${string}` {
  const s = input.trim();

  // allow "abcd..." (64 hex) or "0xabcd..."
  const hex = s.startsWith("0x") ? s : `0x${s}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("datasetHash must be 32 bytes hex (64 hex chars), with or without 0x");
  }
  return hex as `0x${string}`;
}

export function encodeDailyIndexReport(args: {
  indexName: string;
  area: string;
  yyyymmdd: number;
  value1e6: bigint; // can be negative
  datasetHash: `0x${string}`;
}) {
  const indexId = toIndexId(args.indexName);
  const areaId = toAreaId(args.area);

  return encodeAbiParameters(
    parseAbiParameters("bytes32, uint32, bytes32, int256, bytes32"),
    [indexId, args.yyyymmdd, areaId, args.value1e6, args.datasetHash]
  );
}
