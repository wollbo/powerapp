// src/components/AdminSubNav.tsx
import { NavLink } from "react-router-dom";
import { useChainId } from "wagmi";

export default function AdminSubNav() {
  const chainId = useChainId();
  const isAnvil = chainId === 31337;

  const base = "px-3 py-2 rounded-xl text-sm font-medium transition-colors";
  const active = "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900";
  const inactive =
    "text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800";

  const link = (to: string) => (props: { isActive: boolean }) =>
    `${base} ${props.isActive ? active : inactive}`;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {isAnvil && (
        <NavLink to="/admin/requests" className={link("/admin/requests")}>
          Requests
        </NavLink>
      )}
      <NavLink to="/admin/explorer" className={link("/admin/explorer")}>
        Explorer
      </NavLink>
      {isAnvil && (
        <NavLink to="/admin/manual" className={link("/admin/manual")}>
          Manual
        </NavLink>
      )}
    </div>
  );
}