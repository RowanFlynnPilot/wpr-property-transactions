import { useEffect, useMemo, useState } from "react";
import SummaryStats from "./components/SummaryStats.jsx";
import Filters from "./components/Filters.jsx";
import TransactionTable from "./components/TransactionTable.jsx";
import PriceCharts from "./components/PriceCharts.jsx";
import MunicipalityMap from "./components/MunicipalityMap.jsx";

const EMPTY_FILTERS = { municipality: "", propertyType: "", minPrice: 0, query: "" };
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
      municipalities: [...new Set(all.map((r) => r.municipality))].sort(),
      propertyTypes: [...new Set(all.map((r) => r.property_type))].sort(),
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = all.filter(
      (r) =>
        (!filters.municipality || r.municipality === filters.municipality) &&
        (!filters.propertyType || r.property_type === filters.propertyType) &&
        r.sale_price >= filters.minPrice &&
        (!q ||
          r.address.toLowerCase().includes(q) ||
          r.municipality.toLowerCase().includes(q) ||
          r.grantor.toLowerCase().includes(q) ||
          r.grantee.toLowerCase().includes(q))
    );
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }, [all, filters, sort]);

  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "sale_price" ? "desc" : "asc" }
    );

  if (error) {
    return (
      <main className="page">
        <p className="empty">Couldn’t load the transactions feed. Please try again later.</p>
      </main>
    );
  }

  if (!feed) {
    return (
      <main className="page">
        <p className="empty">Loading transactions…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Property Transactions</h1>
        <p className="dek">
          Recent recorded real estate sales in Marathon County, Wisconsin. Source:
          Wisconsin Department of Revenue Real Estate Transfer Returns. Addresses are
          shown to the street or block only.
        </p>
      </header>

      <SummaryStats records={filtered} generatedOn={feed.generated_on} />
      <PriceCharts records={filtered} />
      <MunicipalityMap records={filtered} />

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
  );
}
