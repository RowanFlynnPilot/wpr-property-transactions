# wpr-property-transactions

Recent real estate transactions for **Marathon County, WI** (extensible to surrounding
counties), published by Wausau Pilot & Review.

Source: **Wisconsin DOR Real Estate Transfer Return (RETR)** data — public by statute,
five years statewide, carrying sale price. Accessed through the DOR "My Tax Account"
(GenTax) Advanced Search via headless Playwright.

Pipeline: Playwright scraper → GitHub Actions weekly cron → static `data/transactions.json`
→ React/Vite frontend → GitHub Pages → WordPress iframe.

See **CLAUDE.md** for the full working agreement: source rationale, the GenTax/Playwright
constraint, editorial policy decisions, engineering principles, and dev-environment notes.

## Quick start

```powershell
# scraper
pip install -r requirements.txt ; python -m playwright install chromium
python -m scraper.scrape

# frontend
cd frontend ; npm install ; npm run dev
```

## WordPress embed

Paste this into the page as **Custom HTML** (not a bare `<iframe>`). The tool is far
taller than any fixed height — roughly 10,000px — so it reports its own height to the
host page; the listener below applies it. **Without the listener the iframe keeps
whatever height is hardcoded and, because `scrolling="no"`, everything past that point
is silently cut off** — which is how the transactions table went missing on the live
page (a fixed `height:1600px` showed only as far as the biggest-deals cards).

```html
<iframe
  id="wpr-property-transactions"
  src="https://rowanflynnpilot.github.io/wpr-property-transactions/"
  title="Property Transactions — Wausau Pilot &amp; Review"
  scrolling="no"
  style="width:100%;height:1600px;border:0;display:block"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    // The host page runs many third-party iframes (ad networks); only accept a
    // resize from the tool's own origin, and ignore implausible heights.
    if (e.origin !== "https://rowanflynnpilot.github.io") return;
    var d = e.data;
    if (!d || d.type !== "wpr-embed-height") return;
    var h = parseInt(d.height, 10);
    if (!(h > 200 && h < 60000)) return;
    var f = document.getElementById(d.id);
    if (f) f.style.height = h + "px";
  });
</script>
```

The `id` must stay `wpr-property-transactions` — the tool sends it back in the message
so a page can host more than one embed. The starting `height` is only a placeholder
before the first message arrives. Sender: `frontend/src/lib/embed.js`.

## Status

Feasibility, spike, and scraper complete. The Playwright scraper drives the DOR Advanced
Search and downloads the CSV report (Select All -> Generate Report -> CSV), parses it, and
writes `data/transactions.json` — verified end-to-end against live Marathon County data.
Next: editorial price/address policy, a live GitHub Actions run, and the frontend.
