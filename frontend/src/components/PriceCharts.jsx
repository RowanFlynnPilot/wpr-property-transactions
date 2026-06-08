import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { median, money, moneyCompact, shortMuni } from "../lib/format.js";

const TEAL = "#3a867c";
const TEAL_BRIGHT = "#4aaba7";

// Price-distribution buckets (whole dollars). Open-ended top bucket.
const BUCKETS = [
  [0, 100_000],
  [100_000, 200_000],
  [200_000, 300_000],
  [300_000, 500_000],
  [500_000, 1_000_000],
  [1_000_000, Infinity],
];

function bucketLabel([lo, hi]) {
  if (hi === Infinity) return `${moneyCompact(lo)}+`;
  return `${moneyCompact(lo)}–${moneyCompact(hi)}`;
}

export default function PriceCharts({ records }) {
  const byMuni = useMemo(() => {
    const groups = new Map();
    for (const r of records) {
      if (!groups.has(r.municipality)) groups.set(r.municipality, []);
      groups.get(r.municipality).push(r.sale_price);
    }
    return [...groups.entries()]
      .map(([m, prices]) => ({
        muni: shortMuni(m),
        count: prices.length,
        medianPrice: median(prices),
      }))
      .sort((a, b) => b.medianPrice - a.medianPrice)
      .slice(0, 12);
  }, [records]);

  const distribution = useMemo(() => {
    return BUCKETS.map((b) => ({
      label: bucketLabel(b),
      count: records.filter((r) => r.sale_price >= b[0] && r.sale_price < b[1]).length,
    }));
  }, [records]);

  if (!records.length) return null;

  return (
    <section className="charts" aria-label="Price charts">
      <figure className="chart">
        <figcaption>Median sale price by community (top 12)</figcaption>
        <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byMuni} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="#e6e0d2" />
            <XAxis
              type="number"
              tickFormatter={moneyCompact}
              tick={{ fontSize: 11 }}
              stroke="#888"
            />
            <YAxis
              type="category"
              dataKey="muni"
              width={96}
              tick={{ fontSize: 11 }}
              stroke="#888"
            />
            <Tooltip
              formatter={(v, _n, p) => [`${money(v)} · ${p.payload.count} sales`, "Median"]}
              cursor={{ fill: "rgba(58,134,124,0.08)" }}
            />
            <Bar dataKey="medianPrice" fill={TEAL} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </figure>

      <figure className="chart">
        <figcaption>Property sales by price range</figcaption>
        <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ left: 8, right: 16 }}>
            <CartesianGrid vertical={false} stroke="#e6e0d2" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#888" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
            <Tooltip
              formatter={(v) => [`${v} sales`, "Count"]}
              cursor={{ fill: "rgba(58,134,124,0.08)" }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {distribution.map((_, i) => (
                <Cell key={i} fill={i % 2 ? TEAL_BRIGHT : TEAL} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </figure>
    </section>
  );
}
