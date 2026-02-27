import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import chainlinkLogo from "../assets/chainlink.svg";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};


export default function PageWrapper({ title, subtitle, children }: Props) {

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {(title || subtitle) && (
        <header className="mb-6">
          {title && (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {subtitle}
            </p>
          )}
        </header>
      )}

      {children}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-col items-center gap-3 text-center">

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/methodology" className="hover:underline">
              Methodology
            </Link>

            <a
              href="https://data.nordpoolgroup.com/auction/day-ahead/prices"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Nord Pool data portal
            </a>

            <a
              href="https://github.com/wollbo/powerindex"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <a
              href="https://chain.link/cre"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              title="Powered by Chainlink Runtime Environment (CRE)"
            >
              <img
                src={chainlinkLogo}
                alt="Chainlink"
                className="h-4 w-4"
              />
              <span>Powered by Chainlink Runtime Environment (CRE)</span>
            </a>
          </div>

          <div className="text-gray-400 dark:text-gray-500">
            Not affiliated with Nord Pool.
          </div>
        </div>
      </footer>
    </div>
  );
}