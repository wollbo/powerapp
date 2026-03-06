import { useMemo, useState } from "react";
import { useChainId } from "wagmi";
import IndexChart from "../components/IndexChart";
import StrikeProbability from "../components/StrikeProbability";
import { useHistoricalIndex } from "../hooks/useHistoricalIndex";
import { useOnchainIndexHistory } from "../hooks/useOnchainIndex";
import PageWrapper from "../components/PageWrapper";
import { SEPOLIA } from "../config/chains";

const AREAS = ["DK1","DK2","FI","NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4"];

export default function IndexFeed() {
  const [area, setArea] = useState("NO1");
  const [range, setRange] = useState<30 | 90 | 365 | 9999>(90);

  const chainId = useChainId();
  const isSepolia = chainId === SEPOLIA.id;

  // Sepolia: onchain
  const onchain = useOnchainIndexHistory(area, "NORDPOOL_DAYAHEAD_VWAP_V1", range === 9999 ? 365 : range);

  // Anvil: static JSON
  const local = useHistoricalIndex(area);

  const data = isSepolia ? onchain.data : local.data;
  const isLoading = isSepolia ? onchain.isLoading : local.isLoading;
  const error = isSepolia ? onchain.error : local.error;

  const sliced = useMemo(() => {
    if (!data) return [];
    if (range === 9999) return data;
    return data.slice(-range);
  }, [data, range]);

  return (
    <PageWrapper 
      title="Index feed"
      subtitle={isSepolia ? "On-chain (Sepolia)" : "Local demo data (Anvil)"}
    >
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6">
        <label className="block">
          <div className="text-sm text-gray-600 dark:text-gray-300">Area</div>
          <select
            className="mt-1 rounded-xl border border-gray-200 dark:border-gray-800
           bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100
           px-3 py-2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm text-gray-600 dark:text-gray-300">Range</div>
          <select
            className="mt-1 rounded-xl border border-gray-200 dark:border-gray-800
           bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100
           px-3 py-2"
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as any)}
          >
            <option value={30}>Last 30</option>
            <option value={90}>Last 90</option>
            <option value={365}>Last 365</option>
            <option value={9999}>All</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="text-gray-600 dark:text-gray-300">Loading…</p>}
      {error && <p className="text-red-600 dark:text-red-400">{String(error)}</p>}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IndexChart data={sliced} title={`${area} daily VWAP index (EUR/MW)`} />
          <StrikeProbability data={sliced} />
        </div>
      )}
    </PageWrapper>
  );
}
