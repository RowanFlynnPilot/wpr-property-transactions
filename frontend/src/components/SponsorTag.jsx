import { SPONSOR } from "../lib/sponsor.js";

// Small "Sponsored by [logo]" lockup, linked to the sponsor. Reusable wherever we
// want sponsor presence (e.g. the biggest-deals header). No-op without a sponsor.
export default function SponsorTag({ label = "Sponsored by", className = "" }) {
  if (!SPONSOR.name) return null;
  const inner = (
    <>
      <span className="sponsor-tag-label">{label}</span>
      {SPONSOR.logo ? (
        <img className="sponsor-tag-logo" src={SPONSOR.logo} alt={SPONSOR.name} />
      ) : (
        <span className="sponsor-tag-name">{SPONSOR.name}</span>
      )}
    </>
  );
  return SPONSOR.url ? (
    <a
      className={`sponsor-tag ${className}`.trim()}
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  ) : (
    <span className={`sponsor-tag ${className}`.trim()}>{inner}</span>
  );
}
