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

## Refreshing the data (runs locally, not in CI)

The Wisconsin DOR TAP portal refuses GitHub's hosted runners for days at a time —
every page navigation times out — in recurring multi-day clusters (2026-07-23..26,
2026-08-13..15). A cluster swallows both weekly slots, so the scheduled runs failed
and the published feed silently fell nine days behind. It answers a residential IP
reliably, so the scrape runs from a local machine on Windows Task Scheduler:

```powershell
.\scripts\refresh.ps1              # feed + 12-month history, commit, push
.\scripts\refresh.ps1 -FeedOnly    # skip the history rebuild (~10 min faster)
.\scripts\refresh.ps1 -NoPush      # dry run: scrape, stage, don't commit
```

Pushing `data/*.json` to `main` triggers the Pages deploy automatically, so a
successful run publishes on its own. Every run writes a transcript to `logs/`
(gitignored) so an unattended failure can be diagnosed afterwards.

### Task Scheduler entry

Registered as **"WPR Property Transactions refresh"** — weekly, **Sunday 06:00**, so a
fresh week of sales is up before Monday. It runs under the logged-in user (git needs
that account's credentials to push), with "start when available" so a run lost to the
machine being asleep happens at the next opportunity rather than being skipped.

It must be allowed to **start and keep running on battery**. Windows' default refuses,
and that cost the 2026-10-18 run: the laptop slept unplugged through 06:00, the
missed-run check fired on wake a second before the charger registered, and Task
Scheduler never retried it.

To recreate it from scratch:

```powershell
$root = "C:\Users\rpfly\Projects\wpr-property-transactions"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $root + '\scripts\refresh.ps1"') `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 6:00am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "WPR Property Transactions refresh" `
  -Action $action -Trigger $trigger -Settings $settings -Force
```

Useful checks:

```powershell
Get-ScheduledTaskInfo -TaskName "WPR Property Transactions refresh"   # last/next run, result
Start-ScheduledTask   -TaskName "WPR Property Transactions refresh"   # run it now
Unregister-ScheduledTask -TaskName "WPR Property Transactions refresh"  # remove it
```

`.github/workflows/scrape.yml` and `history.yml` are kept for **manual dispatch**
only — useful when TAP is answering hosted runners and the local machine is away.
Both are **disabled in GitHub** so their last (failed) runs don't show up as live
failures in the fleet-health digest. To use one:

```powershell
gh workflow enable scrape-transactions ; gh workflow run scrape-transactions
gh workflow disable scrape-transactions   # once the run has finished
```

If a refresh stops happening for any reason, two things say so:

- **`.github/workflows/freshness.yml`** runs daily (and on every data push) and fails
  once any `data/*.json` is more than 8 days old — one missed Sunday plus a day of
  slack. That failure reaches the fleet-health digest and GitHub's failed-run email.
- **The page itself:** the header shows "Sales recorded through <date>", and past 12
  days it turns into a visible warning.

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
