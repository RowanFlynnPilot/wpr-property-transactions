import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import ChartDataTable from "./ChartDataTable.jsx";
import { money, moneyCompact } from "../lib/format.js";
import { TEAL, TEAL_BRIGHT, AMBER, GRID, AXIS, LABEL } from "../lib/palette.js";

// The full-size chart behind a KPI card's expand button. Lazy-loaded by KpiHero:
// it is the only thing in the hero that needs recharts, and most visitors never
// open it, so keeping it out of the hero keeps the chart library off the initial
// page load.

function SeriesTip({ active, payload, kind }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{d.monthFull}</div>
      <div className="chart-tip-row">
        {kind === "median" ? "Median" : "Sales"}
        <b>{kind === "median" ? money(d.median) : d.sales.toLocaleString()}</b>
      </div>
    </div>
  );
}
function CommunityTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{d.label}</div>
      <div className="chart-tip-row">
        Sales<b>{d.count}</b>
      </div>
      <div className="chart-tip-sub">{d.county} County</div>
    </div>
  );
}
function RangeTip({ active, payload }) {
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

// A plain function, not a component: ResponsiveContainer passes its measured
// width/height to its DIRECT child, so the child must be the recharts chart
// itself. Wrapping it in a component swallows the size and nothing draws.
function visual({ kind, monthsData, communities, priceStats }) {
  if (kind === "median") {
    return (
      <AreaChart data={monthsData} margin={{ left: 8, right: 16, top: 8 }}>
        <defs>
          <linearGradient id="kpiMedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={AXIS} tickMargin={8} />
        <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 12 }} stroke={AXIS} width={56} domain={["auto", "auto"]} />
        <Tooltip content={<SeriesTip kind="median" />} cursor={{ fill: "rgba(58,134,124,0.06)" }} />
        <Area
          type="monotone"
          dataKey="median"
          stroke={TEAL}
          strokeWidth={2.5}
          fill="url(#kpiMedGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    );
  }
  if (kind === "sales") {
    return (
      <BarChart data={monthsData} margin={{ left: 8, right: 16, top: 18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={AXIS} tickMargin={8} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke={AXIS} width={40} />
        <Tooltip content={<SeriesTip kind="sales" />} cursor={{ fill: "rgba(200,146,46,0.10)" }} />
        <Bar dataKey="sales" fill={AMBER} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="sales" position="top" style={{ fontSize: 11, fill: LABEL }} />
        </Bar>
      </BarChart>
    );
  }
  if (kind === "community") {
    return (
      <BarChart data={communities.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 36, top: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke={AXIS} />
        <YAxis type="category" dataKey="short" width={112} tick={{ fontSize: 11 }} stroke={AXIS} />
        <Tooltip content={<CommunityTip />} cursor={{ fill: "rgba(58,134,124,0.08)" }} />
        <Bar dataKey="count" fill={TEAL} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: LABEL }} />
        </Bar>
      </BarChart>
    );
  }
  // range
  return (
    <BarChart data={priceStats.bins} margin={{ left: 8, right: 16, top: 18 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={AXIS} interval={0} />
      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke={AXIS} width={40} />
      <Tooltip content={<RangeTip />} cursor={{ fill: "rgba(58,134,124,0.08)" }} />
      <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
        {priceStats.bins.map((_, i) => (
          <Cell key={i} fill={i % 2 ? TEAL_BRIGHT : TEAL} />
        ))}
        <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: LABEL }} />
      </Bar>
    </BarChart>
  );
}

function table(kind, title, { monthsData, communities, priceStats }) {
  if (kind === "median")
    return {
      rows: monthsData,
      columns: [
        { label: "Month", value: (d) => d.monthFull },
        { label: "Median sale price", value: (d) => (d.median == null ? "No sales" : money(d.median)) },
      ],
    };
  if (kind === "sales")
    return {
      rows: monthsData,
      columns: [
        { label: "Month", value: (d) => d.monthFull },
        { label: "Sales", value: (d) => (d.sales ?? 0).toLocaleString() },
      ],
    };
  if (kind === "community")
    return {
      rows: communities.slice(0, 12),
      columns: [
        { label: "Community", value: (d) => `${d.label}, ${d.county} County` },
        { label: "Sales", value: (d) => d.count },
      ],
    };
  return {
    rows: priceStats.bins,
    columns: [
      { label: "Price range", value: (d) => d.label },
      { label: "Sales", value: (d) => d.count },
    ],
  };
}

export default function KpiDetailChart({ kind, title, monthsData, communities, priceStats }) {
  const data = { monthsData, communities, priceStats };
  const t = table(kind, title, data);
  return (
    <>
      <div className="chart-visual" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {visual({ kind, ...data })}
        </ResponsiveContainer>
      </div>
      <ChartDataTable caption={title} columns={t.columns} rows={t.rows} />
    </>
  );
}
