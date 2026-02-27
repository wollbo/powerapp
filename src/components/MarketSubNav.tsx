import { NavLink } from "react-router-dom";

export default function MarketSubNav() {
  const base =
    "px-3 py-2 rounded-xl text-sm font-medium transition-colors";
  const active =
    "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900";
  const inactive =
    "text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800";

  return (
    <div className="mb-6">
      <nav className="flex flex-wrap gap-2">
        <NavLink
          to="/markets"
          end
          className={({ isActive }) =>
            `${base} ${isActive ? active : inactive}`
          }
        >
          Browse
        </NavLink>

        <NavLink
          to="/markets/create"
          className={({ isActive }) =>
            `${base} ${isActive ? active : inactive}`
          }
        >
          Create
        </NavLink>
        
        <NavLink
          to="/markets/mine"
          className={({ isActive }) =>
            `${base} ${isActive ? active : inactive}`
          }
        >
          My positions
        </NavLink>
      </nav>
    </div>
  );
}
