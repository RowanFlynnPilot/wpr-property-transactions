import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { median, money, moneyCompact, monthShort, pctChange, fmtPct, signedMoney } from "../lib/format.js";
import { DONUT_COLORS } from "../lib/palette.js";
import { latestIndexWithData } from "../lib/history.js";
import { typeLabel, useLabel } from "../lib/propertyType.js";


function DonutTooltip({ active, payload, mode, total }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const val = mode === "dollars" ? d.dollars : d.count;
  const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{d.name}</div>
      <div className="chart-tip-row">
        Sales<b>{d.count.toLocaleString()}</b>
      </div>
      <div className="chart-tip-row">
        Volume<b>{money(d.dollars)}</b>
      </div>
      <div className="chart-tip-sub">
        {pct}% of {mode === "dollars" ? "sales dollars" : "sales"}
      </div>
    </div>
  );
}

export default function MarketBreakdown({ records, history, useGroup = "All", use = "Overall" }) {
  const useWord = use === "Overall" ? "" : `${use.toLowerCase()} `;
  // 'count' = number of sales; 'dollars' = total sale-price volume.
  const [mode, setMode] = useState("count");
  // 'type' = structure (land/buildings/condo); 'use' = DOR category (Single
  // family, Commercial, Agricultural, …).
  const [dim, setDim] = useState("type");

  // Aggregate, then lock a stable color to each slice by its count rank — so a
  // category keeps its color when you flip the metric; only the order changes.
  const groups = useMemo(() => {
    const agg = new Map();
    for (const r of records) {
      const key = dim === "type" ? r.property_type : r.property_use;
      const cur = agg.get(key) || { count: 0, dollars: 0 };
      cur.count += 1;
      cur.dollars += r.sale_price;
      agg.set(key, cur);
    }
    const label = dim === "type" ? typeLabel : useLabel;
    const items = [...agg.entries()].map(([key, v]) => ({
      name: label(key),
      count: v.count,
      dollars: v.dollars,
    }));
    items.sort((a, b) => b.count - a.count);
    items.forEach((it, i) => {
      it.color = DONUT_COLORS[i % DONUT_COLORS.length];
    });
    return items;
  }, [records, dim]);

  const dataKey = mode === "dollars" ? "dollars" : "count";
  const totalCount = groups.reduce((a, b) => a + b.count, 0);
  const totalDollars = groups.reduce((a, b) => a + b.dollars, 0);
  const total = mode === "dollars" ? totalDollars : totalCount;

  // Display order follows the selected metric, descending.
  const ordered = useMemo(
    () => [...groups].sort((a, b) => b[dataKey] - a[dataKey]),
    [groups, dataKey]
  );

  const { rows, curMonth } = useMemo(() => {
    if (!history) return { rows: [], curMonth: "" };
    // Report the latest month with data region-wide, so the column isn't a wall
    // of "—" when the newest month hasn't accrued any recordings yet.
    const last = latestIndexWithData(history.series[useGroup]?.Region ?? []);
    if (last < 0) return { rows: [], curMonth: "" };
    const rows = (history.counties ?? [])
      .map((c) => {
        const s = history.series[useGroup]?.[c] ?? [];
        const cnt = history.counts[useGroup]?.[c] ?? [];
        const median12 = median(s.filter((v) => v != null));
        const curMedian = s[last];
        return {
          county: c,
          median12,
          totalSales: cnt.reduce((a, b) => a + (b || 0), 0),
          curMedian,
          curSales: cnt[last] ?? 0,
          diffDollar: curMedian != null && median12 != null ? curMedian - median12 : null,
          diffPct: pctChange(curMedian, median12),
        };
      })
      .sort((a, b) => b.median12 - a.median12);
    return { rows, curMonth: monthShort(history.months[last]) };
  }, [history, useGroup]);

  if (!records.length) return null;

  return (
    <section className="breakdown" aria-label="Market breakdown">
      {rows.length > 0 && (
        <figure className="breakdown-card county-detail">
          <figcaption>County {useWord}market detail · trailing 12 months</figcaption>
          <div className="table-wrap">
            <table className="county-table">
              <thead>
                <tr>
                  <th>County</th>
                  <th className="num">12-mo median</th>
                  <th className="num">12-mo sales</th>
                  <th className="num">{curMonth} median</th>
                  <th className="num">{curMonth} sales</th>
                  <th className="num">Δ vs 12-mo</th>
                  <th className="num">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const up = (r.diffDollar ?? 0) >= 0;
                  return (
                    <tr key={r.county}>
                      <td>{r.county}</td>
                      <td className="num mono">{money(r.median12)}</td>
                      <td className="num mono">{r.totalSales.toLocaleString()}</td>
                      <td className="num mono">{r.curMedian == null ? "—" : money(r.curMedian)}</td>
                      <td className="num mono">{r.curSales.toLocaleString()}</td>
                      <td className={`num mono diff ${r.diffDollar == null ? "" : up ? "pos" : "neg"}`}>
                        {signedMoney(r.diffDollar)}
                      </td>
                      <td className={`num mono diff ${r.diffPct == null ? "" : up ? "pos" : "neg"}`}>
                        {fmtPct(r.diffPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="movers-foot">
            “12-mo median” is the median of the trailing 12 monthly medians; Δ compares the
            current month to it. The current month is still accruing recordings.
          </p>
        </figure>
      )}

      <figure className="breakdown-card breakdown-donut">
        <figcaption className="donut-cap">
          <span>Sales by {dim === "type" ? "property type" : "category"}</span>
          <span className="donut-toggles">
            <span className="donut-toggle" role="group" aria-label="Group by">
              <button
                type="button"
                className={dim === "type" ? "active" : ""}
                aria-pressed={dim === "type"}
                onClick={() => setDim("type")}
              >
                Type
              </button>
              <button
                type="button"
                className={dim === "use" ? "active" : ""}
                aria-pressed={dim === "use"}
                onClick={() => setDim("use")}
              >
                Category
              </button>
            </span>
            <span className="donut-toggle" role="group" aria-label="Metric">
              <button
                type="button"
                className={mode === "count" ? "active" : ""}
                aria-pressed={mode === "count"}
                onClick={() => setMode("count")}
              >
                By count
              </button>
              <button
                type="button"
                className={mode === "dollars" ? "active" : ""}
                aria-pressed={mode === "dollars"}
                onClick={() => setMode("dollars")}
              >
                By $ volume
              </button>
            </span>
          </span>
        </figcaption>
        <div className="donut-row">
          <div className="donut-body">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ordered}
                  dataKey={dataKey}
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {ordered.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip mode={mode} total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-total">
                {mode === "dollars" ? moneyCompact(totalDollars) : totalCount.toLocaleString()}
              </div>
              <div className="donut-total-label">{mode === "dollars" ? "in sales" : "sales"}</div>
            </div>
          </div>
          <ul className="donut-legend">
            {ordered.map((d) => {
              const val = mode === "dollars" ? d.dollars : d.count;
              const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
              return (
                <li key={d.name}>
                  <span className="lg-swatch" style={{ background: d.color }} />
                  {d.name}
                  <span className="lg-val">
                    {mode === "dollars" ? money(d.dollars) : d.count.toLocaleString()} · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </figure>
    </section>
  );
}
