import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { money, moneyCompact } from "../lib/format.js";

const TEAL = "#3a867c";
const AMBER = "#c8922e";

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Rolling 12-month median trend: the region-wide "Overall" line plus one
// user-selectable county for comparison. Data is the aggregate price_history.json
// (medians only). The most recent month is partial (still accruing recordings).
export default function PriceHistoryChart({ history }) {
  const counties = history?.counties ?? [];
  const [county, setCounty] = useState(counties[0] ?? "");

  const data = useMemo(() => {
    if (!history) return [];
    return history.months.map((mo, i) => ({
      month: monthLabel(mo),
      Overall: history.series.Overall?.[i] ?? null,
      [county]: history.series[county]?.[i] ?? null,
    }));
  }, [history, county]);

  if (!history) return null;

  return (
    <section className="history" aria-label="12-month price trend">
      <div className="history-head">
        <h2>Median sale price · 12-month trend</h2>
        <label className="history-pick">
          Compare county
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            {counties.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="history-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid stroke="#e6e0d2" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#888" />
            <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 11 }} stroke="#888" width={52} />
            <Tooltip formatter={(v, n) => [v == null ? "—" : money(v), n]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="Overall"
              name="Region overall"
              stroke={TEAL}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={county}
              name={county}
              stroke={AMBER}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
