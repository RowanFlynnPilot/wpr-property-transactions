import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { money } from "../lib/format.js";

const TEAL = "#3a867c";
const AMBER = "#c8922e";

function moneyAxis(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1000)}k`;
}

function shortMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fullMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function signed(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + money(Math.abs(n));
}

function HistoryTooltip({ active, payload, label, countyName }) {
  if (!active || !payload?.length) return null;
  const overall = payload.find((p) => p.dataKey === "Overall")?.value;
  const county = payload.find((p) => p.dataKey === countyName)?.value;
  const count = payload.find((p) => p.dataKey === "count")?.value;
  const diff = county != null && overall != null ? county - overall : null;
  return (
    <div className="history-tip">
      <div className="history-tip-month">{label}</div>
      <div className="history-tip-row">
        <span className="tip-swatch" style={{ background: TEAL }} />
        Region overall<b>{overall == null ? "—" : money(overall)}</b>
      </div>
      <div className="history-tip-row">
        <span className="tip-swatch" style={{ background: AMBER }} />
        {countyName}<b>{county == null ? "—" : money(county)}</b>
      </div>
      {count != null && (
        <div className="history-tip-sub">
          {count} {county === 1 ? "sale" : "sales"} in {countyName}
        </div>
      )}
      {diff != null && (
        <div className={`history-tip-diff ${diff >= 0 ? "pos" : "neg"}`}>
          {countyName} {diff >= 0 ? "above" : "below"} region by {money(Math.abs(diff))}
        </div>
      )}
    </div>
  );
}

// Rolling 12-month median trend: the region-wide "Overall" line plus one
// user-selectable county, with a monthly data table (overall, county, difference)
// below — both driven by the same county selector. The newest month is partial.
export default function PriceHistoryChart({ history, useGroup = "All", use = "Overall" }) {
  const counties = history?.counties ?? [];
  // `picked` is empty until the user chooses; the effective county falls back to
  // the first one reactively (the component mounts before `history` loads, so a
  // useState initial value would be stuck empty).
  const [picked, setPicked] = useState("");
  const county = picked || counties[0] || "";
  const useWord = use === "Overall" ? "" : `${use.toLowerCase()} `;

  const data = useMemo(() => {
    if (!history) return [];
    const s = history.series[useGroup] ?? {};
    const c = history.counts[useGroup] ?? {};
    return history.months.map((mo, i) => ({
      key: mo,
      month: shortMonth(mo),
      Overall: s.Region?.[i] ?? null,
      [county]: s[county]?.[i] ?? null,
      count: c[county]?.[i] ?? 0,
    }));
  }, [history, county, useGroup]);

  // Non-zero, padded Y domain (rounded to $20k) so the trend fills the panel
  // instead of hugging the top — these are medians, clearly dollar-labeled.
  const domain = useMemo(() => {
    const vals = data.flatMap((d) => [d.Overall, d[county]]).filter((v) => v != null);
    if (!vals.length) return [0, "auto"];
    const lo = Math.floor(Math.min(...vals) / 20000) * 20000;
    const hi = Math.ceil(Math.max(...vals) / 20000) * 20000;
    return [Math.max(0, lo), hi];
  }, [data, county]);

  // Table rows oldest -> newest, matching the chart's left-to-right order.
  const rows = useMemo(
    () =>
      data.map((d, idx) => ({
        key: d.key,
        label: fullMonth(d.key),
        partial: idx === data.length - 1, // newest (last) row = current, still-accruing month
        overall: d.Overall,
        county: d[county],
        diff: d[county] != null && d.Overall != null ? d[county] - d.Overall : null,
      })),
    [data, county]
  );

  if (!history) return null;

  return (
    <section className="history" aria-label="12-month price trend">
      <div className="history-head">
        <h2>Median {useWord}sale price · 12-month trend</h2>
        <label className="history-pick">
          Compare county
          <select value={county} onChange={(e) => setPicked(e.target.value)}>
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
          <AreaChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
            <defs>
              <linearGradient id="gradOverall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.16} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCounty" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AMBER} stopOpacity={0.16} />
                <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e6e0d2" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#b8b2a4" tickMargin={8} />
            <YAxis
              domain={domain}
              tickFormatter={moneyAxis}
              tick={{ fontSize: 11 }}
              stroke="#b8b2a4"
              width={52}
            />
            <Tooltip content={<HistoryTooltip countyName={county} />} cursor={{ fill: "rgba(58,134,124,0.06)" }} />
            <Legend />
            <Area
              type="monotone"
              dataKey="Overall"
              name="Region overall"
              stroke={TEAL}
              strokeWidth={2.5}
              fill="url(#gradOverall)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey={county}
              name={`${county} median`}
              stroke={AMBER}
              strokeWidth={2.5}
              fill="url(#gradCounty)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Region overall</th>
              <th className="num">{county}</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  {r.label}
                  {r.partial && <span className="partial-tag"> · partial</span>}
                </td>
                <td className="num mono">{r.overall == null ? "—" : money(r.overall)}</td>
                <td className="num mono">{r.county == null ? "—" : money(r.county)}</td>
                <td className={`num mono diff ${r.diff == null ? "" : r.diff >= 0 ? "pos" : "neg"}`}>
                  {signed(r.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="history-foot">
        Median sale price of genuine sales ≥ $1,000, by month recorded. “Difference”
        is the county’s median minus the region-wide median. The most recent month is
        still accruing recordings.
      </p>
    </section>
  );
}
