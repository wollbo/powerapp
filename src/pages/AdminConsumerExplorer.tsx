import { useEffect, useMemo, useState } from "react";
import PageWrapper from "../components/PageWrapper";
import AdminSubNav from "../components/AdminSubNav";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createPublicClient, formatUnits, http, parseAbiItem, keccak256, toBytes } from "viem";

import { sameAddress } from "../utils/address";
import { AREAS, type Area } from "../constants";
import { getAddresses } from "../contracts/addresses";
import { toAreaId } from "../utils/report";


type Row = {
  indexId: `0x${string}`;   // add
  yyyymmdd: number;
  value1e6: bigint; // int256 in solidity => bigint in TS
  reporter: `0x${string}`;
  reportedAt: bigint;
  datasetHash: `0x${string}`;
  areaId: `0x${string}`;
};

const INDEXES = [
  "NORDPOOL_DAYAHEAD_AVG_V1",
  "NORDPOOL_DAYAHEAD_VWAP_V1",
] as const;

type IndexName = (typeof INDEXES)[number];

async function getLogsChunked(args: {
  client: ReturnType<typeof createPublicClient>;
  address: `0x${string}`;
  event: any; // parseAbiItem(...)
  // args is optional; only indexed fields are used for filtering
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


export default function AdminConsumerExplorer() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const owner = 
      chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_OWNER_ADDRESS as string | undefined)
      : (import.meta.env.VITE_ANVIL_OWNER_ADDRESS as string | undefined);
  const isOwner = !!owner && sameAddress(address, owner);

  const [indexName, setIndexName] = useState<IndexName>("NORDPOOL_DAYAHEAD_VWAP_V1");
  const indexId = useMemo(() => keccak256(toBytes(indexName)) as `0x${string}`, [indexName]);

  const { consumer: consumerAddress, forwarder: forwarderAddress } = getAddresses(chainId);

  const rpcUrl =
    chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_RPC_URL as string)
      : (import.meta.env.VITE_ANVIL_RPC_URL as string);

  const [area, setArea] = useState<Area>("NO1");
  const areaId = useMemo(() => toAreaId(area) as `0x${string}`, [area]);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const client = useMemo(
    () =>
      createPublicClient({
        transport: http(rpcUrl),
      }),
    [rpcUrl]
  );

  const FROM_BLOCK = chainId === 11155111 ? 10320208n : 0n; // Consumer deployed
  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const evt = parseAbiItem(
        "event DailyIndexCommitted(bytes32 indexed indexId, bytes32 indexed areaId, uint32 indexed yyyymmdd, int256 value1e6, bytes32 datasetHash, address reporter, uint64 reportedAt)"
      );

      // Guard: address must exist
      if (!consumerAddress) {
        setError("Missing consumer address for this chain (check Vercel env vars).");
        setLoading(false);
        return;
      }

      const latestBlock = await client.getBlockNumber();

      const logs = await getLogsChunked({
        client,
        address: consumerAddress,
        event: evt,
        // Filter by indexed fields:
        args: { indexId, areaId },
        fromBlock: FROM_BLOCK,
        toBlock: latestBlock,
        maxRange: 49_000n,
      });

      const mapped: Row[] = logs.map((l) => {
        const a = l.args!;
        return {
          indexId: a.indexId as `0x${string}`,
          yyyymmdd: Number(a.yyyymmdd),
          value1e6: a.value1e6 as bigint,
          reporter: a.reporter as `0x${string}`,
          reportedAt: a.reportedAt as bigint,
          datasetHash: a.datasetHash as `0x${string}`,
          areaId: a.areaId as `0x${string}`,
        };
      });

      const filtered = mapped.sort((a, b) => b.yyyymmdd - a.yyyymmdd);

      setRows(filtered.slice(0, 50));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexId, areaId, consumerAddress, client]);

  // ======= Owner gating =======
  if (!owner) {
    return (
      <PageWrapper title="Admin" subtitle="Owner-gated">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-red-600 dark:text-red-400">
            Missing VITE_OWNER_ADDRESS. Add it to your .env and restart dev server.
          </p>
        </div>
      </PageWrapper>
    );
  }

  if (!isConnected) {
    return (
      <PageWrapper title="Admin" subtitle="Owner-gated">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Connect wallet to access admin.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Only the owner address can view this page.
            </p>
          </div>
          <ConnectButton />
        </div>
      </PageWrapper>
    );
  }

  if (!isOwner) {
    return (
      <PageWrapper title="Admin" subtitle="Owner-gated">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="font-medium text-gray-900 dark:text-gray-100">Access denied.</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Connected: <span className="font-mono">{address}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Owner: <span className="font-mono">{owner}</span>
          </p>
        </div>
      </PageWrapper>
    );
  }

  const latest = rows[0];

  return (
    <PageWrapper title="Admin" subtitle="On-chain commitments (Forwarder → Consumer)">
      <AdminSubNav />

      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Area
            </label>
            <select
              className="mt-1 w-full sm:w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
            >
              {AREAS.map((a) => (
                <option key={a} value={a} className="bg-white dark:bg-gray-900">
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Index 
            </label>
            <select
              className="mt-1 w-full sm:w-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value as IndexName)}
            >
              {INDEXES.map((n) => (
                <option key={n} value={n} className="bg-white dark:bg-gray-900">
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:ml-auto flex items-center gap-2">
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
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
          chainId: {chainId} <br />
          consumer: {consumerAddress} <br />
          {chainId === 31337 && <>forwarder: {forwarderAddress}<br /></>}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
            {error}
          </p>
        )}

        {!error && !latest && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            No commits found for {area}.
          </p>
        )}

        {latest && (
          <div className="mt-6 grid gap-6">
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Latest</h2>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-300">Date</span>
                  <span className="font-mono">{latest.yyyymmdd}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-300">Index ID</span>
                  <span className="font-mono">{latest.indexId}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-300">Value (EUR/MWh)</span>
                  <span className="font-mono">{formatUnits(latest.value1e6, 6)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-300">Reporter</span>
                  <span className="font-mono">{latest.reporter}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-gray-600 dark:text-gray-300">datasetHash</div>
                  <div className="font-mono break-all">{latest.datasetHash}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Recent history
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">{rows.length} rows</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-600 dark:text-gray-300">
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="py-2 pr-4 font-medium">yyyymmdd</th>
                        <th className="py-2 pr-4 font-medium">indexID</th>
                      <th className="py-2 pr-4 font-medium">value</th>
                      <th className="py-2 pr-4 font-medium">datasetHash</th>
                      <th className="py-2 pr-4 font-medium">reporter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={`${r.yyyymmdd}-${r.datasetHash}`}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 pr-4 font-mono">{r.yyyymmdd}</td>
                        <td className="py-2 pr-4 font-mono">{r.indexId}</td>
                        <td className="py-2 pr-4 font-mono">{formatUnits(r.value1e6, 6)}</td>
                        <td className="py-2 pr-4 font-mono">
                          {r.datasetHash.slice(0, 10)}…{r.datasetHash.slice(-8)}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {r.reporter.slice(0, 6)}…{r.reporter.slice(-4)}
                        </td>
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td className="py-4 text-gray-500 dark:text-gray-400" colSpan={5}>
                          No history for {area} yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </PageWrapper>
  );
}
