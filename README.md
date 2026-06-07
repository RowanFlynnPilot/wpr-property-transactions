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

## Status

Feasibility, spike, and scraper complete. The Playwright scraper drives the DOR Advanced
Search and downloads the CSV report (Select All -> Generate Report -> CSV), parses it, and
writes `data/transactions.json` — verified end-to-end against live Marathon County data.
Next: editorial price/address policy, a live GitHub Actions run, and the frontend.
