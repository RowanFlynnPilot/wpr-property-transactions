import { shortMuni } from "../lib/format.js";

// Controlled filter bar. Owns no state itself — App holds the filter object and
// the derived option lists, so the table, charts, and map all react together.
export default function Filters({ options, filters, onChange, resultCount, totalCount }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <section className="filters" aria-label="Filter transactions">
      <div className="filter-field">
        <label htmlFor="f-muni">Community</label>
        <select
          id="f-muni"
          value={filters.municipality}
          onChange={(e) => set({ municipality: e.target.value })}
        >
          <option value="">All communities</option>
          {options.municipalities.map((m) => (
            <option key={m} value={m}>
              {shortMuni(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="f-type">Property type</label>
        <select
          id="f-type"
          value={filters.propertyType}
          onChange={(e) => set({ propertyType: e.target.value })}
        >
          <option value="">All types</option>
          {options.propertyTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="f-min">Min price</label>
        <select
          id="f-min"
          value={filters.minPrice}
          onChange={(e) => set({ minPrice: Number(e.target.value) })}
        >
          {[0, 50000, 100000, 200000, 300000, 500000, 1000000].map((p) => (
            <option key={p} value={p}>
              {p === 0 ? "Any" : `$${p.toLocaleString()}+`}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field filter-search">
        <label htmlFor="f-q">Search address or party</label>
        <input
          id="f-q"
          type="search"
          placeholder="e.g. Grand Ave, Wausau, a name…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </div>

      <div className="filter-meta">
        <span className="filter-count">
          {resultCount.toLocaleString()} of {totalCount.toLocaleString()}
        </span>
        <button
          type="button"
          className="filter-reset"
          onClick={() =>
            onChange({ municipality: "", propertyType: "", minPrice: 0, query: "" })
          }
        >
          Reset
        </button>
      </div>
    </section>
  );
}
