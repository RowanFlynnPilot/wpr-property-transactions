import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { median, money, moneyCompact, pctChange, fmtPct } from "../lib/format.js";

const TYPE_COLORS = ["#3a867c", "#4aaba7", "#c8922e", "#32373c", "#9ab8b1"];
const TYPE_LABEL = {
  "Land and buildings/improvements": "Land & buildings",
  "Buildings/improvements only": "Buildings only",
  "Land only": "Land only",
  Condominium: "Condominium",
};
const typeLabel = (t) => TYPE_LABEL[t] || t;

function monthShort(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function signedMoney(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + money(Math.abs(n));
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{d.name}</div>
      <div className="chart-tip-row">
        Sales<b>{d.value.toLocaleString()}</b>
      </div>
      <div className="chart-tip-sub">{pct}% of sales</div>
    </div>
  );
}

export default function MarketBreakdown({ records, history }) {
  const byType = useMemo(() => {
    const counts = new Map();
    for (const r of records) counts.set(r.property_type, (counts.get(r.property_type) || 0) + 1);
    return [...counts.entries()]
      .map(([type, value]) => ({ name: typeLabel(type), value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const total = byType.reduce((a, b) => a + b.value, 0);

  const { rows, curMonth } = useMemo(() => {
    if (!history) return { rows: [], curMonth: "" };
    const last = history.months.length - 1;
    const rows = (history.counties ?? [])
      .map((c) => {
        const s = history.series[c] ?? [];
        const cnt = history.counts[c] ?? [];
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
  }, [history]);

  if (!records.length) return null;

  return (
    <section className="breakdown" aria-label="Market breakdown">
      {rows.length > 0 && (
        <figure className="breakdown-card county-detail">
          <figcaption>County market detail · trailing 12 months</figcaption>
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
        <figcaption>Sales by property type</figcaption>
        <div className="donut-row">
          <div className="donut-body">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-total">{total.toLocaleString()}</div>
              <div className="donut-total-label">sales</div>
            </div>
          </div>
          <ul className="donut-legend">
            {byType.map((d, i) => (
              <li key={d.name}>
                <span className="lg-swatch" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                {d.name}
                <span className="lg-val">
                  {d.value.toLocaleString()} · {total ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </figure>
    </section>
  );
}
