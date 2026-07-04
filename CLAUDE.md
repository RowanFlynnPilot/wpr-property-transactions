# CLAUDE.md — wpr-property-transactions

Project context and working agreement for Claude Code. Read this first.

## What this is

A Wausau Pilot & Review (WPR) civic-data tool that publishes recent **real estate
transactions** for the **WPR 6-county core — Marathon, Lincoln, Langlade, Taylor,
Shawano, and Portage, WI** (the wpr-trails coverage area). Coverage is parameterized
by county (`scraper/config.py`), so adding/removing a county is config, not new code.

It is the refined successor to the plain-text "property transactions" column some
local papers run (e.g. Daily Press / Delta County MI): instead of a flat narrative of
deed transfers, this tool surfaces **sale prices**, is sortable/filterable by county,
municipality, property use (Overall/Residential/Commercial), price, date, and week, and
is chart- and map-led, with a 12-month median trend, KPI hero, biggest-deals spotlight,
and a sponsor banner/share image.

## The data source — and why

**Wisconsin DOR Real Estate Transfer Return (RETR) data.** Every conveyance in
Wisconsin legally requires an e-filed Real Estate Transfer Return at recording. DOR
publishes five years of RETR statewide as public record, searchable by county,
municipality, date recorded, sale price, and property type.

This is the **single correct source**. It is chosen over the alternatives deliberately:

- **vs. Marathon County Register of Deeds (LandShark / TriMin):** rejected. Login-gated,
  per-document fees, terms disallow automated harvesting, and the index carries no sale
  price. DOR RETR is public by statute, price-bearing, and statewide-consistent (so
  "add a county" is a parameter change, not a new scraper).

There are **no fallback sources**. If DOR RETR is unreachable, the run fails loudly.

### Fields available per record

grantor, grantee, municipality, parcel ID, property address, **total value (sale
price)**, conveyance/deed type, property **type** (structure: Land/buildings, Land only,
Condominium), property **use** (DOR class: Single family, Multi-family, Commercial,
Manufacturing, Agricultural, Undeveloped land, …), date recorded.

The Daily Press reference omits price entirely — price is the whole reason WPR's version
is more useful.

**Property use is the key classifier.** RETR covers *all* real estate, so the
biggest "deals" are often commercial/industrial/multi-family (a food plant, warehouses,
apartment portfolios) — accurate sale prices, but not home sales. The DOR `Property Use
Type` field (parsed in `parse.py:_use` -> `property_use`) distinguishes them. Nothing is
excluded; the frontend offers an **Overall / Residential / Commercial** selector
(`frontend/src/lib/use.js`) and labels every record with its precise DOR category.
Grouping (kept in sync between `lib/use.js` and `scraper/history.py`): **Residential =
Single family**; **Commercial = Commercial + Manufacturing + Multi-family** (apartments
are investment property per the editor); other classes appear only under Overall.

## The technical reality (read before touching the scraper)

DOR moved RETR search into **"My Tax Account" (TAP)**, a Fast Enterprises **GenTax**
portal:

- Heavy AJAX framework (`WDC.min.js`, `FWDC.loadManager`). UI is rebuilt client-side from
  a proprietary serialized protocol.
- **No clean REST/JSON endpoint.** `requests`/`curl` cannot retrieve results.
- Cookie-session based, **15-minute session timeout**, JavaScript mandatory.
- Entry point: `https://tap.revenue.wi.gov/mta/?Link=RETRSearch`

Therefore the scraper is **Python + Playwright (headless Chromium)**.

**IP note:** unlike GasBuddy, this is a government endpoint. It returned a clean `HTTP 200`
to a datacenter IP with no Cloudflare challenge, and the full headless flow ran from a
cloud container. Expect GitHub Actions runners to reach it **without** the Webshare proxy
workaround. Do not add proxy plumbing unless a run proves it is actually blocked.

### Confirmed extraction path (spike-verified — see spike/tap_spike.py)

Do NOT scrape the HTML results grid or drill per-row detail pages. The Advanced Search
has a **CSV export** that returns the entire result set in one download:

1. Accept disclaimer: click `#Dc-b`.
2. Advanced mode: click `label.FastComboButtonItem_ADVANCED`.
3. Add Filter → Type = "County and municipality".
4. Add Filter → Type = "Date recorded"; fill the two recorded-date text inputs
   (`MM/DD/YYYY`; GenTax reformats to `DD-Mon-YYYY`).
