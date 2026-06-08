import { SPONSOR } from "../lib/sponsor.js";

// Full-width sponsor banner card — placed at structural breakpoints (top, above
// the charts, above the table) for prominent, ad-style presence. Links to the
// sponsor. No-op without a sponsor.
export default function SponsorBanner({ label = "Presented by" }) {
  if (!SPONSOR.name) return null;

  const displayUrl = SPONSOR.url
    ? SPONSOR.url.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;

  const inner = (
    <>
      <span className="sb-left">
        <span className="sb-eyebrow">{label}</span>
        {SPONSOR.logo ? (
          <img className="sb-logo" src={SPONSOR.logo} alt={SPONSOR.name} />
        ) : (
          <span className="sb-name">{SPONSOR.name}</span>
        )}
      </span>
      {displayUrl && <span className="sb-cta">Visit {displayUrl} →</span>}
    </>
  );

  return SPONSOR.url ? (
    <a
      className="sponsor-banner"
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} ${SPONSOR.name}`}
    >
      {inner}
    </a>
  ) : (
    <aside className="sponsor-banner" aria-label={`${label} ${SPONSOR.name}`}>
      {inner}
    </aside>
  );
}
