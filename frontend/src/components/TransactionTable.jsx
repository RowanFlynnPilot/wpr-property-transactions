import { money, prettyDate, shortMuni } from "../lib/format.js";

// Sortable table of the filtered records. Sort state lives in App so the header
// arrows stay in sync. Prices are mono-figure per the WPR data type convention.
const COLUMNS = [
  { key: "recorded_date", label: "Recorded", align: "left" },
  { key: "municipality", label: "Community", align: "left" },
  { key: "property_type", label: "Type", align: "left" },
  { key: "address", label: "Street / block", align: "left" },
  { key: "grantee", label: "Buyer", align: "left" },
  { key: "sale_price", label: "Price", align: "right" },
];

export default function TransactionTable({ records, sort, onSort }) {
  const arrow = (key) => (sort.key !== key ? "" : sort.dir === "asc" ? " ▲" : " ▼");

  if (!records.length) {
    return <p className="empty">No transactions match these filters.</p>;
  }

  return (
    <div className="table-wrap" role="region" aria-label="Transactions" tabIndex={0}>
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
          {records.map((r) => (
            <tr key={r.document_number}>
              <td>{prettyDate(r.recorded_date)}</td>
              <td>{shortMuni(r.municipality)}</td>
              <td>{r.property_type}</td>
              <td>{r.address || "—"}</td>
              <td className="party">{r.grantee}</td>
              <td className="num price">{money(r.sale_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
