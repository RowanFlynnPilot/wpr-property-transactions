import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { median, money, shortMuni } from "../lib/format.js";
import { MUNI_CENTROIDS, MARATHON_CENTER } from "../lib/municipalities.js";

// Community-level map: one circle per municipality, sized by sale count, with
// median price in the tooltip. Per the editorial policy there are NO per-record
// coordinates in the feed — this aggregates by `municipality` and places markers
// at approximate municipal centroids. Municipalities without a known centroid are
// listed below the map rather than dropped silently.
function radiusFor(count, max) {
  // sqrt scale so area ~ count; clamp to a legible range.
  return 6 + 22 * Math.sqrt(count / max);
}

export default function MunicipalityMap({ records }) {
  const { points, missing } = useMemo(() => {
    const groups = new Map();
    for (const r of records) {
      if (!groups.has(r.municipality)) groups.set(r.municipality, []);
      groups.get(r.municipality).push(r.sale_price);
    }
    const points = [];
    const missing = [];
    for (const [muni, prices] of groups) {
      const center = MUNI_CENTROIDS[muni];
      if (center) {
        points.push({ muni, center, count: prices.length, medianPrice: median(prices) });
      } else {
        missing.push({ muni, count: prices.length });
      }
    }
    return { points, missing };
  }, [records]);

  const maxCount = points.reduce((m, p) => Math.max(m, p.count), 1);

  return (
    <section className="map-section" aria-label="Transactions by community">
      <h2>Where the sales were</h2>
      <div className="map-wrap">
        <MapContainer
          center={MARATHON_CENTER}
          zoom={9}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => (
            <CircleMarker
              key={p.muni}
              center={p.center}
              radius={radiusFor(p.count, maxCount)}
              pathOptions={{ color: "#3a867c", fillColor: "#4aaba7", fillOpacity: 0.55, weight: 1.5 }}
            >
              <Tooltip direction="top">
                <strong>{shortMuni(p.muni)}</strong>
                <br />
                {p.count} {p.count === 1 ? "sale" : "sales"} · median {money(p.medianPrice)}
              </Tooltip>
            </CircleMarker>
          ))}
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
