import { useRef, useState, useMemo } from "react";
import { toPng } from "html-to-image";
import Sparkline from "./Sparkline.jsx";
import { WPR_LOGO, WPR_MARK } from "../lib/wpr-logo.js";
import { SPONSOR } from "../lib/sponsor.js";
import { money, fmtPct, pctChange } from "../lib/format.js";

function monthLong(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// A co-branded, downloadable headline card — the "share image". Built from the
// same history data; carries the WPR wordmark and the sponsor slot, so every share
// travels with the brand.
export default function ShareCard({ history, selectedCounty, useGroup = "All", use = "Overall" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!history) return null;
    const geoKey = selectedCounty || "Region";
    const med = history.series[useGroup]?.[geoKey] ?? [];
    if (!med.length) return null;
    const last = med.length - 1;
    return {
      scopeName: selectedCounty ? `${selectedCounty} County` : "6-County Region",
      useWord: use === "Overall" ? "" : `${use.toLowerCase()} `,
      med,
      medianNow: med[last],
      yoy: pctChange(med[last], med[0]),
      month: monthLong(history.months[last]),
      slug: `${(use === "Overall" ? "all" : use.toLowerCase())}-${(selectedCounty || "region").toLowerCase()}`,
    };
  }, [history, selectedCounty, useGroup, use]);

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
          <span className="share-brand">
            <img className="share-mark" src={WPR_MARK} alt="" />
            <img className="share-logo" src={WPR_LOGO} alt="Wausau Pilot & Review" />
          </span>
          <span className="share-tag">HOME PRICE REPORT</span>
        </div>
        <div className="share-scope">{data.scopeName}</div>
        <div className="share-month">{data.month}</div>
        <div className="share-median">{money(data.medianNow)}</div>
        <div className="share-sublabel">
          {data.useWord}median sale price ·{" "}
          <span className={data.yoy >= 0 ? "up" : "down"}>{fmtPct(data.yoy)} year over year</span>
        </div>
        <div className="share-spark">
          <Sparkline values={data.med} color="#3a867c" width={420} height={60} />
        </div>
        <div className="share-foot">
          <span>wausaupilotandreview.com</span>
          <span className="share-sponsor">
            {SPONSOR.name ? (
              <>
                Presented by{" "}
                {SPONSOR.logo && <img className="share-sponsor-logo" src={SPONSOR.logo} alt="" />}
                <span>{SPONSOR.name}</span>
              </>
            ) : (
              "Presented by  [ your brand here ]"
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
