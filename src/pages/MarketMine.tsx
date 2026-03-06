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
  consumer: `0x${string}`;
  seller: `0x${string}`;
  indexId: `0x${string}`;
  areaId: `0x${string}`;
  yyyymmdd: number;
  strike1e6: bigint;
  direction: number;
  premiumWei: bigint;
  payoutWei: bigint;
  buyDeadline: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;

  buyer?: `0x${string}`;
  cancelled?: boolean;
  settled?: boolean;

  // derived (from Settled event)
  settledWinner?: `0x${string}`;
  settledIndexValue1e6?: bigint;
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

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function getLogsChunked(args: {
  client: ReturnType<typeof createPublicClient>;
  address: `0x${string}`;
  event: any; // parseAbiItem(...)
  args?: Record<string, any>;
  fromBlock: bigint;
  toBlock: bigint;
  maxRange?: bigint; // default 49_000
}) {
  const { client, address, event } = args;
  const maxRange = args.maxRange ?? 49_000n;

  const out: any[] = [];
  let start = args.fromBlock;

  while (start <= args.toBlock) {
    const end = start + maxRange;
    const chunkTo = end > args.toBlock ? args.toBlock : end;

    const chunk = await client.getLogs({
      address,
      event,
      args: args.args,
      fromBlock: start,
      toBlock: chunkTo,
    });

    out.push(...chunk);
    start = chunkTo + 1n;
  }

  return out;
}