5. Set primary **County last** (adding a filter re-renders and clears it).
6. Search: click `#Dc-51`.
7. **Select All → Generate Report → CSV Report** → download.

The CSV is **78 columns, one row per return**, and "Select All" spans **all** result
pages. It carries `Recorded Date`, `Document Type`, `Conveyance Type`, `Municipality`,
`Parcel Number`, `Property Type`, `Physical Address`, `Grantor`/`Grantee` name + address,
**`Sale Price`**, `Acres`, financing breakdown, and full `Legal Description`. We project a
lean subset (see scraper/models.py). CSV's one-grantor/one-grantee/one-parcel limit is
accepted; an XML export exists for full party lists, but we use one path — CSV.

### GenTax gotchas the spike surfaced (don't relearn these)

- Dc- control IDs are deterministic across sessions, but value fields are located by
  **content** in `tap.py` so they survive re-renders.
- Use Playwright native `select_option`/`fill`. Raw JS value-setting does **not** commit
  to the framework model → search fails "County Required".
- `page.evaluate` takes ONE arg — pass multiples as a list: `([el, x]) => ...`.
- Generate Report needs a selection first, else "Please select at least one return."
- Find the criterion "Type" dropdown by polling for an unset select that offers
  "Date recorded" as an option; fail loudly if it never paints.
- **Never wait on `networkidle`.** GenTax's `FWDC.loadManager` polls continuously, so the
  page rarely reaches network-idle and `goto`/`wait_for_load_state("networkidle")` time out
  intermittently (it bit the first 30-day runner run). Use `wait_until="domcontentloaded"`
  plus an explicit `wait_for_selector` on the control each step needs.

## Architecture (the one pipeline)

```
Playwright scraper  ->  GitHub Actions cron (weekly)  ->  data/transactions.json (static)
        ->  React/Vite frontend  ->  GitHub Pages  ->  WordPress iframe
```

Matches the established WPR widget pipeline. No server, no database. The committed
`data/transactions.json` is the single source of truth the frontend reads.

## Editorial publish policy (SIGNED OFF 2026-06-07, AMENDED 2026-06-08)

The published `data/transactions.json` is world-readable on GitHub Pages, so the policy is
applied **in-pipeline** (`scraper/policy.py`) before the feed is written — NOT in the
frontend, which would leak raw addresses in the public JSON. The raw CSV is transient
(temp dir, never committed), so the feed is the only artifact and already reflects these
choices. **Changing policy = re-run the scrape** (the weekly cron makes that trivial).

Editor's decisions, and how each is enforced:

1. **Genuine sales only** → `conveyance_type in SALE_CONVEYANCE_TYPES` (`{"Sale"}`).
2. **~$1,000 floor** → `sale_price >= MIN_SALE_PRICE` (1000).
3. **Full street address** *(AMENDED 2026-06-08 — the editor reversed the original
   "street/block, no house number" choice)* → `policy._clean_address` KEEPS the house
   number (urban `225`, hyphenated range `1224-1226`, WI rural fire numbers
   `N5678`/`N12W3456`) and the road name. It still strips the redundant trailing postal
   `City, WI ZIP` suffix (`_strip_city_zip`; county + municipality are separate fields),
   removes any embedded parcel number, drops a stray leading `&`/trailing-comma
   artifacts, and collapses malformed `St, <num> St` duplications to the numbered form
   (e.g. `Prairie View Cir, 152692 Prairie View Cir` → `152692 Prairie View Cir`). The
   feed and table now carry full property addresses.
4. **Party names published; mailing addresses never** → `grantor` (seller) and `grantee`
   (buyer) NAMES are published and shown in the table; party mailing addresses are
   structurally absent (not fields on `Transaction`/`PublishedRecord`).
5. **Community-level map** → no per-record geocoordinates are published; the frontend
   aggregates by (county, municipality) and plots markers at **Census municipal
   centroids** generated by `tools/fetch_centroids.py` (one-off; re-run when the
   county set changes) into `frontend/src/lib/municipalities.js`. Names repeat across
   counties, so centroids are keyed `county|municipality`.
