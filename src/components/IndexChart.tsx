import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NormalizedPoint } from "../types/index";

function formatTick(iso: string) {
  // show "MM-DD" for compact axes
  return iso.slice(5);
}

function formatValue(v: number) {
  return `${v.toFixed(2)} EUR/MWh`; // Or EUR/MW ?
}

export default function IndexChart({
  data,
  title,
}: {
  data: NormalizedPoint[];
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 18, left: 6, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="dateISO"
              tickFormatter={formatTick}
              minTickGap={18}
            />
            <YAxis
              tickFormatter={(v) => `${v}`}
              width={45}
            />
            <Tooltip
              formatter={(v: unknown) => formatValue(Number(v))}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
