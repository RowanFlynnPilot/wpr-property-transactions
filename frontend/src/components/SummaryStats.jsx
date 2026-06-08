import { money, median, prettyDate } from "../lib/format.js";

// Headline figures for the current (filtered) result set. The median is the
// honest center for sale prices — a single $3.75M sale would badly skew a mean.
export default function SummaryStats({ records, generatedOn }) {
  if (!records.length) return null;

  const prices = records.map((r) => r.sale_price);
  const dates = records.map((r) => r.recorded_date).sort();
  const munis = new Set(records.map((r) => r.municipality)).size;
  const volume = prices.reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Transactions", value: records.length.toLocaleString() },
    { label: "Median price", value: money(median(prices)) },
    { label: "Total volume", value: money(volume) },
    { label: "Communities", value: munis },
  ];

  return (
    <section className="stats" aria-label="Summary statistics">
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="stats-window">
        Recorded {prettyDate(dates[0])} – {prettyDate(dates[dates.length - 1])}
        {generatedOn && <> · feed updated {prettyDate(generatedOn)}</>}
      </p>
    </section>
  );
}
