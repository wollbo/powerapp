import { useMemo, useState, useEffect } from "react";
import { sepolia } from "viem/chains"; 
import PageWrapper from "../components/PageWrapper";
import MarketSubNav from "../components/MarketSubNav";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { keccak256, parseEther, toBytes } from "viem";

import { AREAS, type Area } from "../constants";
import { toAreaId } from "../utils/report";
import { getAddresses } from "../contracts/addresses";
import { northpoleOptionFactoryAbi } from "../contracts/northpoleOptionFactory";
import { requireAddress } from "../utils/requireAddress";


function isoToYyyymmdd(iso: string): number {
  // "2026-02-21" -> 20260221
  const [y, m, d] = iso.split("-");
  return Number(`${y}${m}${d}`);
}

function eurMwTo1e6(s: string): bigint {
  // accepts "40", "40.4", "40.42"
  const t = s.trim();
  if (!t) throw new Error("Strike is required");

  const neg = t.startsWith("-");
  const raw = neg ? t.slice(1) : t;

  const [whole, frac = ""] = raw.split(".");
  if (!/^\d+$/.test(whole || "0")) throw new Error("Invalid strike");
  if (!/^\d*$/.test(frac)) throw new Error("Invalid strike decimals");

  const frac2 = (frac + "00").slice(0, 2); // 2 decimals
  const scaled2 = BigInt(whole || "0") * 100n + BigInt(frac2); // cents
  const scaled1e6 = (scaled2 * 1_000_000n) / 100n; // cents -> 1e6 exact
  return neg ? -scaled1e6 : scaled1e6;
}

function quickDeadline(minutes: number): string {
  return String(Math.floor(Date.now() / 1000) + minutes * 60);
}

function stockholmNoonUnix(dateISO: string): number {
  // dateISO = "YYYY-MM-DD"
  // returns unix seconds for 12:00 in Europe/Stockholm on that calendar date
  const [y, m, d] = dateISO.split("-").map(Number);

  // Start with UTC noon, then compute Stockholm offset for that moment, then correct.
  // We’ll compute Stockholm-local components for a UTC timestamp and back out the offset.

  const tz = "Europe/Stockholm";

  const utcNoonMs = Date.UTC(y, m - 1, d, 12, 0, 0);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcNoonMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  const ly = get("year");
  const lm = get("month");
  const ld = get("day");
  const lh = get("hour");
  const lmin = get("minute");
  const ls = get("second");

  // This is what Stockholm local time *was* at utcNoonMs.
  // Convert that local timestamp to a "fake UTC" ms and compare to get offset.
  const stockholmAtUtcNoon_asUtcMs = Date.UTC(ly, lm - 1, ld, lh, lmin, ls);
  const offsetMs = stockholmAtUtcNoon_asUtcMs - utcNoonMs;

  // Now we want Stockholm 12:00 local. That is UTC time = local - offset.
  const stockholmNoon_asUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0) - offsetMs;

  return Math.floor(stockholmNoon_asUtcMs / 1000);
}

function formatStockholmNoon(dateISO: string) {
  const ts = stockholmNoonUnix(dateISO);
  const utcIso = new Date(ts * 1000).toISOString().replace(".000Z", "Z");

  const stockholmFormatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts * 1000));

  return { ts, utcIso, stockholmFormatted };
}

