import { useEffect, useMemo, useState } from "react";
import PageWrapper from "../components/PageWrapper";
import MarketSubNav from "../components/MarketSubNav";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { createPublicClient, formatEther, formatUnits, http, parseAbiItem } from "viem";

import { getAddresses } from "../contracts/addresses";
import { northpoleOptionAbi } from "../contracts/northpoleOption";
import { AREAS, type Area } from "../constants";
import { toAreaId } from "../utils/report";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

type OptionRow = {
  option: `0x${string}`;
  seller: `0x${string}`;
  areaId: `0x${string}`;
  yyyymmdd: number;
  strike1e6: bigint;
  direction: number; // 0 AboveOrEqual, 1 Below
  premiumWei: bigint;
  payoutWei: bigint;
  buyDeadline: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;

  buyer?: `0x${string}`;
  cancelled?: boolean;
  settled?: boolean;
};

function areaFromId(areaId: `0x${string}`): Area | null {
  for (const a of AREAS) {
    if ((toAreaId(a) as string).toLowerCase() === areaId.toLowerCase()) return a;
  }
  return null;
}

function prettyDateNum(n: number) {
  const s = String(n);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Strike/index values are 1e6-scaled “EUR/MW”
function formatEurMw1e6(v: bigint) {
  // 2 decimals, but keep correct rounding by formatting to 6 then trimming
  const s = formatUnits(v, 6); // e.g. "40.123456"
  const [i, d = ""] = s.split(".");
  return `${i}.${(d + "00").slice(0, 2)}`; // "40.12"
}

function tsToUtc(ts: bigint) {
  const ms = Number(ts) * 1000;
  if (!Number.isFinite(ms)) return ts.toString();
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

export default function MarketBrowse() {
  const { address, isConnected } = useAccount();
  const me = (address ?? "").toLowerCase();

  const chainId = useChainId();
  const { rpcUrl, factory } = getAddresses(chainId);

  const client = useMemo(() => createPublicClient({ transport: http(rpcUrl) }), [rpcUrl]);

  const [rows, setRows] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const FROM_BLOCK = chainId === 11155111 ? 10329331n : 0n; // Factory deployed


  async function refresh() {
    setLoading(true);
    setReadErr(null);

    try {
      const logs = await client.getLogs({
        address: factory,
        event: parseAbiItem(
          "event OptionCreated(address indexed option,address indexed consumer,address indexed seller,bytes32 indexId,bytes32 areaId,uint32 yyyymmdd,int256 strike1e6,uint8 direction,uint256 premiumWei,uint256 payoutWei,uint64 buyDeadline)"
        ),
        fromBlock: FROM_BLOCK,
        toBlock: "latest",
      });

      const base: OptionRow[] = logs.map((l) => {
        const a = l.args!;
        return {
          option: a.option as `0x${string}`,
          seller: a.seller as `0x${string}`,
          areaId: a.areaId as `0x${string}`,
          yyyymmdd: Number(a.yyyymmdd),
          strike1e6: a.strike1e6 as bigint,
          direction: Number(a.direction),
          premiumWei: a.premiumWei as bigint,
          payoutWei: a.payoutWei as bigint,
          buyDeadline: BigInt(a.buyDeadline as any),
          blockNumber: l.blockNumber!,
          txHash: l.transactionHash as `0x${string}`,
        };
      });

      base.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));

      const enriched = await Promise.all(
        base.map(async (r) => {
          try {
            const [buyer, cancelled, settled] = await Promise.all([
              client.readContract({ address: r.option, abi: northpoleOptionAbi, functionName: "buyer" }) as Promise<
                `0x${string}`
              >,
              client.readContract({ address: r.option, abi: northpoleOptionAbi, functionName: "cancelled" }) as Promise<
                boolean
              >,
              client.readContract({ address: r.option, abi: northpoleOptionAbi, functionName: "settled" }) as Promise<
                boolean
              >,
            ]);

            return { ...r, buyer, cancelled, settled };
          } catch {
            return r;
          }
        })
      );

      const nowSec = BigInt(Math.floor(Date.now() / 1000));

      const openBuyable = enriched.filter((o) => {
        const buyer = (o.buyer ?? ZERO).toLowerCase();
        const deadlinePassed = nowSec >= o.buyDeadline;

        const isOpen =
          buyer === ZERO.toLowerCase() && !o.cancelled && !o.settled && !deadlinePassed;

        const notMine = me ? o.seller.toLowerCase() !== me : true;

        return isOpen && notMine;
      });

      setRows(openBuyable);
    } catch (e: any) {
      setReadErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, factory, me]);

  useEffect(() => {
    if (!isSuccess) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  function buy(o: OptionRow) {
    writeContract({
      address: o.option,
      abi: northpoleOptionAbi,
      functionName: "buy",
      args: [],
      value: o.premiumWei,
    });
  }

  return (
    <PageWrapper title="Market" subtitle="Browse (open listings)">
      <MarketSubNav />

      {!isConnected && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">Connect wallet to buy.</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">You can browse without connecting.</div>
          </div>
          <ConnectButton />
        </section>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Open listings</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Strike is shown in <span className="font-medium">EUR/MW</span> (2 decimals).
            </p>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono text-right">
            chainId: {chainId} <br />
            {rows.length} open
          </div>
        </div>

        {readErr && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">{readErr}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="
              rounded-xl px-4 py-2 text-sm font-medium
              border border-gray-200 dark:border-gray-800
              text-gray-900 dark:text-gray-100
              hover:bg-gray-100 dark:hover:bg-gray-800
              disabled:opacity-60
            "
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          {txHash && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}{" "}
              {isPending ? "(wallet…)" : isConfirming ? "(confirming…)" : ""}
            </span>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-4 font-medium">area</th>
                <th className="py-2 pr-4 font-medium">date</th>
                <th className="py-2 pr-4 font-medium">dir</th>
                <th className="py-2 pr-4 font-medium">strike (EUR/MW)</th>
                <th className="py-2 pr-4 font-medium">premium (ETH)</th>
                <th className="py-2 pr-4 font-medium">payout (ETH)</th>
                <th className="py-2 pr-4 font-medium">buy deadline (UTC)</th>
                <th className="py-2 pr-4 font-medium">buy</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((o) => {
                const area = areaFromId(o.areaId);
                const dir = o.direction === 0 ? "≥" : "<";

                const canBuy = isConnected && !isPending && !isConfirming;

                return (
                  <tr key={o.txHash} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4">{area ?? "?"}</td>
                    <td className="py-2 pr-4 font-mono">{prettyDateNum(o.yyyymmdd)}</td>
                    <td className="py-2 pr-4">{dir}</td>
                    <td className="py-2 pr-4 font-mono">{formatEurMw1e6(o.strike1e6)}</td>
                    <td className="py-2 pr-4 font-mono">{formatEther(o.premiumWei)}</td>
                    <td className="py-2 pr-4 font-mono">{formatEther(o.payoutWei)}</td>
                    <td className="py-2 pr-4 font-mono">
                      {o.buyDeadline.toString()}
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tsToUtc(o.buyDeadline)}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => buy(o)}
                        disabled={!canBuy}
                        className="
                          rounded-lg px-3 py-1.5 text-sm font-medium
                          bg-gray-900 text-white hover:bg-gray-800
                          dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
                          disabled:opacity-60
                        "
                      >
                        Buy
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500 dark:text-gray-400" colSpan={8}>
                    No open listings right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Browse shows only open listings and hides your own options. Cancel/manage positions in “My positions”.
        </div>
      </section>
    </PageWrapper>
  );
}