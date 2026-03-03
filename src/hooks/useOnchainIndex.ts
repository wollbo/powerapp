import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId } from "wagmi";
import { dailyIndexConsumerAbi } from "../contracts/dailyIndexConsumer";
import { CONTRACTS } from "../config/contracts";
import { isSupportedChainId, SEPOLIA } from "../config/chains";
import { keccak256, toBytes } from "viem";

export type NormalizedPoint = {
  dateNum: number;
  dateISO: string;
  value: number; // EUR/MW
};

function isoToDateNum(iso: string): number {
  return Number(iso.replaceAll("-", ""));
}

function addDaysUtcISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayUtcISO(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function indexId(indexName: string) {
  return keccak256(toBytes(indexName));
}

function areaId(area: string) {
  return keccak256(toBytes(area));
}

export function useOnchainIndexHistory(area: string, indexName = "NORDPOOL_DAYAHEAD_VWAP_V1", days = 90) {
  const chainId = useChainId();
  const client = usePublicClient();

  return useQuery({
    queryKey: ["onchain-index-history", chainId, area, indexName, days],
    enabled: !!client && isSupportedChainId(chainId) && chainId === SEPOLIA.id,
    queryFn: async (): Promise<NormalizedPoint[]> => {
      if (!client) throw new Error("No public client");
      if (!isSupportedChainId(chainId)) throw new Error(`Unsupported chain: ${chainId}`);

      const consumer = CONTRACTS[chainId].consumer;
      if (!consumer || consumer === "0x0000000000000000000000000000000000000000") {
        throw new Error("Missing Sepolia consumer address (VITE_SEPOLIA_CONSUMER_ADDRESS)");
      }

      const idx = indexId(indexName);
      const aId = areaId(area);

      const end = addDaysUtcISO(todayUtcISO(), 1);
      const start = addDaysUtcISO(end, -(days - 1));

      const points: NormalizedPoint[] = [];

      let cursor = start;
      for (let i = 0; i < days; i++) {
        const dateNum = isoToDateNum(cursor);

        const res = await client.readContract({
          address: consumer,
          abi: dailyIndexConsumerAbi,
          functionName: "commitments",
          args: [idx, aId, dateNum],
        });

        const [datasetHash, value1e6, , reportedAt] = res;
        if (reportedAt !== 0n && datasetHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          points.push({
            dateNum,
            dateISO: cursor,
            value: Number(value1e6) / 1_000_000,
          });
        }

        cursor = addDaysUtcISO(cursor, 1);
      }

      return points.sort((a, b) => a.dateNum - b.dateNum);
    },
    staleTime: 30_000,
  });
}