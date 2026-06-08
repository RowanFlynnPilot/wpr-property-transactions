import { useRef, useState, useMemo } from "react";
import { toPng } from "html-to-image";
import Sparkline from "./Sparkline.jsx";
import { WPR_LOGO } from "../lib/wpr-logo.js";
import { SPONSOR } from "../lib/sponsor.js";
import { money, fmtPct, pctChange } from "../lib/format.js";

function monthLong(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// A co-branded, downloadable headline card — the "share image". Built from the
// same history data; carries the WPR wordmark and the sponsor slot, so every share
// travels with the brand.
export default function ShareCard({ history, selectedCounty }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!history) return null;
    const key = selectedCounty || "Overall";
    const med = history.series[key] ?? [];
    const last = med.length - 1;
    return {
      scopeName: selectedCounty ? `${selectedCounty} County` : "6-County Region",
      med,
      medianNow: med[last],
      yoy: pctChange(med[last], med[0]),
      month: monthLong(history.months[last]),
      slug: key.toLowerCase(),
    };
  }, [history, selectedCounty]);

  if (!data) return null;

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      // skipFonts: the page's web fonts are already loaded, so the rasterized
      // image still uses them — and it avoids html-to-image choking on Google
      // Fonts' cross-origin stylesheet (its cssRules can't be read).
      const url = await toPng(ref.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `wpr-home-prices-${data.slug}.png`;
      a.click();
    } catch (e) {
      console.error("share image export failed", e);
    } finally {
      setBusy(false);
    }
  };

  const sponsorLine = SPONSOR.name ? `Presented by ${SPONSOR.name}` : "Presented by  [ your brand here ]";

  return (
    <section className="share" aria-label="Share this report">
      <div className="share-head">
        <h2>Share this report</h2>
        <button className="share-btn" onClick={download} disabled={busy}>
          {busy ? "Preparing…" : "⤓ Download share image"}
        </button>
      </div>

      <div className="share-card" ref={ref}>
        <div className="share-card-top">
          <img className="share-logo" src={WPR_LOGO} alt="Wausau Pilot & Review" />
          <span className="share-tag">HOME PRICE REPORT</span>
        </div>
        <div className="share-scope">{data.scopeName}</div>
        <div className="share-month">{data.month}</div>
        <div className="share-median">{money(data.medianNow)}</div>
        <div className="share-sublabel">
          median sale price ·{" "}
          <span className={data.yoy >= 0 ? "up" : "down"}>{fmtPct(data.yoy)} year over year</span>
        </div>
        <div className="share-spark">
          <Sparkline values={data.med} color="#3a867c" width={420} height={60} />
        </div>
        <div className="share-foot">
          <span>wausaupilotandreview.com</span>
          <span className="share-sponsor">{sponsorLine}</span>
        </div>
      </div>
    </section>
  );
}
