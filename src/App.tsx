import { NavLink, Route, Routes } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import IndexFeed from "./pages/IndexFeed";
import AdminRequests from "./pages/AdminRequests";
import AdminManualCommit from "./pages/AdminManualCommit";
import AdminConsumerExplorer from "./pages/AdminConsumerExplorer";
import MarketBrowse from "./pages/MarketBrowse.tsx";
import MarketCreateOffer from "./pages/MarketCreateOffer.tsx";
import MarketMine from "./pages/MarketMine.tsx";
import Methodology from "./pages/Methodology";
import Home from "./pages/Home";
import powerIndexLogo from "./assets/powerindex-logo.png";

import { useTheme } from "./hooks/useTheme";
import { useAccount, useChainId } from "wagmi";
import { sameAddress } from "./utils/address";


function TopNav() {
  const { theme, toggle } = useTheme();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const owner = 
      chainId === 11155111
      ? (import.meta.env.VITE_SEPOLIA_OWNER_ADDRESS as string | undefined)
      : (import.meta.env.VITE_ANVIL_OWNER_ADDRESS as string | undefined);  const showAdmin = !!owner && isConnected && sameAddress(address, owner);

  const base = "px-3 py-2 rounded-xl text-sm font-medium transition-colors";
  const active = "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900";
  const inactive =
    "text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800";

  return (
    <header
      className="
        sticky top-0 z-10 backdrop-blur
        border-b border-gray-200 dark:border-gray-800
        bg-white/80 dark:bg-gray-950/80
      "
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NavLink to="/" className="font-bold text-gray-900 dark:text-gray-100">
            <div className="flex items-center gap-2">
              <img src={powerIndexLogo} className="h-6 w-6" />
              <div className="font-bold text-gray-900 dark:text-gray-100">
                PowerIndex
              </div>
            </div>
          </NavLink>
          <nav className="ml-4 flex items-center gap-2">
            <NavLink
              to="/indexes"
              className={({ isActive }) =>
                `${base} ${isActive ? active : inactive}`
              }
            >
              Index feed
            </NavLink>
            <NavLink
              to="/markets"
              className={({ isActive }) =>
                `${base} ${isActive ? active : inactive}`
              }
            >
              Market
            </NavLink>
            <NavLink
              to="/methodology"
              className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
            >
              Methodology
            </NavLink>
            {showAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
              >
                Admin
              </NavLink>
            )}

          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="
              rounded-xl border border-gray-200 dark:border-gray-800
              bg-white dark:bg-gray-900
              text-gray-900 dark:text-gray-100
              px-3 py-2 text-sm font-medium
              hover:bg-gray-100 dark:hover:bg-gray-800
            "
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <ConnectButton />
        </div>
      </div>
    </header>
  );
}


export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <TopNav />
      <main className="w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/indexes" element={<IndexFeed />} />
          <Route path="/admin" element={<AdminConsumerExplorer />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/manual" element={<AdminManualCommit />} />
          <Route path="/admin/explorer" element={<AdminConsumerExplorer />} />
          <Route path="/markets" element={<MarketBrowse/>} />
          <Route path="/markets/create" element={<MarketCreateOffer />} />
          <Route path="/markets/mine" element={<MarketMine />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
      </main>
    </div>
  );
}
