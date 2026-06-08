import { WPR_LOGO, WPR_MARK, WPR_TAGLINE, WPR_URL } from "../lib/wpr-logo.js";

// Wausau Pilot & Review masthead — the shared newspaper-style header used across
// WPR widgets: the wordmark (linked home), the tagline, and a dateline, framed by
// slate rules. Matches the house format; the widget's own teal accent lives below.
export default function Masthead() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <header className="wpr-masthead">
      <a
        href={WPR_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Wausau Pilot & Review home"
        className="wpr-logo-link"
      >
        <img src={WPR_MARK} alt="" className="wpr-mark" />
        <img src={WPR_LOGO} alt="Wausau Pilot & Review" className="wpr-logo" />
      </a>
      <div className="wpr-tagline">{WPR_TAGLINE}</div>
      <div className="wpr-dateline">
        <span>{today}</span>
        <span className="wpr-place">Wausau, Wisconsin</span>
      </div>
    </header>
  );
}
