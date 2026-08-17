import { useEffect, useState } from "react";
import { money, prettyDate, muniLabel } from "../lib/format.js";
import { useGroupOf } from "../lib/use.js";
import { typeLabel } from "../lib/propertyType.js";

// Sortable table of the filtered records. Sort state lives in App so the header
// arrows stay in sync. Prices are mono-figure per the WPR data type convention.
// Rows render in pages of PAGE — a month of records is 700+ rows, which made the
// embed a 70,000px page; readers who want everything still get it in one click.
const PAGE = 50;

const COLUMNS = [
  { key: "recorded_date", label: "Recorded", align: "left" },
  { key: "municipality", label: "Community", align: "left" },
  { key: "county", label: "County", align: "left" },
  { key: "property_use", label: "Use / type", align: "left" },
  { key: "address", label: "Address", align: "left" },
  { key: "grantor", label: "Seller", align: "left" },
  { key: "grantee", label: "Buyer", align: "left" },
  { key: "sale_price", label: "Price", align: "right" },
];

export default function TransactionTable({ records, sort, onSort }) {
  const arrow = (key) => (sort.key !== key ? "" : sort.dir === "asc" ? " ▲" : " ▼");

  const [limit, setLimit] = useState(PAGE);
  // A new filter/sort selection re-frames the question — restart from the top.
  useEffect(() => setLimit(PAGE), [records]);

  if (!records.length) {
    return <p className="empty">No transactions match these filters.</p>;
  }

  const shown = records.slice(0, limit);

  return (
    <>
    <div className="table-wrap txn-wrap" role="region" aria-label="Transactions" tabIndex={0}>
      <table className="txn-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.align === "right" ? "num" : ""}
                aria-sort={
                  sort.key === c.key
                    ? sort.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button type="button" onClick={() => onSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.document_number}>
              <td className="nowrap" data-label="Recorded">{prettyDate(r.recorded_date)}</td>
              <td data-label="Community">{muniLabel(r.municipality)}</td>
              <td className="nowrap" data-label="County">{r.county}</td>
              <td data-label="Use / type">
                <span className={`use-badge use-${useGroupOf(r.property_use).toLowerCase()}`}>
                  {r.property_use}
                </span>{" "}
                <span className="cell-sub">{typeLabel(r.property_type)}</span>
              </td>
              <td data-label="Address">{r.address || "—"}</td>
              <td className="party" data-label="Seller">{r.grantor}</td>
              <td className="party" data-label="Buyer">{r.grantee}</td>
              <td className="num price" data-label="Price">{money(r.sale_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {records.length > limit && (
      <div className="table-more">
        <button
          type="button"
          className="show-more"
          onClick={() => setLimit((l) => l + PAGE * 4)}
        >
          Show {Math.min(PAGE * 4, records.length - limit)} more
        </button>
        <button
          type="button"
          className="show-all"
          onClick={() => setLimit(records.length)}
        >
          Show all {records.length.toLocaleString()}
        </button>
        <span className="table-more-count">
          showing {shown.length.toLocaleString()} of {records.length.toLocaleString()}
        </span>
      </div>
    )}
    </>
  );
}
