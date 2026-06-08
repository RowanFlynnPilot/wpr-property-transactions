import { SPONSOR } from "../lib/sponsor.js";

// Sits under the masthead so it lands in every screenshot of the page. With no
// sponsor set it shows the "your brand here" pitch; once `SPONSOR.name` is set it
// shows the sponsor (logo if provided).
export default function SponsorStrip() {
  return (
    <aside className="sponsor" aria-label="Sponsor">
      <span className="sponsor-kicker">Wausau-area Home Price Report</span>
      {SPONSOR.name ? (
        <span className="sponsor-by">
          Presented by{" "}
          {SPONSOR.logo ? (
            <img className="sponsor-logo" src={SPONSOR.logo} alt={SPONSOR.name} />
          ) : SPONSOR.url ? (
            <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer">
              {SPONSOR.name}
            </a>
          ) : (
            <strong>{SPONSOR.name}</strong>
          )}
        </span>
      ) : (
        <span className="sponsor-pitch">
          Presented by <span className="sponsor-slot">your brand here</span>
        </span>
      )}
    </aside>
  );
}
