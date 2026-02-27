import PageWrapper from "../components/PageWrapper";

export default function Methodology() {
  return (
    <PageWrapper
      title="Methodology"
      subtitle="How NORDPOOL_DAYAHEAD_VWAP_V1 is computed and committed on-chain"
    >
      {/* 1) Data & scope */}
      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          1) Data & scope
        </h2>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-mono">NORDPOOL_DAYAHEAD_VWAP_V1</span> is a daily
          volume-weighted average price (VWAP) for the Nord Pool Day-Ahead auction,
          computed per delivery area for the delivery day.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>• Market: DayAhead • Currency: EUR</li>
          <li>• 15-minute delivery periods (typically 96)</li>
          <li>• Weighted by auction <span className="font-mono">buy</span> volume (MW)</li>
          <li>• Published only when prices and volumes are <span className="font-mono">Final</span></li>
        </ul>

        <a
          href="https://data.nordpoolgroup.com/auction/day-ahead/prices"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm underline text-blue-600 dark:text-blue-400"
        >
          Nord Pool data portal →
        </a>
      </section>

      {/* 2) VWAP calculation */}
      <section className="mt-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          2) VWAP calculation
        </h2>

        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm font-mono">
          vwap = Σ(price[t] × volume[t]) / Σ(volume[t])
        </div>

        <ul className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>• Excludes periods with missing price or missing/zero volume</li>
          <li>• If Σ(volume) = 0, the index is not published</li>
          <li>• On-chain value: <span className="font-mono">int256 value1e6</span> (EUR/MW × 1e6)</li>
        </ul>
      </section>

      {/* 3) CRE publication & verification */}
        <section className="mt-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                3) CRE publication & on-chain verification
            </h2>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                The index is computed and published through a 
                <span className="font-medium text-gray-900 dark:text-gray-100">
                {" "}Chainlink Runtime Environment (CRE) workflow
                </span>.
                The workflow:
            </p>

            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>• Fetches finalized Nord Pool prices and volumes</li>
                <li>• Computes the deterministic VWAP</li>
                <li>• Derives a <span className="font-mono">datasetHash</span> over all included periods</li>
                <li>• Signs and submits a report to the on-chain consumer contract</li>
            </ul>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm font-mono">
                datasetHash = keccak256(concat(periodIndex, price1e6, vol1e6))
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm font-mono">
                (indexId, yyyymmdd, areaId, value1e6, datasetHash)
            </div>

            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                The consumer contract stores commitments per 
                <span className="font-mono"> (indexId, areaId, yyyymmdd)</span>, 
                enabling deterministic settlement of binary options.
                Any party can independently recompute the index and verify the 
                on-chain commitment against the published dataset hash.
            </p>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Prototype index for demo purposes. Not affiliated with Nord Pool.
            </p>
        </section>
    </PageWrapper>
  );
}