import { useMemo } from "react";
import Sparkline from "./Sparkline.jsx";
import { money, moneyCompact, pctChange, fmtPct, muniLabel } from "../lib/format.js";
import { useCountUp } from "../lib/useCountUp.js";

const TEAL = "#3a867c";
const AMBER = "#c8922e";

function monthShort(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

// Premium market header: scope-aware (selected county or the whole region),
// driven by the 12-month history (sparklines + deltas) plus the live feed (top
// sale). The median is robust even for the partial current month; the volume card
// uses the 12-month total to avoid the partial-month dip.
export default function KpiHero({ history, records, selectedCounty }) {
  const scopeName = selectedCounty ? `${selectedCounty} County` : "6-County Region";
  const seriesKey = selectedCounty || "Overall";

  const stats = useMemo(() => {
    if (!history) return null;
    const months = history.months;
    const med = history.series[seriesKey] ?? [];
    const cnt = history.counts[seriesKey] ?? [];
    const last = months.length - 1;
    const medianNow = med[last];
    const mom = pctChange(med[last], med[last - 1]);
    const yearChange = pctChange(med[last], med[0]);
    const totalSales = cnt.reduce((a, b) => a + (b || 0), 0);
    return {
      months,
      med,
      cnt,
      medianNow,
      mom,
      yearChange,
      totalSales,
      latestLabel: monthShort(months[last]),
      firstLabel: monthShort(months[0]),
    };
  }, [history, seriesKey]);

  const topSale = useMemo(() => {
    const scoped = selectedCounty ? records.filter((r) => r.county === selectedCounty) : records;
    return scoped.reduce((best, r) => (best && best.sale_price >= r.sale_price ? best : r), null);
  }, [records, selectedCounty]);

  if (!stats) return null;

  const trend =
    stats.yearChange == null
      ? ""
      : `${scopeName}'s median sale price is ${stats.yearChange >= 0 ? "up" : "down"} ${fmtPct(
          stats.yearChange
        ).replace(/[+−-]/, "")} over the past year — ${money(stats.medianNow)} in ${stats.latestLabel}.`;

  return (
    <section className="kpi" aria-label="Market summary">
      <div className="kpi-head">
        <span className="kpi-scope">{scopeName}</span>
        {trend && <p className="kpi-trend">{trend}</p>}
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-label">Median sale price</div>
          <div className="kpi-value">
            <MoneyValue target={stats.medianNow} />
          </div>
          <div className="kpi-meta">
            <Delta value={stats.mom} /> <span className="kpi-sub">vs. prior month</span>
          </div>
          <div className="kpi-spark">
            <Sparkline values={stats.med} color={TEAL} />
          </div>
        </article>

        <article className="kpi-card">
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
          <div className="kpi-label">Median, past 12 months</div>
          <div className={`kpi-value kpi-change ${stats.yearChange >= 0 ? "up" : "down"}`}>
            {fmtPct(stats.yearChange)}
          </div>
          <div className="kpi-meta">
            <span className="kpi-sub">
              {moneyCompact(stats.med[0])} → {moneyCompact(stats.medianNow)}
            </span>
          </div>
          <div className="kpi-spark">
            <Sparkline values={stats.med} color={stats.yearChange >= 0 ? "#2f8f5f" : "#c0492f"} />
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-label">Top sale · last 30 days</div>
          <div className="kpi-value">
            {topSale ? <MoneyValue target={topSale.sale_price} /> : "—"}
          </div>
          <div className="kpi-meta">
            {topSale && (
              <span className="kpi-sub kpi-topsale">
                {topSale.address} · {muniLabel(topSale.municipality)}
              </span>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