export default function MarketMine() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { rpcUrl, factory } = getAddresses(chainId);
  if (!rpcUrl) {
    return (
      <PageWrapper title="Market" subtitle="My positions">
        <MarketSubNav />
        <p className="text-sm text-red-600 dark:text-red-400">
          Missing RPC URL for this chain (check env vars).
        </p>
      </PageWrapper>
    );
  }

  const client = useMemo(() => createPublicClient({ transport: http(rpcUrl) }), [rpcUrl]);

  const [all, setAll] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const FROM_BLOCK = chainId === 11155111 ? 10329331n : 0n; // Factory deployed



  async function fetchAll() {
    setLoading(true);
    setReadErr(null);
    if (!factory) throw new Error("Missing factory address for this chain.");

    try {
      const evtCreated = parseAbiItem(
        "event OptionCreated(address indexed option,address indexed consumer,address indexed seller,bytes32 indexId,bytes32 areaId,uint32 yyyymmdd,int256 strike1e6,uint8 direction,uint256 premiumWei,uint256 payoutWei,uint64 buyDeadline)"
      );

      const latestBlock = await client.getBlockNumber();

      const logs = await getLogsChunked({
        client,
        address: factory,
        event: evtCreated,
        fromBlock: FROM_BLOCK,
        toBlock: latestBlock,
        maxRange: 49_000n,
      });

      const base: OptionRow[] = logs.map((l) => {
        const a = l.args!;
        return {
          option: a.option as `0x${string}`,
          consumer: a.consumer as `0x${string}`,
          seller: a.seller as `0x${string}`,
          indexId: a.indexId as `0x${string}`,
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

            let settledWinner: `0x${string}` | undefined;
            let settledIndexValue1e6: bigint | undefined;

            if (settled) {
              const evtSettled = parseAbiItem(
                "event Settled(address indexed winner,int256 indexValue1e6,bytes32 datasetHash,uint256 payoutWei)"
              );

              const latestBlock2 = await client.getBlockNumber();

              const settledLogs = await getLogsChunked({
                client,
                address: r.option,
                event: evtSettled,
                fromBlock: r.blockNumber,
                toBlock: latestBlock2,
                maxRange: 49_000n,
              });

              const last = settledLogs[settledLogs.length - 1];
              if (last?.args) {
                settledWinner = last.args.winner as `0x${string}`;
                settledIndexValue1e6 = last.args.indexValue1e6 as bigint;
              }
            }

            return { ...r, buyer, cancelled, settled, settledWinner, settledIndexValue1e6 };
          } catch {
            return r;
          }
        })
      );

      setAll(enriched);
    } catch (e: any) {
      setReadErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, factory]);

  useEffect(() => {
    if (!isSuccess) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  function cancel(o: OptionRow) {
    writeContract({ address: o.option, abi: northpoleOptionAbi, functionName: "cancel", args: [] });
  }
  function settle(o: OptionRow) {
    writeContract({ address: o.option, abi: northpoleOptionAbi, functionName: "settle", args: [] });
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const me = (address ?? "").toLowerCase();

  const mine = all.filter((o) => {
    const buyer = (o.buyer ?? ZERO).toLowerCase();
    return o.seller.toLowerCase() === me || buyer === me;
  });

  const active = mine.filter((o) => {
    const buyer = (o.buyer ?? ZERO).toLowerCase();
    const cancelled = !!o.cancelled;
    const settled = !!o.settled;
    const deadlinePassed = nowSec >= o.buyDeadline;

    const expiredUnsold = buyer === ZERO.toLowerCase() && deadlinePassed;
    return !cancelled && !settled && !expiredUnsold;
  });

  const history = mine.filter((o) => {
    const buyer = (o.buyer ?? ZERO).toLowerCase();
    const cancelled = !!o.cancelled;
    const settled = !!o.settled;
    const deadlinePassed = nowSec >= o.buyDeadline;
    const expiredUnsold = buyer === ZERO && deadlinePassed && !settled && !cancelled;
    return cancelled || settled || expiredUnsold;
  });

  if (!isConnected) {
    return (
      <PageWrapper title="Market" subtitle="My positions">
        <MarketSubNav />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Connect wallet to see your positions.</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Browsing is available without connecting.</p>
          </div>
          <ConnectButton />
        </div>
      </PageWrapper>
    );
  }

  const ActiveTable = ({ rows }: { rows: OptionRow[] }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-600 dark:text-gray-300">
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="py-2 pr-4 font-medium">option</th>
            <th className="py-2 pr-4 font-medium">role</th>
            <th className="py-2 pr-4 font-medium">area</th>
            <th className="py-2 pr-4 font-medium">date</th>
            <th className="py-2 pr-4 font-medium">dir</th>
            <th className="py-2 pr-4 font-medium">strike</th>
            <th className="py-2 pr-4 font-medium">premium</th>
            <th className="py-2 pr-4 font-medium">payout</th>
            <th className="py-2 pr-4 font-medium">status</th>
            <th className="py-2 pr-4 font-medium">actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const area = areaFromId(o.areaId);
            const dir = o.direction === 0 ? "≥" : "<";

            const buyer = (o.buyer ?? ZERO) as `0x${string}`;
            const cancelled = !!o.cancelled;
            const settled = !!o.settled;
            const deadlinePassed = nowSec >= o.buyDeadline;

            const buyerLc = buyer.toLowerCase();
            const isSeller = o.seller.toLowerCase() === me;
            const isBuyer = buyerLc === me;
            const role = isSeller ? "Seller" : isBuyer ? "Buyer" : "—";

            let status = "Open";
            if (cancelled) status = "Cancelled";
            else if (settled) status = "Settled";
            else if (buyer !== ZERO) status = `Purchased (${shortAddr(buyer)})`;
            else if (deadlinePassed) status = "Expired";

            const canCancel = isSeller && buyerLc === ZERO.toLowerCase() && !cancelled && !settled;
            const canSettle = buyerLc !== ZERO.toLowerCase() && !cancelled && !settled;

            return (
              <tr key={o.txHash} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-4 font-mono">
                  {o.option.slice(0, 10)}…{o.option.slice(-8)}
                </td>
                <td className="py-2 pr-4">{role}</td>
                <td className="py-2 pr-4">{area ?? "?"}</td>
                <td className="py-2 pr-4 font-mono">{prettyDateNum(o.yyyymmdd)}</td>
                <td className="py-2 pr-4">{dir}</td>
                <td className="py-2 pr-4 font-mono">{formatUnits(o.strike1e6, 6)}</td>
                <td className="py-2 pr-4 font-mono">{formatEther(o.premiumWei)}</td>
                <td className="py-2 pr-4 font-mono">{formatEther(o.payoutWei)}</td>
                <td className="py-2 pr-4">{status}</td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => settle(o)}
                      disabled={!canSettle || isPending || isConfirming}
                      className="
                        rounded-lg px-3 py-1.5 text-sm font-medium
                        border border-gray-200 dark:border-gray-800
                        text-gray-900 dark:text-gray-100
                        hover:bg-gray-100 dark:hover:bg-gray-800
                        disabled:opacity-60
                      "
                    >
                      Settle
                    </button>
                    <button
                      onClick={() => cancel(o)}
                      disabled={!canCancel || isPending || isConfirming}
                      className="
                        rounded-lg px-3 py-1.5 text-sm font-medium
                        border border-gray-200 dark:border-gray-800
                        text-gray-900 dark:text-gray-100
                        hover:bg-gray-100 dark:hover:bg-gray-800
                        disabled:opacity-60
                      "
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-gray-500 dark:text-gray-400" colSpan={9}>
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const HistoryTable = ({ rows }: { rows: OptionRow[] }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-600 dark:text-gray-300">
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="py-2 pr-4 font-medium">option</th>
            <th className="py-2 pr-4 font-medium">area</th>
            <th className="py-2 pr-4 font-medium">date</th>
            <th className="py-2 pr-4 font-medium">dir</th>
            <th className="py-2 pr-4 font-medium">strike</th>
            <th className="py-2 pr-4 font-medium">premium</th>
            <th className="py-2 pr-4 font-medium">payout</th>
            <th className="py-2 pr-4 font-medium">result</th>
            <th className="py-2 pr-4 font-medium">reported</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const area = areaFromId(o.areaId);
            const dir = o.direction === 0 ? "≥" : "<";

            const buyer = (o.buyer ?? ZERO).toLowerCase();
            const cancelled = !!o.cancelled;
            const settled = !!o.settled;
            const deadlinePassed = nowSec >= o.buyDeadline;

            const iAmSeller = o.seller.toLowerCase() === me;
            const iAmBuyer = buyer === me;

            let result = "—";
            let resultClass = "text-gray-600 dark:text-gray-300";

            if (cancelled) {
              result = "Cancelled";
            } else if (!settled && buyer === ZERO.toLowerCase() && deadlinePassed) {
              result = "Expired";
            } else if (settled && o.settledWinner) {
              const winner = o.settledWinner.toLowerCase();
              const won =
                (iAmBuyer && winner === buyer) ||
                (iAmSeller && winner === o.seller.toLowerCase());

              result = won ? "Won" : "Lost";
              resultClass = won
                ? "text-green-700 dark:text-green-400 font-medium"
                : "text-red-700 dark:text-red-400 font-medium";
            }

            const reported =
              o.settledIndexValue1e6 !== undefined ? formatUnits(o.settledIndexValue1e6, 6) : "—";

            return (
              <tr key={o.txHash} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-4 font-mono">
                  {o.option.slice(0, 10)}…{o.option.slice(-8)}
                </td>
                <td className="py-2 pr-4">{area ?? "?"}</td>
                <td className="py-2 pr-4 font-mono">{prettyDateNum(o.yyyymmdd)}</td>
                <td className="py-2 pr-4">{dir}</td>
                <td className="py-2 pr-4 font-mono">{formatUnits(o.strike1e6, 6)}</td>
                <td className="py-2 pr-4 font-mono">{formatEther(o.premiumWei)}</td>
                <td className="py-2 pr-4 font-mono">{formatEther(o.payoutWei)}</td>
                <td className={`py-2 pr-4 ${resultClass}`}>{result}</td>
                <td className="py-2 pr-4 font-mono">{reported}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-gray-500 dark:text-gray-400" colSpan={9}>
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <PageWrapper title="Market" subtitle="My positions">
      <MarketSubNav />

      {readErr && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">{readErr}</p>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <button
          onClick={fetchAll}
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

      <section className="mt-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active</h2>
        <ActiveTable rows={active} />
      </section>

      <section className="mt-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">History</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Settled rows show <span className="font-medium">Won/Lost</span> and the reported PowerIndex value.
        </p>
        <HistoryTable rows={history} />
      </section>
    </PageWrapper>
  );
}