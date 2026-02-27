import { useEffect, useMemo, useState } from "react";
import PageWrapper from "../components/PageWrapper";
import AdminSubNav from "../components/AdminSubNav";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { createPublicClient, http, keccak256, toBytes } from "viem";

import { sameAddress } from "../utils/address";
import { AREAS, type Area } from "../constants";
import { getAddresses } from "../contracts/addresses";
import { requestRegistryAbi } from "../contracts/requestRegistry";
import { forwarderAbi } from "../contracts/forwarder";
import { encodeDailyIndexReport, toAreaId } from "../utils/report";

type Status = "None" | "Pending" | "Fulfilled" | "Cancelled" | "Expired";

function statusLabel(n: number): Status {
  switch (n) {
    case 1:
      return "Pending";
    case 2:
      return "Fulfilled";
    case 3:
      return "Cancelled";
    case 4:
      return "Expired";
    default:
      return "None";
  }
}

function prettyDateNum(n: number) {
  const s = String(n);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

type RequestRow = {
  id: bigint;
  indexId: `0x${string}`;
  areaId: `0x${string}`;
  yyyymmdd: number;
  currency: string;
  createdAt: number;
  status: Status;
  value1e6: bigint; // int256 => bigint
  datasetHash: `0x${string}`;
  fulfilledAt: number;
};

export default function AdminRequests() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const owner = 
      chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_OWNER_ADDRESS as string | undefined)
      : (import.meta.env.VITE_ANVIL_OWNER_ADDRESS as string | undefined);

  const isOwner = sameAddress(address, owner);
  
  const { consumer, forwarder, registry } = getAddresses(chainId);

  const rpcUrl =
    chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_RPC_URL as string)
      : (import.meta.env.VITE_ANVIL_RPC_URL as string);

  const client = useMemo(() => createPublicClient({ transport: http(rpcUrl) }), [rpcUrl]);

  // ======= Create request form =======
  const [indexName, setIndexName] = useState("NORDPOOL_DAYAHEAD_AVG_V1");
  const [area, setArea] = useState<Area>("NO1");
  const [dateNum, setDateNum] = useState<number>(20260125);
  const [currency, setCurrency] = useState<string>("EUR");
  const [formErr, setFormErr] = useState<string | null>(null);

  // ======= Requests =======
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setReadErr(null);
    try {
      const next = (await client.readContract({
        address: registry,
        abi: requestRegistryAbi,
        functionName: "nextRequestId",
      })) as bigint;

      const max = 50n;
      const start = next > max ? next - max : 0n;

      const ids: bigint[] = [];
      for (let i = start; i < next; i++) ids.push(i);

      const results = await Promise.all(
        ids.map(async (id) => {
          const r = await client.readContract({
            address: registry,
            abi: requestRegistryAbi,
            functionName: "requests",
            args: [id],
            });

            const [
            indexId,
            areaId,
            yyyymmdd,
            currencyStr,
            createdAt,
            statusN,
            value1e6,
            datasetHash,
            fulfilledAt,
        ] = r as readonly [
            `0x${string}`,
            `0x${string}`,
            number,
            string,
            bigint,
            number,
            bigint,
            `0x${string}`,
            bigint
        ];

          const row: RequestRow = {
            id,
            indexId,
            areaId,
            yyyymmdd: Number(yyyymmdd),
            currency: currencyStr,
            createdAt: Number(createdAt),
            status: statusLabel(Number(statusN)),
            value1e6: value1e6 as bigint,
            datasetHash,
            fulfilledAt: Number(fulfilledAt),
          };
          return row;
        })
      );

      // newest first
      results.sort((a, b) => (a.id > b.id ? -1 : 1));
      setRows(results);
    } catch (e: any) {
      setReadErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, client]);

  // ======= wagmi write =======
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Track a “step” so we can do a simple 2-step fulfill flow.
  const [pendingAfterTx, setPendingAfterTx] = useState<null | {
    kind: "create" | "fulfill" | "cancel";
    requestId?: bigint;
    // fulfill payload
    indexName?: string;
    area?: Area;
    yyyymmdd?: number;
    value1e6?: bigint;
    datasetHash?: `0x${string}`;
  }>(null);

  // When a tx confirms: refresh + possibly run step 2 of fulfillment (forward to consumer)
  useEffect(() => {
    if (!isSuccess) return;

    (async () => {
      await refresh();

      // If the last confirmed action was markFulfilled, do the forward() commit next.
      if (pendingAfterTx?.kind === "fulfill" && pendingAfterTx.requestId != null) {
        const { indexName, area, yyyymmdd, value1e6, datasetHash } = pendingAfterTx;
        if (!indexName || !area || !yyyymmdd || value1e6 == null || !datasetHash) return;

        const report = encodeDailyIndexReport({
          indexName,
          area,
          yyyymmdd,
          value1e6,
          datasetHash,
        });

        setPendingAfterTx(null);

        writeContract({
          address: forwarder,
          abi: forwarderAbi,
          functionName: "forward",
          args: [consumer, "0x", report],
        });
      } else {
        setPendingAfterTx(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  function submitCreateRequest() {
    setFormErr(null);
    try {
      const indexId = keccak256(toBytes(indexName));
      const areaId = toAreaId(area) as `0x${string}`;
      const yyyymmdd = Number(dateNum);
      if (!Number.isFinite(yyyymmdd) || String(yyyymmdd).length !== 8) {
        throw new Error("yyyymmdd must be like 20260125");
      }

      setPendingAfterTx({ kind: "create" });

      writeContract({
        address: registry,
        abi: requestRegistryAbi,
        functionName: "createRequest",
        args: [indexId, areaId, yyyymmdd, currency],
      });
    } catch (e: any) {
      setFormErr(e?.message ?? String(e));
    }
  }

  // Deterministic local stub generator (great for Anvil demos)
  function stubFor(area: Area, yyyymmdd: number) {
    // simple deterministic “pseudo-price”: base + area offset + date wobble
    const areaOffset = BigInt((AREAS.indexOf(area) + 1) * 100_000); // 0.1 EUR steps
    const wobble = BigInt((yyyymmdd % 97) * 12_345); // tiny wobble
    const value1e6 = 40_000_000n + areaOffset + wobble; // ~40 EUR/MWh baseline
    const datasetHash = keccak256(
      toBytes(`stub|${indexName}|${area}|${yyyymmdd}|${value1e6.toString()}`)
    ) as `0x${string}`;
    return { value1e6, datasetHash };
  }

  function fulfillStub(r: RequestRow) {
    setFormErr(null);
    try {
      if (r.status !== "Pending") throw new Error("Request is not pending.");

      // NOTE: we don’t store indexName on-chain in registry, only indexId.
      const yyyymmdd = r.yyyymmdd;
      const { value1e6, datasetHash } = stubFor(area, yyyymmdd);

      // Step 1: markFulfilled
      setPendingAfterTx({
        kind: "fulfill",
        requestId: r.id,
        indexName,
        area,
        yyyymmdd,
        value1e6,
        datasetHash,
      });

      writeContract({
        address: registry,
        abi: requestRegistryAbi,
        functionName: "markFulfilled",
        args: [r.id, value1e6, datasetHash],
      });
    } catch (e: any) {
      setFormErr(e?.message ?? String(e));
    }
  }

  function cancelRequest(r: RequestRow) {
    setFormErr(null);
    try {
      if (r.status !== "Pending") throw new Error("Only pending requests can be cancelled.");

      setPendingAfterTx({ kind: "cancel" });

      writeContract({
        address: registry,
        abi: requestRegistryAbi,
        functionName: "cancelRequest",
        args: [r.id],
      });
    } catch (e: any) {
      setFormErr(e?.message ?? String(e));
    }
  }

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
            <p className="font-medium text-gray-900 dark:text-gray-100">Connect wallet to access admin.</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Only the owner address can view this page.</p>
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
  if (chainId !== 31337) {
    return (
      <PageWrapper title="Admin" subtitle="Local only">
        <AdminSubNav />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Requests are only available on Anvil. On Sepolia, the index is published by the cron workflow.
          </p>
        </div>
      </PageWrapper>
    );
  }
  return (
    <PageWrapper title="Admin" subtitle="Requests → Fulfill → Commit">
      <AdminSubNav />

      {/* Create Request */}
      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create request</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          This creates an on-chain request that the workflow should fulfill (demo: we can stub-fulfill locally).
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">indexName</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Area</div>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
            >
              {AREAS.map((a) => (
                <option key={a} value={a} className="bg-white dark:bg-gray-900">
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">yyyymmdd</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={dateNum}
              onChange={(e) => setDateNum(Number(e.target.value))}
              inputMode="numeric"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{prettyDateNum(dateNum)}</div>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">currency</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </label>
        </div>

        {formErr && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">{formErr}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={submitCreateRequest}
            disabled={isPending || isConfirming}
            className="
              rounded-xl px-4 py-2 text-sm font-medium shadow-sm
              bg-gray-900 text-white hover:bg-gray-800
              dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
              disabled:opacity-60
            "
          >
            {isPending ? "Wallet…" : isConfirming ? "Confirming…" : "Create request"}
          </button>

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

          {isSuccess && txHash && (
            <span className="text-sm text-green-700 dark:text-green-400 font-mono">
              tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </span>
          )}
        </div>
      </section>

      {/* Requests table */}
      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Requests</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            chainId: {chainId} • registry: {registry.slice(0, 10)}…{registry.slice(-8)}
          </span>
        </div>

        {readErr && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">{readErr}</p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-4 font-medium">id</th>
                <th className="py-2 pr-4 font-medium">yyyymmdd</th>
                <th className="py-2 pr-4 font-medium">status</th>
                <th className="py-2 pr-4 font-medium">value</th>
                <th className="py-2 pr-4 font-medium">datasetHash</th>
                <th className="py-2 pr-4 font-medium">actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id.toString()} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 font-mono">{r.id.toString()}</td>
                  <td className="py-2 pr-4 font-mono">{r.yyyymmdd}</td>
                  <td className="py-2 pr-4">{r.status}</td>
                  <td className="py-2 pr-4 font-mono">
                    {r.status === "Fulfilled" ? `${(r.value1e6 / 1_000_000n).toString()}…` : "—"}
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {r.datasetHash && r.datasetHash !== ("0x" + "0".repeat(64) as any)
                      ? `${r.datasetHash.slice(0, 10)}…${r.datasetHash.slice(-8)}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fulfillStub(r)}
                        disabled={isPending || isConfirming || r.status !== "Pending"}
                        className="
                          rounded-lg px-3 py-1.5 text-sm font-medium
                          bg-gray-900 text-white hover:bg-gray-800
                          dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
                          disabled:opacity-60
                        "
                        title="Marks fulfilled and commits to consumer (demo stub)."
                      >
                        Fulfill (stub)
                      </button>

                      <button
                        onClick={() => cancelRequest(r)}
                        disabled={isPending || isConfirming || r.status !== "Pending"}
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
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500 dark:text-gray-400" colSpan={6}>
                    No requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
          consumer: {consumer} <br />
          forwarder: {forwarder}
        </div>
      </section>
    </PageWrapper>
  );
}
