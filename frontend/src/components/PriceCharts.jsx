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
  LabelList,
} from "recharts";
import { median, money, moneyCompact, shortMuni } from "../lib/format.js";

const TEAL = "#3a867c";
const TEAL_BRIGHT = "#4aaba7";
const HIGHLIGHT = "#c8922e"; // amber — marks the selected county/community against the teal bars
const LABEL = "#5a564d"; // value-label text

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

// Styled tooltip for the median charts (county + community).
function MedianTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const title = d.muni ?? d.county;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">
        {title}
        {d.muni && <span className="chart-tip-scope"> · {d.county} Co.</span>}
      </div>
      <div className="chart-tip-row">
        Median<b>{money(d.medianPrice)}</b>
      </div>
      <div className="chart-tip-sub">
        {d.count} {d.count === 1 ? "sale" : "sales"}
      </div>
    </div>
  );
}

// Styled tooltip for the price-range histogram.
function CountTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{d.label}</div>
      <div className="chart-tip-row">
        Sales<b>{d.count}</b>
      </div>
    </div>
  );
}

const TIP_CURSOR = { fill: "rgba(58,134,124,0.08)" };

export default function PriceCharts({
  records,
  communityRecords,
  countyRecords,
  selected,
  selectedCounty,
  onSelectCounty,
}) {
  // The county and community comparisons always span all counties/communities
  // (countyRecords/communityRecords = the broader filter layers), so each stays a
  // full ranking and just highlights the selection. The histogram uses `records`,
  // so it reflects the current selection.
  const comparisonRows = communityRecords ?? records;

  const byCounty = useMemo(() => {
    const groups = new Map();
    for (const r of countyRecords ?? records) {
      if (!groups.has(r.county)) groups.set(r.county, []);
      groups.get(r.county).push(r.sale_price);
    }
    return [...groups.entries()]
      .map(([county, prices]) => ({
        county,
        count: prices.length,
        medianPrice: median(prices),
      }))
      .sort((a, b) => b.medianPrice - a.medianPrice);
  }, [countyRecords, records]);

  const byMuni = useMemo(() => {
    // Group by county+municipality — names repeat across counties, so a plain
    // municipality key would merge e.g. two different "Cleveland, Town of".
    const groups = new Map();
    for (const r of comparisonRows) {
      const key = `${r.county}|${r.municipality}`;
      if (!groups.has(key)) groups.set(key, { county: r.county, muni: r.municipality, prices: [] });
      groups.get(key).prices.push(r.sale_price);
    }
    return [...groups.values()]
      .map((g) => ({
        muni: shortMuni(g.muni),
        muniFull: g.muni,
        county: g.county,
        count: g.prices.length,
        medianPrice: median(g.prices),
      }))
      .sort((a, b) => b.medianPrice - a.medianPrice)
      .slice(0, 10);
  }, [comparisonRows]);

  const distribution = useMemo(() => {
    return BUCKETS.map((b) => ({
      label: bucketLabel(b),
      count: records.filter((r) => r.sale_price >= b[0] && r.sale_price < b[1]).length,
    }));
  }, [records]);

  if (!records.length) return null;

  const communityTitle =
    "Median sale price by community (top 10)" + (selectedCounty ? ` · ${selectedCounty}` : "");

  return (
    <section className="charts" aria-label="Price charts">
      <figure className="chart chart-wide chart-clickable">
        <figcaption>
          Median sale price by county
          {onSelectCounty && <span className="chart-hint"> · click a county to filter the page</span>}
        </figcaption>
        <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byCounty} margin={{ left: 8, right: 16, top: 22 }}>
            <CartesianGrid vertical={false} stroke="#e6e0d2" />
            <XAxis dataKey="county" tick={{ fontSize: 11 }} stroke="#b8b2a4" interval={0} tickMargin={6} />
            <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 11 }} stroke="#b8b2a4" />
            <Tooltip content={<MedianTooltip />} cursor={TIP_CURSOR} />
            <Bar
              dataKey="medianPrice"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              onClick={onSelectCounty ? (d) => onSelectCounty(d.county) : undefined}
            >
              {byCounty.map((d) => (
                <Cell key={d.county} fill={d.county === selectedCounty ? HIGHLIGHT : TEAL} />
              ))}
              <LabelList
                dataKey="medianPrice"
                position="top"
                formatter={moneyCompact}
                style={{ fontSize: 11, fill: LABEL }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </figure>

      <figure className="chart">
        <figcaption>{communityTitle}</figcaption>
        <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byMuni} layout="vertical" margin={{ left: 8, right: 52 }}>
            <CartesianGrid horizontal={false} stroke="#e6e0d2" />
            <XAxis type="number" tickFormatter={moneyCompact} tick={{ fontSize: 11 }} stroke="#b8b2a4" />
            <YAxis type="category" dataKey="muni" width={96} tick={{ fontSize: 11 }} stroke="#b8b2a4" />
            <Tooltip content={<MedianTooltip />} cursor={TIP_CURSOR} />
            <Bar dataKey="medianPrice" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {byMuni.map((d) => (
                <Cell
                  key={`${d.county}|${d.muniFull}`}
                  fill={
                    d.muniFull === selected && d.county === selectedCounty ? HIGHLIGHT : TEAL
                  }
                />
              ))}
              <LabelList
                dataKey="medianPrice"
                position="right"
                formatter={moneyCompact}
                style={{ fontSize: 11, fill: LABEL }}
              />
            </Bar>
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
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#b8b2a4" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#b8b2a4" />
            <Tooltip content={<CountTooltip />} cursor={TIP_CURSOR} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
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
