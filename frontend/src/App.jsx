import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Masthead from "./components/Masthead.jsx";
import SummaryStats from "./components/SummaryStats.jsx";
import Filters from "./components/Filters.jsx";
import TransactionTable from "./components/TransactionTable.jsx";
import PriceCharts from "./components/PriceCharts.jsx";
import { weekStartISO, weekLabel } from "./lib/format.js";

// The Leaflet map is the heaviest dependency and sits below the fold, so it's
// code-split: the initial bundle excludes Leaflet and the map chunk streams in
// after first paint, behind a placeholder that reserves its height.
const MunicipalityMap = lazy(() => import("./components/MunicipalityMap.jsx"));

const EMPTY_FILTERS = { week: "", municipality: "", propertyType: "", minPrice: 0, query: "" };
const DEFAULT_SORT = { key: "sale_price", dir: "desc" };

export default function App() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}transactions.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`feed ${r.status}`);
        return r.json();
      })
      .then(setFeed)
      .catch(() => setError(true));
  }, []);

  const all = feed?.transactions ?? [];

  const options = useMemo(
    () => ({
      // Weeks present in the feed, newest first, as { value: weekStartISO, label }.
      weeks: [...new Set(all.map((r) => weekStartISO(r.recorded_date)))]
        .sort()
        .reverse()
        .map((s) => ({ value: s, label: weekLabel(s) })),
      municipalities: [...new Set(all.map((r) => r.municipality))].sort(),
      propertyTypes: [...new Set(all.map((r) => r.property_type))].sort(),
    }),
    [all]
  );

  // Everything EXCEPT the community filter. The map is driven by this so it stays
  // a full navigator (all communities clickable) while the table/stats/charts
  // narrow to the selected one.
  const filteredNoMuni = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!filters.week || weekStartISO(r.recorded_date) === filters.week) &&
        (!filters.propertyType || r.property_type === filters.propertyType) &&
        r.sale_price >= filters.minPrice &&
        (!q ||
          r.address.toLowerCase().includes(q) ||
          r.municipality.toLowerCase().includes(q) ||
          r.grantor.toLowerCase().includes(q) ||
          r.grantee.toLowerCase().includes(q))
    );
  }, [all, filters.week, filters.propertyType, filters.minPrice, filters.query]);

  const filtered = useMemo(() => {
    const rows = filters.municipality
      ? filteredNoMuni.filter((r) => r.municipality === filters.municipality)
      : filteredNoMuni;
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }, [filteredNoMuni, filters.municipality, sort]);

  // Click a map bubble to focus the dashboard on that community; click the
  // already-selected one again to clear.
  const selectMunicipality = (m) =>
    setFilters((f) => ({ ...f, municipality: f.municipality === m ? "" : m }));

  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "sale_price" ? "desc" : "asc" }
    );

  if (error) {
    return (
      <>
        <Masthead />
        <main className="page">
          <p className="empty">Couldn’t load the transactions feed. Please try again later.</p>
        </main>
      </>
    );
  }

  if (!feed) {
    return (
      <>
        <Masthead />
        <main className="page">
          <p className="empty">Loading transactions…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Masthead />
      <main className="page">
        <header className="masthead">
          <h1>Property Transactions</h1>
          <p className="dek">
            Real estate sales recorded in Marathon County, Wisconsin over the past
            month. Source: Wisconsin Department of Revenue Real Estate Transfer
            Returns. Addresses are shown to the street or block only — use the Week
            filter to focus on a single week.
          </p>
        </header>

      <SummaryStats records={filtered} generatedOn={feed.generated_on} />
      <PriceCharts records={filtered} />
      <Suspense
        fallback={
          <section className="map-section">
            <h2>Where the sales were</h2>
            <div className="map-wrap map-loading">Loading map…</div>
          </section>
        }
      >
        <MunicipalityMap
          records={filteredNoMuni}
          selected={filters.municipality}
          onSelect={selectMunicipality}
        />
      </Suspense>

      <h2>All transactions</h2>
      <Filters
        options={options}
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        totalCount={all.length}
      />
      <TransactionTable records={filtered} sort={sort} onSort={onSort} />

      <footer className="colophon">
        Recorded transfers reflect a lag of days to weeks between sale, recording, and
        DOR posting. Non–arm’s-length and nominal transfers are excluded; only genuine
        sales of $1,000 or more are shown. A Wausau Pilot &amp; Review civic-data tool.
      </footer>
      </main>
    </>
  );
}
