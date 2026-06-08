import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { pctChange, fmtPct } from "../lib/format.js";

const TYPE_COLORS = ["#3a867c", "#4aaba7", "#c8922e", "#32373c", "#9ab8b1"];
const TYPE_LABEL = {
  "Land and buildings/improvements": "Land & buildings",
  "Buildings/improvements only": "Buildings only",
  "Land only": "Land only",
  Condominium: "Condominium",
};
const typeLabel = (t) => TYPE_LABEL[t] || t;

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

  const movers = useMemo(() => {
    if (!history) return [];
    const last = history.months.length - 1;
    return (history.counties ?? [])
      .map((c) => {
        const s = history.series[c] ?? [];
        return { county: c, change: pctChange(s[last], s[0]) };
      })
      .filter((m) => m.change != null)
      .sort((a, b) => b.change - a.change);
  }, [history]);

  const maxAbs = Math.max(0.0001, ...movers.map((m) => Math.abs(m.change)));

  if (!records.length) return null;

  return (
    <section className="breakdown" aria-label="Market breakdown">
      <figure className="breakdown-card breakdown-donut">
        <figcaption>Sales by property type</figcaption>
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
              <span className="lg-val">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </figure>

      <figure className="breakdown-card breakdown-movers">
        <figcaption>12-month change by county</figcaption>
        <ul className="movers">
          {movers.map((m) => {
            const up = m.change >= 0;
            return (
              <li key={m.county}>
                <span className="mover-name">{m.county}</span>
                <span className="mover-track">
                  <span
                    className={`mover-fill ${up ? "up" : "down"}`}
                    style={{ width: `${(Math.abs(m.change) / maxAbs) * 100}%` }}
                  />
                </span>
                <span className={`mover-val ${up ? "up" : "down"}`}>{fmtPct(m.change)}</span>
              </li>
            );
          })}
        </ul>
        <p className="movers-foot">Median sale price, most recent month vs. 12 months ago.</p>
      </figure>
    </section>
  );
}