function stockholmNowParts(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);

  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function isoFromYmdUtc(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function addDaysIsoUtc(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function defaultDeliveryDateISO(chainId: number | undefined) {
  // Local anvil/dev: simple tomorrow default is fine
  if (!chainId || chainId !== sepolia.id) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  // Sepolia: tomorrow if before 12:00 Stockholm, else day-after-tomorrow
  const { y, m, d, hour, minute } = stockholmNowParts();
  const afterNoon = hour > 12 || (hour === 12 && minute >= 0);

  const stockholmTodayISO = isoFromYmdUtc(y, m, d);
  return addDaysIsoUtc(stockholmTodayISO, afterNoon ? 2 : 1);
}

export default function MarketCreateOffer() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { consumer, factory } = getAddresses(chainId);

  // hardcode single index for hackathon
  const indexName = "NORDPOOL_DAYAHEAD_VWAP_V1";
  const indexId = useMemo(
    () => keccak256(toBytes(indexName)) as `0x${string}`,
    [indexName]
  );

  const [area, setArea] = useState<Area>("NO1");

  // Date picker state
  const [dateTouched, setDateTouched] = useState(false);

  const [dateISO, setDateISO] = useState<string>(() => defaultDeliveryDateISO(undefined));

  // When chain changes (or first resolves), reset date to the correct default
  useEffect(() => {
    setDateTouched(false);
    setDateISO(defaultDeliveryDateISO(chainId));
  }, [chainId]);

  // Auto-flip at/after 12:00 Stockholm if user hasn't manually picked a date
  useEffect(() => {
    if (chainId !== sepolia.id) return;
    if (dateTouched) return;

    const tick = () => {
      const recommended = defaultDeliveryDateISO(chainId);
      setDateISO((cur) => (cur === recommended ? cur : recommended));
    };

    tick(); // run once immediately
    const id = window.setInterval(tick, 60_000); // check every minute
    return () => window.clearInterval(id);
  }, [chainId, dateTouched]);


  const [direction, setDirection] = useState<number>(0); // 0/1

  // Human-friendly strike
  const [strikeEurStr, setStrikeEurStr] = useState("100");

  // Optional currency scaffold (EUR only for now)
  const [currency, setCurrency] = useState<"EUR">("EUR");

  const [premiumEth, setPremiumEth] = useState<string>("0.1");
  const [payoutEth, setPayoutEth] = useState<string>("1.0");

  // unix seconds
  // init
  const [buyDeadlineStr, setBuyDeadlineStr] = useState<string>(() => quickDeadline(60));

  // when chain/date changes, update deadline in Sepolia mode
  useEffect(() => {
    if (chainId === sepolia.id && dateISO) {
      setBuyDeadlineStr(String(stockholmNoonUnix(dateISO)));
    }
}, [chainId, dateISO]);
  const [err, setErr] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  function submit() {
    setErr(null);
    if (!factory) return;

    try {
      const factoryAddr = requireAddress(factory, "factory");
      const consumerAddr = requireAddress(consumer, "consumer");
      if (!dateISO || dateISO.length !== 10) throw new Error("Pick a valid date");

      const yyyymmdd = isoToYyyymmdd(dateISO);
      if (!Number.isFinite(yyyymmdd) || String(yyyymmdd).length !== 8) {
        throw new Error("Invalid date");
      }

      const strike = eurMwTo1e6(strikeEurStr);
      if (strike < -(2n ** 255n) || strike > (2n ** 255n - 1n)) {
        throw new Error("strike1e6 outside int256 range");
      }

      const premiumWei = parseEther(premiumEth);
      const payoutWei = parseEther(payoutEth);

      const buyDeadline = BigInt(buyDeadlineStr.trim());
      if (buyDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
        throw new Error("buyDeadline must be in the future (unix seconds)");
      }

      writeContract({
        address: factoryAddr,
        abi: northpoleOptionFactoryAbi,
        functionName: "createOption",
        args: [
          consumerAddr,
          indexId,
          toAreaId(area) as `0x${string}`,
          yyyymmdd,
          strike,
          direction,
          premiumWei,
          buyDeadline,
        ],
        value: payoutWei,
      });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <PageWrapper title="Market" subtitle="Create offer">
      <MarketSubNav />

      {!isConnected && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              Connect wallet to create offers.
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Browsing is available without connecting.
            </div>
          </div>
          <ConnectButton />
        </section>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              New binary option
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Using index:{" "}
              <span className="font-mono">{indexName}</span>
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono text-right">
            chainId: {chainId} <br />
            factory: {factory ?? "—"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="text-sm text-gray-600 dark:text-gray-300">Date</div>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={dateISO}
              onChange={(e) => {
                setDateTouched(true);
                setDateISO(e.target.value);
              }}
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Direction</div>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={direction}
              onChange={(e) => setDirection(Number(e.target.value))}
            >
              <option value={0} className="bg-white dark:bg-gray-900">
                Above or equal (≥ strike)
              </option>
              <option value={1} className="bg-white dark:bg-gray-900">
                Below (&lt; strike)
              </option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Strike (EUR/MW)</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={strikeEurStr}
              onChange={(e) => setStrikeEurStr(e.target.value)}
              inputMode="decimal"
              placeholder="40.42"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              2 decimals. Example: 40.42 → 40420000 (1e6)
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Currency</div>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "EUR")}
            >
              <option value="EUR" className="bg-white dark:bg-gray-900">
                EUR
              </option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Premium (ETH)</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={premiumEth}
              onChange={(e) => setPremiumEth(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-300">Payout escrow (ETH)</div>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={payoutEth}
              onChange={(e) => setPayoutEth(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Sent as <span className="font-mono">msg.value</span> when creating the option.
            </div>
          </label>

          <label className="block md:col-span-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Buy deadline (unix seconds, UTC)
            </div>

            <input
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono"
              value={buyDeadlineStr}
              onChange={(e) => setBuyDeadlineStr(e.target.value)}
              disabled={chainId === 11155111}   // 🔒 locked on Sepolia
            />

            {chainId === 11155111 ? (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono space-y-1">
                <div>
                  Sepolia: deadline fixed to 12:00 Europe/Stockholm for selected date.
                </div>

                {dateISO && (() => {
                  const { utcIso, stockholmFormatted } = formatStockholmNoon(dateISO);
                  return (
                    <>
                      <div>UTC: {utcIso}</div>
                      <div>Stockholm: {stockholmFormatted}</div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBuyDeadlineStr(quickDeadline(10))}
                  className="rounded-lg px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Now + 10m
                </button>

                <button
                  type="button"
                  onClick={() => setBuyDeadlineStr(quickDeadline(60))}
                  className="rounded-lg px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Now + 1h
                </button>
              </div>
            )}
          </label>
        </div>

        {err && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
            {err}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={!isConnected || isPending || isConfirming}
            className="
              rounded-xl px-4 py-2 text-sm font-medium shadow-sm
              bg-gray-900 text-white hover:bg-gray-800
              dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
              disabled:opacity-60
            "
          >
            {isPending ? "Wallet…" : isConfirming ? "Confirming…" : "Create offer"}
          </button>

          {isSuccess && txHash && (
            <span className="text-sm text-green-700 dark:text-green-400 font-mono">
              tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </span>
          )}
        </div>
      </section>
    </PageWrapper>
  );
}