"""Single source of scraper constants. Values only, no logic.

The DOR TAP/GenTax control IDs below were confirmed deterministic across sessions
during the spike (see spike/tap_spike.py). The criterion picker and value fields
are located by content at runtime (see scraper/tap.py) rather than by ID, so they
survive GenTax re-renders.
"""

from pathlib import Path

# --- Source ---------------------------------------------------------------
TAP_RETR_URL = "https://tap.revenue.wi.gov/mta/?Link=RETRSearch"

# --- Scope ----------------------------------------------------------------
# County name must match the TAP dropdown option exactly. Each is a separate
# report download. This is the WPR 6-county core (Marathon + 5 contiguous
# neighbors), matching the wpr-trails coverage area.
COUNTIES = ["Marathon", "Lincoln", "Langlade", "Taylor", "Shawano", "Portage"]

# Rolling window of recorded date to pull each run, in days. A full month so the
# published feed carries ~4 weeks of context; the frontend offers a week-level
# drill-down filter within that window. The weekly cron refreshes the trailing
# 30 days each run (overlap is fine — each run overwrites the feed).
DATE_WINDOW_DAYS = 30

# --- Output ---------------------------------------------------------------
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "transactions.json"

# --- Price history (rolling 12-month monthly median by county + overall) ---
# TAP caps any single search at 1000 returns (spike-confirmed), so history is
# pulled one calendar month per county at a time (each month is well under the
# cap) and bucketed. Ongoing runs re-pull only the trailing REFRESH months (late
# recordings settle) plus any month missing from the committed series; the first
# run backfills all HISTORY_MONTHS.
HISTORY_MONTHS = 12
HISTORY_REFRESH_MONTHS = 2
HISTORY_OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "price_history.json"

# --- Per-municipality medians (single-family, trailing 12 months) ----------
# Built by scraper/history.py from the SAME monthly pulls as the price history
# (no extra TAP traffic). Record-level sale prices are stored per
# (county|municipality, month) — prices only, no addresses or names — because a
# trailing-window median must be computed from raw prices; monthly medians
# cannot be recombined. Consumers (e.g. wpr-finance-tools) apply their own
# sample-size threshold; every row carries its count.
MUNI_MEDIANS_OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "muni_medians.json"

# --- Browser --------------------------------------------------------------
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
HEADLESS = True
NAV_TIMEOUT_MS = 45_000

# The DOR TAP portal is a third-party government endpoint that intermittently
# stalls — the initial navigation or a later step can time out for one run and
# succeed on the next. download_report (tap.py) retries the WHOLE browser session
# this many times, sleeping between attempts, before failing loudly. Applies to
# both the weekly scrape and the monthly history pull (both go through tap.py).
DOWNLOAD_ATTEMPTS = 3
DOWNLOAD_RETRY_SLEEP_S = 5

# --- TAP flow (confirmed in spike) ----------------------------------------
# Stable GenTax control selectors.
SEL_DISCLAIMER_AGREE = "#Dc-b"
SEL_ADVANCED_MODE = "label.FastComboButtonItem_ADVANCED"
SEL_SEARCH = "#Dc-51"
# Text-addressed controls (stable labels).
TXT_ADD_FILTER = "text=Add Filter"
TXT_SELECT_ALL = "text=Select All"
TXT_GENERATE_REPORT = "text=Generate Report"
TXT_CSV_REPORT = "text=CSV Report"
# Criterion labels in the Advanced filter "Type" dropdown.
CRIT_COUNTY = "County and municipality"
CRIT_DATE_RECORDED = "Date recorded"
# A distinctive option used to recognise an unset criterion ("Type") dropdown.
CRIT_SENTINEL_OPTION = "Date recorded"

# --- Editorial publish policy (editor sign-off 2026-06-07) ----------------
# Applied in scraper/policy.py BEFORE the public feed is written. The published
# JSON is world-readable on GitHub Pages, so redaction happens here, not in the
# frontend. The raw CSV is transient (temp dir) and never committed, so the feed
# is the only artifact and already reflects these choices. Change policy = re-run.
#
#   (1) Genuine sales only          -> SALE_CONVEYANCE_TYPES
#   (2) ~$1,000 floor               -> MIN_SALE_PRICE
#   (3) Street/block, no house no.  -> address redaction in policy.py
#   (4) Never publish mailing addrs -> structurally absent (not in the data model)
#   (5) Community-level map          -> no per-record geocoordinates published;
#                                       frontend aggregates by municipality
SALE_CONVEYANCE_TYPES = {"Sale"}
MIN_SALE_PRICE = 1000

# Parcel number is intentionally EXCLUDED from the published feed: a free county
# GIS lookup on a parcel number re-identifies the exact property, which would
# defeat decision (3). It is therefore omitted from PublishedRecord. To re-include
# it (e.g. for reader verification), add the field back to PublishedRecord and map
# it in policy.apply_policy. Flagged to the editor for confirmation.
