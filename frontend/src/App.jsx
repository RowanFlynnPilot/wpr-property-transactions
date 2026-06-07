import { useEffect, useState } from "react";

// Scaffold shell only. Real UI (filterable table + price charts + Leaflet map)
// is built after the scrape feed shape is confirmed and editorial policy is set.
export default function App() {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}transactions.json`)
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed({ error: true }));
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", color: "var(--wpr-teal)" }}>
        Property Transactions
      </h1>
      <p>Marathon County, Wisconsin — recent recorded real estate transfers.</p>
      <pre style={{ fontFamily: "var(--font-data)", fontSize: 12 }}>
        {feed ? JSON.stringify(feed, null, 2) : "Loading feed…"}
      </pre>
    </main>
  );
}
