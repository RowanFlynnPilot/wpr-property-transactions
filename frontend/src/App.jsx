import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Masthead from "./components/Masthead.jsx";
import SummaryStats from "./components/SummaryStats.jsx";
import Filters from "./components/Filters.jsx";
import TransactionTable from "./components/TransactionTable.jsx";
import PriceCharts from "./components/PriceCharts.jsx";
import PriceHistoryChart from "./components/PriceHistoryChart.jsx";
import { weekStartISO, weekLabel } from "./lib/format.js";

// The Leaflet map is the heaviest dependency and sits below the fold, so it's
// code-split: the initial bundle excludes Leaflet and the map chunk streams in
// after first paint, behind a placeholder that reserves its height.
const MunicipalityMap = lazy(() => import("./components/MunicipalityMap.jsx"));

const EMPTY_FILTERS = {
  week: "",
  county: "",
  municipality: "",
  propertyType: "",
  minPrice: 0,
  query: "",
};
const DEFAULT_SORT = { key: "sale_price", dir: "desc" };

export default function App() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(null);
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
    // Price history is optional — the page works without it (graceful null).
    fetch(`${import.meta.env.BASE_URL}price_history.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setHistory)
      .catch(() => setHistory(null));
  }, []);

  const all = feed?.transactions ?? [];

  const options = useMemo(
    () => ({
      // Weeks present in the feed, newest first, as { value: weekStartISO, label }.
      weeks: [...new Set(all.map((r) => weekStartISO(r.recorded_date)))]
        .sort()
        .reverse()
        .map((s) => ({ value: s, label: weekLabel(s) })),
      counties: [...new Set(all.map((r) => r.county))].sort(),
      propertyTypes: [...new Set(all.map((r) => r.property_type))].sort(),
    }),
    [all]
  );

  // Community options are scoped to the selected county — municipality names repeat
  // across counties, so a community filter is only meaningful within one.
  const municipalities = useMemo(() => {
    const scoped = filters.county ? all.filter((r) => r.county === filters.county) : all;
    return [...new Set(scoped.map((r) => r.municipality))].sort();
  }, [all, filters.county]);

  // Filtering is layered: base (non-geographic) -> + county -> + municipality.
  // Each viz reads the layer that keeps it useful: the county chart sees all
  // counties (base), the community chart + map see the selected county (noMuni),
  // and the table/stats see the full selection (filtered).
  const base = useMemo(() => {
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

  const filteredNoMuni = useMemo(
    () => (filters.county ? base.filter((r) => r.county === filters.county) : base),
    [base, filters.county]
  );

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

  // Click a county bar to focus on that county (clears any community); click the
  // selected one again to clear.
  const selectCounty = (c) =>
    setFilters((f) =>
      f.county === c
        ? { ...f, county: "", municipality: "" }
        : { ...f, county: c, municipality: "" }
    );

  // Click a map bubble to focus the dashboard on that community (county +
  // municipality); click the already-selected one again to clear the community.
  const selectMapPoint = (county, muni) =>
    setFilters((f) =>
      f.county === county && f.municipality === muni
        ? { ...f, municipality: "" }
        : { ...f, county, municipality: muni }
    );

  const selectedKey =
    filters.county && filters.municipality
      ? `${filters.county}|${filters.municipality}`
      : null;

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
            Real estate sales recorded across Marathon, Lincoln, Langlade, Taylor,
            Shawano, and Portage counties, Wisconsin over the past month — property
            address, seller, buyer, and sale price. Source: Wisconsin Department of
            Revenue Real Estate Transfer Returns. Use the filters to focus on a county,
            community, or week.
          </p>
        </header>

      <SummaryStats records={filtered} generatedOn={feed.generated_on} />
      <PriceHistoryChart history={history} />
      <PriceCharts
        records={filtered}
        communityRecords={filteredNoMuni}
        countyRecords={base}
        selected={filters.municipality}
        selectedCounty={filters.county}
        onSelectCounty={selectCounty}
      />
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
          selectedKey={selectedKey}
          onSelect={selectMapPoint}
        />
      </Suspense>

      <h2>All transactions</h2>
      <Filters
        options={{ ...options, municipalities }}
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
