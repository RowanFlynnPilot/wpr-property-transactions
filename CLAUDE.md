# CLAUDE.md — wpr-property-transactions

Project context and working agreement for Claude Code. Read this first.

## What this is

A Wausau Pilot & Review (WPR) civic-data tool that publishes recent **real estate
transactions** for **Marathon County, WI**, with the architecture parameterized so
surrounding counties can be added by config, not by new code.

It is the refined successor to the plain-text "property transactions" column some
local papers run (e.g. Daily Press / Delta County MI): instead of a flat narrative of
deed transfers, this tool surfaces **sale prices**, is sortable/filterable by
municipality, price, date, and conveyance type, and is chart- and map-led.

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
price)**, conveyance/deed type, property use/type, date recorded.

The Daily Press reference omits price entirely — price is the whole reason WPR's version
is more useful.

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

## Editorial publish policy (SIGNED OFF 2026-06-07)

The published `data/transactions.json` is world-readable on GitHub Pages, so the policy is
applied **in-pipeline** (`scraper/policy.py`) before the feed is written — NOT in the
frontend, which would leak raw addresses in the public JSON. The raw CSV is transient
(temp dir, never committed), so the feed is the only artifact and already reflects these
choices. **Changing policy = re-run the scrape** (the weekly cron makes that trivial).

Editor's decisions, and how each is enforced:

1. **Genuine sales only** → `conveyance_type in SALE_CONVEYANCE_TYPES` (`{"Sale"}`).
2. **~$1,000 floor** → `sale_price >= MIN_SALE_PRICE` (1000).
3. **Street/block, no house number** → `policy._redact_address` strips the leading house
   number (urban `225`, hyphenated range `1224-1226`, and WI rural fire numbers
   `N5678`/`N12W3456`), keeping the road name. Ordinal street names ("15th Street") are
   street names, not house numbers, and are kept.
4. **Never publish party mailing addresses** → structurally absent: they are not fields on
   `Transaction` or `PublishedRecord`, so they never enter the pipeline.
5. **Community-level map** → no per-record geocoordinates are published; the frontend
   aggregates by `municipality`.

**Parcel number is withheld** (not on `PublishedRecord`): a free county GIS lookup on a
parcel number re-identifies the exact property, defeating decision (3). This extends the
editor's intent beyond her literal answers — flagged to her for confirmation. To re-include
it, add the field to `PublishedRecord` and map it in `policy.apply_policy`.

Live check: a 30-day Marathon window (the default — see `DATE_WINDOW_DAYS`) yields
**224 published** sales ≥ $1,000 across four weeks, zero house numbers, no parcel IDs.
The frontend defaults to the whole month with a week-level drill-down filter.

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
│   ├── parse.py              # DOR CSV rows -> Transaction objects
│   ├── policy.py             # editorial publish policy: filter + redact -> PublishedRecord
│   └── scrape.py             # orchestration entry point; writes data/transactions.json
├── data/
│   └── transactions.json     # static output, committed, read by frontend
├── spike/
│   └── tap_spike.py          # throwaway selector-discovery script (not part of pipeline)
├── frontend/                 # Vite + React (built later)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles/tokens.css # WPR design tokens
└── .github/workflows/
    └── scrape.yml            # weekly cron -> commit transactions.json
```

Module split mirrors separation of concerns: `tap.py` owns "drive TAP, return a CSV", `parse.py` owns
"grid -> records", `scrape.py` only orchestrates and writes. Constants live in `config.py`
only.

## WPR design system (frontend)

- **Colors:** teal `#3A867C` / `#4aaba7`; cream + black newspaper aesthetic.
- **Type:** Playfair Display (headlines), Source Sans 3 (body), JetBrains Mono (data /
  prices / parcel IDs).
- **Logo:** embed as base64 to avoid hotlink failures.
- Chart-led and map-led (Leaflet), consistent with `wpr-trails` / `wpr-river-conditions`.

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