6. **All uses published, accurately classified** *(2026-06-09)* → commercial /
   manufacturing / multi-family sales are NOT excluded (they're genuine recorded sales),
   but each carries its DOR `property_use`. The frontend defaults to **Overall** with a
   Residential/Commercial selector; the 12-month median/KPI headline follows it
   (`price_history.json` is precomputed per use group).

**Parcel number is withheld** (not on `PublishedRecord`): a free county GIS lookup on a
parcel number re-identifies the exact property, defeating decision (3). This extends the
editor's intent beyond her literal answers — flagged to her for confirmation. To re-include
it, add the field to `PublishedRecord` and map it in `policy.apply_policy`.

Live check: a 30-day window (the default — see `DATE_WINDOW_DAYS`) across the 6
counties yields ~**600 published** sales ≥ $1,000 (Marathon ~224, then Portage,
Lincoln, Shawano, Taylor, Langlade), full street addresses with no city/ZIP and no
parcel IDs, every municipality mapped. The frontend table shows address, seller,
buyer, and price, and defaults to the whole region/month with county, community, and
week drill-down filters plus a median-price-by-county chart.

## Known constraints / gotchas

- **Recording lag.** RETR reflects *recorded* transfers; there is a lag of days-to-weeks
  between sale, recording, and DOR posting. "This month" means recorded in the trailing
  30 days. Same lag the reference paper has.
- **Session timeout.** A scrape session must complete its paginated read within 15 minutes
  or the session is lost. Keep the run tight; do not interleave long sleeps.
- **Polite scraping.** Public data, but be a good citizen: one report download per county, run
  off-peak, identify a real UA. No hammering.
- **$0 / non-arms-length rows** will appear — see editorial decision #2.

## Engineering principles (apply to every change)

- **No overengineering.** Simple beats complex.
- **One correct path, no fallbacks.** No alternate sources, no silent degradation.
- **One way to do a thing**, not many.
- **Clarity over compatibility.** Clear code beats backward-compat hedging.
- **Fail fast and loudly.** Throw on unmet preconditions; never swallow.
- **No backups.** Trust the primary mechanism.
- **One responsibility per function/module.** Clean separation of concerns.
- **Surgical changes only.** Minimal, focused diffs.
- **Evidence-based debugging.** Minimal targeted logging; fix root causes, not symptoms.

## Repo layout

```
wpr-property-transactions/
├── CLAUDE.md                 # this file
├── README.md
├── requirements.txt
├── .gitignore
├── scraper/
│   ├── config.py             # counties, date window, URLs, selectors (single source of constants)
│   ├── models.py             # Transaction schema (dataclass) + JSON serialization
│   ├── tap.py                # Playwright: search -> Select All -> Generate Report -> CSV download
│   ├── parse.py              # DOR CSV rows -> Transaction objects (incl. property_use)
│   ├── policy.py             # editorial publish policy: filter + clean -> PublishedRecord
│   ├── scrape.py             # orchestration entry point; writes data/transactions.json
│   └── history.py            # rolling 12-mo aggregates from monthly pulls (both files below)
├── data/
│   ├── transactions.json     # static 30-day feed, committed, read by frontend
│   ├── price_history.json    # 12-mo medians+counts (All/Residential/Commercial x county)
│   └── muni_medians.json     # per-municipality single-family 12-mo medians + counts
│                             #   (+ per-month price lists — prices only — so trailing
│                             #   medians recompute from raw prices; consumed by
│                             #   wpr-finance-tools, which applies a sample-size threshold)
├── tools/
│   └── fetch_centroids.py    # one-off: Census municipal centroids -> frontend lib
├── tests/                    # pytest: parse + policy (browser-free); run in CI
├── spike/
│   └── tap_spike.py          # throwaway selector-discovery script (not part of pipeline)
├── frontend/                 # Vite + React
│   ├── package.json
│   ├── vite.config.js        # base + publicDir(../data) + vendor manualChunks
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # feed load, layered filtering, layout
│       ├── components/       # Masthead, SponsorBanner, KpiHero, BiggestDeals,
│       │                     #   PriceHistoryChart, PriceCharts, MarketBreakdown,
│       │                     #   TransactionTable, MunicipalityMap (lazy), ShareCard,
│       │                     #   Sparkline, SponsorTag
│       ├── lib/              # format.js, use.js, wpr-logo.js, sponsor.js,
│       │                     #   municipalities.js (generated), useCountUp.js, embed.js
│       └── styles/           # tokens.css (design tokens) + app.css
└── .github/workflows/
    ├── scrape.yml            # weekly cron -> commit feed -> dispatch deploy
    ├── history.yml           # monthly cron -> rebuild price_history.json -> dispatch deploy
    ├── test.yml              # pytest on push
    └── deploy.yml            # build + publish to GitHub Pages
```

The history pipeline is separate from the weekly feed: `history.py` pulls each
(county, month) individually — TAP caps a search at 1000 rows, so a 12-month pull would
silently truncate — and aggregates per-use-group medians. Re-grouping uses (e.g. moving
Multi-family) requires a re-backfill, since group medians can't be recombined from
stored aggregates.

Module split mirrors separation of concerns: `tap.py` owns "drive TAP, return a CSV", `parse.py` owns
"grid -> records", `scrape.py` only orchestrates and writes. Constants live in `config.py`
only.

## WPR design system (frontend)

Matched to wausaupilotandreview.com (2026-07-04 brand pass):

- **Base:** white ground, ink `#111` (the site's exact body color), neutral
  hairline rules — the paper's newspaper aesthetic.
- **Type:** Oswald (headlines AND compact UI labels — the site's head/nav face),
  Merriweather (prose), JetBrains Mono (data / prices / parcel IDs). Tokens:
  `--font-display` / `--font-ui` / `--font-body` / `--font-data`.
- **Accents:** teal `#3A867C` / `#4aaba7` stays the shared WPR-widget DATA accent
  (charts, KPIs, buttons — consistent with `wpr-trails` / `wpr-river-conditions`);
  the paper's red `#dd3333` (typewriter roundel) is reserved for small editorial
  accents so data viz never reads alarmist. JS-side chart colors live in ONE
  place: `frontend/src/lib/palette.js`; CSS colors in `styles/tokens.css`.
- **Logo:** wordmark + typewriter roundel embedded as base64 (`lib/wpr-logo.js`)
  to avoid hotlink failures; both render in the shared Masthead and ShareCard.
- Chart-led and map-led (Leaflet).

## Dev environment

- **OS:** Windows. Shell: PowerShell 5.1 — **use `;` as the command separator, not `&&`**.
- **Python:** 3.14.0 on Windows.
- **Projects root:** `C:\Users\rpfly\Projects\wpr-property-transactions`
- **GitHub:** `RowanFlynnPilot`; use `gh` for repo ops.
- **Execution policy** (if scripts are blocked):
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
- **Playwright Chromium:** `python -m playwright install chromium` after `pip install`.

## Common commands

```powershell
# scraper
pip install -r requirements.txt ; python -m playwright install chromium
python -m scraper.scrape                 # run scrape -> data/transactions.json

# tests (browser-free: parse + editorial policy)
pip install -r requirements-dev.txt ; python -m pytest -q

# regenerate map centroids after changing COUNTIES (one-off)
python tools/fetch_centroids.py          # -> frontend/src/lib/municipalities.js

# spike (throwaway)
python spike/tap_spike.py

# frontend
cd frontend ; npm install ; npm run dev
npm run build                            # -> dist/, deployed to GitHub Pages
```

## Current status

- [x] Feasibility confirmed: DOR RETR is public, price-bearing, reachable from datacenter IP.
- [x] Scaffold + this CLAUDE.md.
- [x] Spike: TAP Advanced Search flow + CSV-export path confirmed end-to-end.
- [x] Scraper implemented against the CSV path; runs end-to-end and writes
      `data/transactions.json` (verified: 224 published sales for a live 30-day Marathon window).
- [x] Editorial policy signed off (2026-06-07) and enforced in scraper/policy.py:
      sales only, ~$1,000 floor, street/block addresses, no parcel ID, community-level map.
- [x] GitHub Actions weekly cron: verified green on the runner (2026-06-08,
      workflow_dispatch). `scrape.yml` has `timeout-minutes: 15` and, on failure,
      uploads a Playwright trace + screenshot (tap.py honours `RETR_TRACE_DIR`).
- [x] Unit tests (`tests/`, pytest): address-redaction edge cases + price/date
      parsers; run on every push via `.github/workflows/test.yml`.
- [x] Frontend built (filterable/sortable table + price charts + community Leaflet
      map, WPR design system). Vite `publicDir` serves the committed feed.
- [x] GitHub Pages deploy (`deploy.yml`) live at
      https://rowanflynnpilot.github.io/wpr-property-transactions/ — redeploys on
      frontend or feed change. Embed this URL in the WordPress iframe.
