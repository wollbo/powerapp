import { Link } from "react-router-dom";
import PageWrapper from "../components/PageWrapper";
import { useChainId } from "wagmi";
import { getAddresses } from "../contracts/addresses";

function explorerBaseUrl(chainId: number) {
  if (chainId === 11155111) return "https://sepolia.etherscan.io";
  if (chainId === 1) return "https://etherscan.io";
  return null;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function Home() {
  const chainId = useChainId();
  const { consumer, factory } = getAddresses(chainId);

  const base = explorerBaseUrl(chainId);
  const consumerUrl = base ? `${base}/address/${consumer}` : null;
  const factoryUrl = base ? `${base}/address/${factory}` : null;

  return (
    <PageWrapper title="PowerIndex" subtitle="A verifiable Day-ahead power index published on-chain.">
      <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Power market data, committed on-chain.
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            PowerIndex is a verifiable index for Nordic power markets, implemented as a Chainlink Runtime Environment (CRE) workflow.
            The workflow fetches Nord Pool Day-ahead prices and volumes, computes a deterministic VWAP,
            derives a <span className="font-mono">datasetHash</span>, and signs and publishes a
            commitment to an on-chain consumer contract.
            Binary options settle against the committed value.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/indexes"
              className="
                rounded-xl px-4 py-2 text-sm font-medium shadow-sm
                bg-gray-900 text-white hover:bg-gray-800
                dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
              "
            >
              View index feed
            </Link>
            <Link
              to="/markets"
              className="
                rounded-xl px-4 py-2 text-sm font-medium
                border border-gray-200 dark:border-gray-800
                text-gray-900 dark:text-gray-100
                hover:bg-gray-100 dark:hover:bg-gray-800
              "
            >
              Explore market
            </Link>
          </div>

          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 font-mono space-y-1">
            <div>chainId: {chainId}</div>
            <div>
              consumer:{" "}
              {consumerUrl ? (
                <a className="hover:underline" href={consumerUrl} target="_blank" rel="noreferrer">
                  {shortAddr(consumer)}
                </a>
              ) : (
                shortAddr(consumer)
              )}
            </div>
            <div>
              factory:{" "}
              {factoryUrl ? (
                <a className="hover:underline" href={factoryUrl} target="_blank" rel="noreferrer">
                  {shortAddr(factory)}
                </a>
              ) : (
                shortAddr(factory)
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <div className="text-sm font-semibold">Computation & verification</div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            How VWAP is computed, how datasetHash is derived, and what gets published on-chain.
          </p>
          <Link to="/methodology" className="mt-3 inline-block text-sm hover:underline">
            Read methodology →
          </Link>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <div className="text-sm font-semibold">Source data</div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            View the underlying Nord Pool DayAhead prices and volumes.
          </p>
          <a
            href="https://data.nordpoolgroup.com/auction/day-ahead/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm hover:underline"
          >
            Open Nord Pool portal →
          </a>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <div className="text-sm font-semibold">Trade demo</div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Create and buy binary options that settle against the published index value.
          </p>
          <Link to="/markets/create" className="mt-3 inline-block text-sm hover:underline">
            Create an offer →
          </Link>
        </div>
      </section>
    </PageWrapper>
  );
}