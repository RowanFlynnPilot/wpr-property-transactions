import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { median, money, shortMuni } from "../lib/format.js";
import { MUNI_CENTROIDS, REGION_CENTER, REGION_ZOOM } from "../lib/municipalities.js";

// Case-insensitive centroid index: DOR and Census disagree on some capitalization
// (e.g. DOR "Mcmillan" vs Census "McMillan"), so match on lowercased keys.
const CENTROIDS_LC = Object.fromEntries(
  Object.entries(MUNI_CENTROIDS).map(([k, v]) => [k.toLowerCase(), v])
);

// Community-level map across the coverage area: one circle per municipality, sized
// by sale count, with median price in the tooltip. Per the editorial policy there
// are NO per-record coordinates in the feed — this aggregates by (county,
// municipality) and places markers at Census municipal centroids. Municipality
// names repeat across counties, so points are keyed by "county|municipality".
function radiusFor(count, max) {
  // sqrt scale so area ~ count; clamp to a legible range.
  return 6 + 22 * Math.sqrt(count / max);
}

export default function MunicipalityMap({ records, selectedKey, onSelect }) {
  const { points, missing } = useMemo(() => {
    const groups = new Map();
    for (const r of records) {
      const key = `${r.county}|${r.municipality}`;
      if (!groups.has(key)) groups.set(key, { county: r.county, muni: r.municipality, prices: [] });
      groups.get(key).prices.push(r.sale_price);
    }
    const points = [];
    const missing = [];
    for (const [key, g] of groups) {
      const center = CENTROIDS_LC[key.toLowerCase()];
      const entry = { key, county: g.county, muni: g.muni, count: g.prices.length, medianPrice: median(g.prices) };
      if (center) points.push({ ...entry, center });
      else missing.push(entry);
    }
    return { points, missing };
  }, [records]);

  const maxCount = points.reduce((m, p) => Math.max(m, p.count), 1);

  return (
    <section className="map-section" aria-label="Transactions by community">
      <h2>Where the sales were</h2>
      <p className="map-hint">
        Bubble size shows the number of sales. {onSelect && "Click a community to filter the page to it."}
      </p>
      <div className="map-wrap">
        <MapContainer
          center={REGION_CENTER}
          zoom={REGION_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => {
            const isSelected = p.key === selectedKey;
            return (
              <CircleMarker
                key={p.key}
                center={p.center}
                radius={radiusFor(p.count, maxCount)}
                eventHandlers={onSelect ? { click: () => onSelect(p.county, p.muni) } : undefined}
                pathOptions={{
                  color: isSelected ? "#2f6f66" : "#3a867c",
                  fillColor: isSelected ? "#2f6f66" : "#4aaba7",
                  fillOpacity: isSelected ? 0.85 : 0.55,
                  weight: isSelected ? 3 : 1.5,
                }}
              >
                <Tooltip direction="top">
                  <strong>{shortMuni(p.muni)}</strong> · {p.county} Co.
                  <br />
                  {p.count} {p.count === 1 ? "sale" : "sales"} · median {money(p.medianPrice)}
                  {onSelect && (
                    <>
                      <br />
                      <em>{isSelected ? "Click to clear filter" : "Click to filter"}</em>
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      {missing.length > 0 && (
        <p className="map-missing">
          Not mapped (no centroid on file):{" "}
          {missing.map((m) => `${shortMuni(m.muni)} (${m.count})`).join(", ")}
        </p>
      )}
    </section>
  );
}
