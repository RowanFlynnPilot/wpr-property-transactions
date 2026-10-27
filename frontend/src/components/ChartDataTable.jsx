// The screen-reader equivalent of a chart. Charts are SVG drawings that convey
// nothing to assistive technology, so each one is marked aria-hidden and paired
// with this visually-hidden table holding the same numbers (WCAG 1.1.1).
// `columns` is [{ label, value: row => text }]; the first column labels the row.
export default function ChartDataTable({ caption, columns, rows }) {
  if (!rows?.length) return null;
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.label} scope="col">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {columns.map((c, j) =>
              j === 0 ? (
                <th key={c.label} scope="row">
                  {c.value(r)}
                </th>
              ) : (
                <td key={c.label}>{c.value(r)}</td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
