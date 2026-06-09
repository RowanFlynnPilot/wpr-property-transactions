import { useEffect, useMemo, useRef, useState } from "react";
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
import Sparkline from "./Sparkline.jsx";
import { money, moneyCompact, pctChange, fmtPct, muniLabel, shortMuni } from "../lib/format.js";
import { matchesUse } from "../lib/use.js";
import { useCountUp } from "../lib/useCountUp.js";

const TEAL = "#3a867c";
const TEAL_BRIGHT = "#4aaba7";
const AMBER = "#c8922e";
const LABEL = "#5a564d";

// Price-distribution buckets (whole dollars), open-ended top bucket. Mirrors the
// histogram in PriceCharts so the "typical price range" card reads consistently.
const BUCKETS = [
  [0, 100_000],
  [100_000, 200_000],
  [200_000, 300_000],
  [300_000, 500_000],
  [500_000, 1_000_000],
  [1_000_000, Infinity],
];
const bucketLabel = ([lo, hi]) =>
  hi === Infinity ? `${moneyCompact(lo)}+` : `${moneyCompact(lo)}–${moneyCompact(hi)}`;

function monthLong(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function monthAxis(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function Delta({ value }) {
  if (value == null) return null;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const glyph = value > 0 ? "▲" : value < 0 ? "▼" : "■";
  return (
    <span className={`delta ${dir}`}>
      {glyph} {fmtPct(value)}
    </span>
  );
}

function MoneyValue({ target }) {
  const v = useCountUp(target);
  return <span>{money(Math.round(v))}</span>;
}

function NumberValue({ target }) {
  const v = useCountUp(target);
  return <span>{Math.round(v).toLocaleString()}</span>;
}

function ExpandBtn({ onClick, label }) {
  return (
    <button
      type="button"
      className="kpi-expand"
      aria-label={`Expand ${label} chart`}
      title="Expand"
      onClick={onClick}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}

// Compact in-card visuals for the two live-feed cards (hand-rolled so they stay
// crisp at thumbnail size, like Sparkline).
function MiniHBars({ rows, max }) {
  return (
    <div className="kpi-minibars">
      {rows.map((r) => (
        <div className="kpi-minibar" key={r.key}>
          <span className="kpi-minibar-label">{r.short}</span>
          <span className="kpi-minibar-track">
            <span className="kpi-minibar-fill" style={{ width: `${max ? (r.count / max) * 100 : 0}%` }} />
          </span>
          <span className="kpi-minibar-val">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function MiniHistogram({ bins, max }) {
  return (
    <div className="kpi-minihist" aria-hidden="true">
      {bins.map((b, i) => (
        <span
          key={i}
          className="kpi-minihist-bar"
          style={{ height: `${max ? (b.count / max) * 100 : 0}%` }}
          title={`${b.label}: ${b.count}`}
        />
      ))}
    </div>
  );
}

// --- Pop-out detail tooltips ----------------------------------------------
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

// Premium market header: scope-aware (selected county or the whole region). The
// median + volume cards are driven by the 12-month history; the community + price
// range cards summarise the live 30-day feed. Each card's mini-chart expands into
// a full pop-out visual (in-flow, so it works embedded where the iframe
// auto-resizes its height and a fixed overlay would mis-position).
export default function KpiHero({ history, records, selectedCounty, use = "Overall", useGroup = "All" }) {
  const scopeName = selectedCounty ? `${selectedCounty} County` : "6-County Region";
  const useWord = use === "Overall" ? "" : `${use.toLowerCase()} `;
  const geoKey = selectedCounty || "Region";
  const [expanded, setExpanded] = useState(null);
  const detailRef = useRef(null);

  const stats = useMemo(() => {
    if (!history) return null;
    const months = history.months;
    const med = history.series[useGroup]?.[geoKey] ?? [];
    const cnt = history.counts[useGroup]?.[geoKey] ?? [];
    const last = months.length - 1;
    return {
      months,
      med,
      cnt,
      medianNow: med[last],
      mom: pctChange(med[last], med[last - 1]),
      yearChange: pctChange(med[last], med[0]),
      totalSales: cnt.reduce((a, b) => a + (b || 0), 0),
      latestLabel: monthLong(months[last]),
    };
  }, [history, useGroup, geoKey]);

  // Live 30-day feed scoped to the current county + use selection.
  const scoped = useMemo(
    () => records.filter((r) => (!selectedCounty || r.county === selectedCounty) && matchesUse(r, use)),
    [records, selectedCounty, use]
  );

  const communities = useMemo(() => {
    const m = new Map();
    for (const r of scoped) {
      const key = `${r.county}|${r.municipality}`;
      if (!m.has(key))
        m.set(key, { key, label: muniLabel(r.municipality), short: shortMuni(r.municipality), county: r.county, count: 0 });
      m.get(key).count += 1;
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [scoped]);

  const priceStats = useMemo(() => {
    const prices = scoped.map((r) => r.sale_price).sort((a, b) => a - b);
    if (!prices.length) return null;
    const q = (p) => prices[Math.min(prices.length - 1, Math.floor(p * prices.length))];
    const bins = BUCKETS.map((b) => ({
      label: bucketLabel(b),
      count: scoped.filter((r) => r.sale_price >= b[0] && r.sale_price < b[1]).length,
    }));
    return { p25: q(0.25), p50: q(0.5), p75: q(0.75), bins, count: prices.length };
  }, [scoped]);

  const monthsData = useMemo(
    () =>
      stats
        ? stats.months.map((mk, i) => ({
            month: monthAxis(mk),
            monthFull: monthLong(mk),
            median: stats.med[i],
            sales: stats.cnt[i],
          }))
        : [],
    [stats]
  );

  const detail = useMemo(() => {
    if (!expanded || !stats) return null;
    if (expanded === "median") {
      return {
        title: `Median ${useWord}sale price · ${scopeName} · 12-month trend`,
        node: (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthsData} margin={{ left: 8, right: 16, top: 8 }}>
              <defs>
                <linearGradient id="kpiMedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e6e0d2" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#b8b2a4" tickMargin={8} />
              <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 12 }} stroke="#b8b2a4" width={56} domain={["auto", "auto"]} />
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
          </ResponsiveContainer>
        ),
      };
    }
    if (expanded === "sales") {
      return {
        title: `Sales recorded · ${scopeName} · by month`,
        node: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthsData} margin={{ left: 8, right: 16, top: 18 }}>
              <CartesianGrid stroke="#e6e0d2" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#b8b2a4" tickMargin={8} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#b8b2a4" width={40} />
              <Tooltip content={<SeriesTip kind="sales" />} cursor={{ fill: "rgba(200,146,46,0.10)" }} />
              <Bar dataKey="sales" fill={AMBER} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="sales" position="top" style={{ fontSize: 11, fill: LABEL }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }
    if (expanded === "community" && communities.length) {
      const rows = communities.slice(0, 12);
      return {
        title: `Most active ${useWord}communities · ${scopeName} · last 30 days`,
        node: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 36, top: 4 }}>
              <CartesianGrid horizontal={false} stroke="#e6e0d2" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#b8b2a4" />
              <YAxis type="category" dataKey="short" width={112} tick={{ fontSize: 11 }} stroke="#b8b2a4" />
              <Tooltip content={<CommunityTip />} cursor={{ fill: "rgba(58,134,124,0.08)" }} />
              <Bar dataKey="count" fill={TEAL} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: LABEL }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }
    if (expanded === "range" && priceStats) {
      return {
        title: `Sale price distribution · ${scopeName} · last 30 days`,
        node: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceStats.bins} margin={{ left: 8, right: 16, top: 18 }}>
              <CartesianGrid stroke="#e6e0d2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#b8b2a4" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#b8b2a4" width={40} />
              <Tooltip content={<RangeTip />} cursor={{ fill: "rgba(58,134,124,0.08)" }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {priceStats.bins.map((_, i) => (
                  <Cell key={i} fill={i % 2 ? TEAL_BRIGHT : TEAL} />
                ))}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: LABEL }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }
    return null;
  }, [expanded, stats, monthsData, communities, priceStats, scopeName, useWord]);

  // Bring the pop-out into view on the standalone page (a no-op in the auto-height
  // embed, which simply grows to fit).
  useEffect(() => {
    if (detail && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [detail]);

  if (!stats) return null;

  const trend =
    stats.yearChange == null
      ? ""
      : `${scopeName}'s ${useWord}median sale price is ${stats.yearChange >= 0 ? "up" : "down"} ${fmtPct(
          stats.yearChange
        ).replace(/[+−-]/, "")} over the past year — ${money(stats.medianNow)} in ${stats.latestLabel}.`;

  const topCommunity = communities[0];

  return (
    <section className="kpi" aria-label="Market summary">
      <div className="kpi-head">
        <span className="kpi-scope">{scopeName}</span>
        {use !== "Overall" && <span className="kpi-use">{use}</span>}
        {trend && <p className="kpi-trend">{trend}</p>}
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <ExpandBtn onClick={() => setExpanded("median")} label="median price trend" />
          <div className="kpi-label">Median {useWord}sale price</div>
          <div className="kpi-value">
            <MoneyValue target={stats.medianNow} />
          </div>
          <div className="kpi-meta">
            {stats.mom != null && (
              <span className="kpi-deltawrap">
                <Delta value={stats.mom} /> <span className="kpi-sub">MoM</span>
              </span>
            )}
            {stats.yearChange != null && (
              <span className="kpi-deltawrap">
                <Delta value={stats.yearChange} /> <span className="kpi-sub">YoY</span>
              </span>
            )}
          </div>
          <div className="kpi-spark">
            <Sparkline values={stats.med} color={TEAL} />
          </div>
        </article>

        <article className="kpi-card">
          <ExpandBtn onClick={() => setExpanded("sales")} label="monthly sales" />
          <div className="kpi-label">Sales · past 12 months</div>
          <div className="kpi-value">
            <NumberValue target={stats.totalSales} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-sub">{Math.round(stats.totalSales / 12).toLocaleString()} / month avg</span>
          </div>
          <div className="kpi-spark">
            <Sparkline values={stats.cnt} color={AMBER} />
          </div>
        </article>

        <article className="kpi-card">
          {communities.length > 0 && (
            <ExpandBtn onClick={() => setExpanded("community")} label="most active communities" />
          )}
          <div className="kpi-label">Most active community · 30 days</div>
          {topCommunity ? (
            <>
              <div className="kpi-value kpi-value-text">{topCommunity.label}</div>
              <div className="kpi-meta">
                <span className="kpi-sub">
                  {topCommunity.count} {topCommunity.count === 1 ? "sale" : "sales"}
                  {selectedCounty ? "" : ` · ${topCommunity.county}`}
                </span>
              </div>
              <div className="kpi-spark">
                <MiniHBars rows={communities.slice(0, 3)} max={topCommunity.count} />
              </div>
            </>
          ) : (
            <div className="kpi-value">—</div>
          )}
        </article>

        <article className="kpi-card">
          {priceStats && <ExpandBtn onClick={() => setExpanded("range")} label="price distribution" />}
          <div className="kpi-label">Typical price range · 30 days</div>
          {priceStats ? (
            <>
              <div className="kpi-value kpi-value-range">
                {moneyCompact(priceStats.p25)}–{moneyCompact(priceStats.p75)}
              </div>
              <div className="kpi-meta">
                <span className="kpi-sub">middle 50% · median {moneyCompact(priceStats.p50)}</span>
              </div>
              <div className="kpi-spark">
                <MiniHistogram bins={priceStats.bins} max={Math.max(...priceStats.bins.map((b) => b.count))} />
              </div>
            </>
          ) : (
            <div className="kpi-value">—</div>
          )}
        </article>
      </div>

      {detail && (
        <div className="kpi-detail" ref={detailRef}>
          <div className="kpi-detail-head">
            <h3>{detail.title}</h3>
            <button className="kpi-detail-close" onClick={() => setExpanded(null)} aria-label="Close chart">
              ×
            </button>
          </div>
          <div className="kpi-detail-chart">{detail.node}</div>
        </div>
      )}
    </section>
  );
}
