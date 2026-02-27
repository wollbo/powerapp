import { useMemo, useState } from "react";
import PageWrapper from "../components/PageWrapper";
import AdminSubNav from "../components/AdminSubNav";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";

import { sameAddress } from "../utils/address";
import { AREAS, type Area } from "../constants";
import { getAddresses } from "../contracts/addresses";
import { forwarderAbi } from "../contracts/forwarder";
import { encodeDailyIndexReport, normalizeBytes32, toAreaId } from "../utils/report";

type Row = {
  yyyymmdd: number;
  value1e6: bigint;
  reporter: `0x${string}`;
  reportedAt: bigint;
  datasetHash: `0x${string}`;
  areaId: `0x${string}`;
};

function prettyDateNum(n: number) {
  const s = String(n);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export default function AdminManualCommit() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const owner = 
      chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_OWNER_ADDRESS as string | undefined)
      : (import.meta.env.VITE_ANVIL_OWNER_ADDRESS as string | undefined);
  const isOwner = sameAddress(address, owner);

  const { consumer: consumerAddress, forwarder: forwarderAddress } = getAddresses(chainId);

  const rpcUrl =
    chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_RPC_URL as string)
      : (import.meta.env.VITE_ANVIL_RPC_URL as string);

  const client = useMemo(
    () =>
      createPublicClient({
        transport: http(rpcUrl),
      }),
    [rpcUrl]
  );

  // ======= Commit form state =======
  const [indexName, setIndexName] = useState("NORDPOOL_DAYAHEAD_AVG_V1");
  const [area, setArea] = useState<Area>("NO1");
  const [dateNum, setDateNum] = useState<number>(20260125);
  const [value1e6Str, setValue1e6Str] = useState<string>("42420000"); // allow negative
  const [datasetHashStr, setDatasetHashStr] = useState<string>("");
  const [formErr, setFormErr] = useState<string | null>(null);

  // For a small “Last commit” preview
  const [lastRow, setLastRow] = useState<Row | null>(null);
  const areaId = useMemo(() => toAreaId(area) as `0x${string}`, [area]);

  // ======= wagmi write =======
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  async function onPickJsonFile(file: File) {
    setFormErr(null);
    try {
      const text = await file.text();
      const j = JSON.parse(text);

      const jIndexName = (j.indexName ?? j.index_id ?? "") as string;
      const jArea = (j.area ?? "") as string;
      const jDateNum = Number(j.dateNum ?? j.yyyymmdd);
      const jValue = (j.value1e6 ?? j.avg1e6 ?? j.value ?? "") as string | number;
      const jHash =
        (j.datasetHash ?? j.datasetHashHex ?? j.dataHash ?? j.dataHashHex ?? "") as string;

      if (jIndexName) setIndexName(jIndexName);
      if (jArea) setArea(jArea as Area);
      if (Number.isFinite(jDateNum)) setDateNum(jDateNum);

      if (typeof jValue === "number") setValue1e6Str(String(jValue));
      if (typeof jValue === "string") setValue1e6Str(jValue);

      if (jHash) setDatasetHashStr(jHash);
    } catch (e: any) {
      setFormErr(e?.message ?? String(e));
    }
  }

  async function refreshLast() {
    try {
      const logs = await client.getLogs({
        address: consumerAddress,
        event: parseAbiItem(
          "event DailyIndexCommitted(bytes32 indexed indexId, bytes32 indexed areaId, uint32 indexed yyyymmdd, int256 value1e6, bytes32 datasetHash, address reporter, uint64 reportedAt)"
        ),
        fromBlock: 0n,
        toBlock: "latest",
      });

      const mapped: Row[] = logs.map((l) => {
        const a = l.args!;
        return {
          yyyymmdd: Number(a.yyyymmdd),
          value1e6: a.value1e6 as bigint,
          reporter: a.reporter as `0x${string}`,
          reportedAt: a.reportedAt as bigint,
          datasetHash: a.datasetHash as `0x${string}`,
          areaId: a.areaId as `0x${string}`,
        };
      });

      const filtered = mapped
        .filter((r) => r.areaId.toLowerCase() === areaId.toLowerCase())
        .sort((a, b) => b.yyyymmdd - a.yyyymmdd);

      setLastRow(filtered[0] ?? null);
    } catch (e) {
      // swallow (this is just a preview)
    }
  }

  function submitCommit() {
    setFormErr(null);

    try {
      if (!datasetHashStr) throw new Error("datasetHash is required (bytes32)");
      const datasetHash = normalizeBytes32(datasetHashStr);

      const v = BigInt(value1e6Str.trim());
      if (v < -(2n ** 255n) || v > 2n ** 255n - 1n) {
        throw new Error("value1e6 outside int256 range");
      }

      const report = encodeDailyIndexReport({
        indexName,
        area,
        yyyymmdd: dateNum,
        value1e6: v,
        datasetHash,
      });

      writeContract({
        address: forwarderAddress,
        abi: forwarderAbi,
        functionName: "forward",
        args: [consumerAddress, "0x", report],
      });
    } catch (e: any) {
      setFormErr(e?.message ?? String(e));
    }
  }

  // Refresh preview when tx succeeds
  if (isSuccess && txHash && !lastRow) {
    // fire and forget
    void refreshLast();
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

  return (
    <PageWrapper title="Admin" subtitle="Manual report submission (Forwarder → Consumer)">
      <AdminSubNav />

      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Commit index (manual)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Useful for demos/local testing. In production, CRE fulfills via the registry + forwarder.
            </p>
          </div>

          <label className="text-sm">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickJsonFile(f);
                e.currentTarget.value = "";
              }}
            />
            <span
              className="
                inline-flex items-center justify-center
                rounded-xl border border-gray-200 dark:border-gray-800
                bg-white dark:bg-gray-900
                text-gray-900 dark:text-gray-100
                px-3 py-2 text-sm font-medium
                hover:bg-gray-100 dark:hover:bg-gray-800
                cursor-pointer
              "
            >
              Load JSON…
            </span>
          </label>
        </div>

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
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {prettyDateNum(dateNum)}
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">value1e6 (int256)</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={value1e6Str}
              onChange={(e) => setValue1e6Str(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              EUR/MWh ≈{" "}
              {(() => {
                try {
                  const v = BigInt(value1e6Str || "0");
                  const abs = v < 0n ? -v : v;
                  const whole = abs / 1_000_000n;
                  const frac = (abs % 1_000_000n).toString().padStart(6, "0");
                  return `${v < 0n ? "-" : ""}${whole}.${frac}`;
                } catch {
                  return "—";
                }
              })()}
            </div>
          </label>

          <label className="block md:col-span-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">datasetHash (bytes32)</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              placeholder="0x… (64 hex) or 64-hex without 0x"
              value={datasetHashStr}
              onChange={(e) => setDatasetHashStr(e.target.value)}
            />
          </label>
        </div>

        {formErr && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
            {formErr}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={submitCommit}
            disabled={isPending || isConfirming}
            className="
              rounded-xl px-4 py-2 text-sm font-medium shadow-sm
              bg-gray-900 text-white hover:bg-gray-800
              dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
              disabled:opacity-60
            "
          >
            {isPending ? "Wallet…" : isConfirming ? "Confirming…" : "Send report"}
          </button>

          <button
            onClick={refreshLast}
            className="
              rounded-xl px-4 py-2 text-sm font-medium
              border border-gray-200 dark:border-gray-800
              text-gray-900 dark:text-gray-100
              hover:bg-gray-100 dark:hover:bg-gray-800
            "
          >
            Refresh preview
          </button>

          {isSuccess && txHash && (
            <span className="text-sm text-green-700 dark:text-green-400 font-mono">
              tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </span>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
          chainId: {chainId} <br />
          consumer: {consumerAddress} <br />
          forwarder: {forwarderAddress}
        </div>
      </section>

      {lastRow && (
        <section className="mt-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Last commit</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-300">Date</span>
              <span className="font-mono">{lastRow.yyyymmdd}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-300">Value (EUR/MWh)</span>
              <span className="font-mono">{formatUnits(lastRow.value1e6, 6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-300">Reporter</span>
              <span className="font-mono">{lastRow.reporter}</span>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
              <div className="text-gray-600 dark:text-gray-300">datasetHash</div>
              <div className="font-mono break-all">{lastRow.datasetHash}</div>
            </div>
          </div>
        </section>
      )}
    </PageWrapper>
  );
}
