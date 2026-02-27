import { useMemo, useState } from "react";
import type { NormalizedPoint } from "../types/index";
function clampLookback(n: number, max: number) {
  return Math.max(1, Math.min(n, max));
}

export default function StrikeProbability({
  data,
}: {
  data: NormalizedPoint[];
}) {
  const [strike, setStrike] = useState<string>("100");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [lookback, setLookback] = useState<number>(90);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const lb = clampLookback(lookback, data.length);
    const slice = data.slice(-lb);

    const strikeNum = Number(strike);
    if (!Number.isFinite(strikeNum)) return { error: "Strike must be a number." };

    const hits = slice.filter((p) =>
      direction === "above" ? p.value > strikeNum : p.value < strikeNum
    ).length;

    const p = hits / slice.length;

    // some context stats
    const values = slice.map((x) => x.value).sort((a, b) => a - b);
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];

    const min = values[0];
    const max = values[values.length - 1];
    const last = slice[slice.length - 1]?.value;

    return { p, hits, n: slice.length, median, min, max, last };
  }, [data, strike, direction, lookback]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Strike helper</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-300">Direction</span>
            <select
            className="
                mt-1 w-full rounded-xl
                border border-gray-200 dark:border-gray-800
                bg-white dark:bg-gray-900
                text-gray-900 dark:text-gray-100
                px-3 py-2
                focus:outline-none focus:ring-2
                focus:ring-gray-900/10 dark:focus:ring-gray-100/10
            "
            value={direction}
            onChange={(e) => setDirection(e.target.value as "above" | "below")}
            >
            <option className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value="above">
                Above
            </option>
            <option className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value="below">
                Below
            </option>
            </select>

        </label>

        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-300">Strike (EUR/MW)</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2"
            value={strike}
            onChange={(e) => setStrike(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 65"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-300">Lookback (days)</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2"
            type="number"
            min={1}
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-5">
        {!stats ? (
          <p className="text-gray-600 dark:text-gray-300">No data loaded.</p>
        ) : "error" in stats ? (
          <p className="text-red-600 dark:text-red-400">{stats.error}</p>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {(stats.p * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {stats.hits} / {stats.n} days in the last {stats.n} days
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-gray-500">Last</div>
                <div className="font-semibold">{stats.last?.toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-gray-500">Median</div>
                <div className="font-semibold">{stats.median.toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-gray-500">Min</div>
                <div className="font-semibold">{stats.min.toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-gray-500">Max</div>
                <div className="font-semibold">{stats.max.toFixed(2)}</div>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              This is an empirical estimate from the historical index series (not a forecast).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
