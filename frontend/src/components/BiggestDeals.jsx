import { useMemo } from "react";
import { money, prettyDate, muniLabel } from "../lib/format.js";
import SponsorTag from "./SponsorTag.jsx";

// The month's top sales — the most screenshot-able thing on the page. Scoped to
// the selected county when one is active.
export default function BiggestDeals({ records, selectedCounty }) {
  const deals = useMemo(() => {
    const scoped = selectedCounty ? records.filter((r) => r.county === selectedCounty) : records;
    return [...scoped].sort((a, b) => b.sale_price - a.sale_price).slice(0, 6);
  }, [records, selectedCounty]);

  if (!deals.length) return null;

  return (
    <section className="deals" aria-label="Biggest deals">
      <div className="deals-head">
        <h2>
          Biggest deals · last 30 days{selectedCounty ? ` · ${selectedCounty} County` : ""}
        </h2>
        <SponsorTag />
      </div>
      <div className="deals-grid">
        {deals.map((d, i) => (
          <article className={`deal-card${i === 0 ? " deal-first" : ""}`} key={d.document_number}>
            <span className={`deal-rank${i === 0 ? " deal-rank-first" : ""}`} aria-label={`Rank ${i + 1}`}>
              {i + 1}
            </span>
            <div className="deal-top">
              <span className="deal-price">{money(d.sale_price)}</span>
            </div>
            <div className="deal-addr">{d.address || "—"}</div>
            <div className="deal-loc">
              {muniLabel(d.municipality)} · {d.county} Co.
            </div>
            <div className="deal-type">{d.property_type}</div>
            <div className="deal-parties">
              <span className="deal-party">{d.grantor}</span>
              <span className="deal-arrow">→</span>
              <span className="deal-party">{d.grantee}</span>
            </div>
            <div className="deal-date">Recorded {prettyDate(d.recorded_date)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
