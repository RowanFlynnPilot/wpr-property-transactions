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

export default function MunicipalityMap({ records, selected, onSelect }) {
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
      <p className="map-hint">
        Bubble size shows the number of sales. {onSelect && "Click a community to filter the page to it."}
      </p>
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
          {points.map((p) => {
            const isSelected = p.muni === selected;
            return (
              <CircleMarker
                key={p.muni}
                center={p.center}
                radius={radiusFor(p.count, maxCount)}
                eventHandlers={onSelect ? { click: () => onSelect(p.muni) } : undefined}
                pathOptions={{
                  color: isSelected ? "#2f6f66" : "#3a867c",
                  fillColor: isSelected ? "#2f6f66" : "#4aaba7",
                  fillOpacity: isSelected ? 0.85 : 0.55,
                  weight: isSelected ? 3 : 1.5,
                }}
              >
                <Tooltip direction="top">
                  <strong>{shortMuni(p.muni)}</strong>
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
