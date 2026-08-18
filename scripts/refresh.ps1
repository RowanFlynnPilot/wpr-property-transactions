<#
.SYNOPSIS
    Scrape DOR RETR from this machine, commit the refreshed data, and push.

.DESCRIPTION
    Runs from your residential IP, which the Wisconsin DOR TAP portal answers
    reliably. GitHub-hosted runners are refused for days at a time (every
    navigation times out), which is why the scheduled CI runs kept failing and
    the published feed silently fell behind - so the scrape lives here instead.

    Refreshes data/transactions.json (the 30-day feed) and, unless -FeedOnly,
    data/price_history.json + data/muni_medians.json (the 12-month trend, which
    drives the headline median). Pushing to main triggers the Pages deploy
    automatically - do NOT add [skip ci] to these commits.

    Intended to be run by Windows Task Scheduler. A transcript of every run is
    written to logs/ so an unattended failure can be diagnosed after the fact.

.PARAMETER NoPush
    Scrape and commit nothing - leaves changes in the working tree. Dry runs.

.PARAMETER FeedOnly
    Skip the 12-month history rebuild (~12 extra downloads, ~10 min).

.EXAMPLE
    .\scripts\refresh.ps1

.EXAMPLE
    .\scripts\refresh.ps1 -FeedOnly -NoPush
#>

[CmdletBinding()]
param(
    [switch]$NoPush,
    [switch]$FeedOnly
)

$ErrorActionPreference = "Stop"

# --Locate the project root regardless of where Task Scheduler invokes us -------
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# --Transcript, so an unattended failure leaves evidence ------------------------
$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$LogFile = Join-Path $LogDir ("refresh-" + (Get-Date -Format "yyyy-MM-dd_HHmmss") + ".log")
Start-Transcript -Path $LogFile | Out-Null

# Keep the last 30 logs; drop the rest.
Get-ChildItem $LogDir -Filter "refresh-*.log" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 30 |
    ForEach-Object { Remove-Item $_.FullName -Force }

Write-Host ""
Write-Host "--refresh.ps1 ------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

$failed = @()

try {
    # --Preconditions ----------------------------------------------------------
    $Python = (Get-Command py -ErrorAction SilentlyContinue)
    if ($null -eq $Python) { $Python = (Get-Command python -ErrorAction SilentlyContinue) }
    if ($null -eq $Python) {
        Write-Host "[error] No Python launcher on PATH (expected 'py' or 'python')." -ForegroundColor Red
        Stop-Transcript | Out-Null
        exit 2
    }
    $Py = $Python.Source
    Write-Host "[env] python: $Py"

    & $Py -c "import playwright" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[error] Playwright not installed. Run: pip install -r requirements.txt" -ForegroundColor Red
        Stop-Transcript | Out-Null
        exit 2
    }

    # --Start from the current main so the push is a fast-forward ---------------
    Write-Host "[git] Pulling latest from origin/main..." -ForegroundColor DarkGray
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[warn] Could not pull cleanly. Proceeding anyway." -ForegroundColor Yellow
    }

    # --The 30-day feed --------------------------------------------------------
    Write-Host ""
    Write-Host "[scrape] python -m scraper.scrape" -ForegroundColor Cyan
    & $Py -m scraper.scrape
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[error] Scrape failed." -ForegroundColor Red
        $failed += "scrape"
    }

    # --The 12-month history (independent: a failure here must not discard a
    #   good feed, so it is recorded and the run continues) ---------------------
    if (-not $FeedOnly) {
        Write-Host ""
        Write-Host "[history] python -m scraper.history" -ForegroundColor Cyan
        & $Py -m scraper.history
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[error] History rebuild failed." -ForegroundColor Red
            $failed += "history"
        }
    }
    else {
        Write-Host ""
        Write-Host "[skip] -FeedOnly set; not rebuilding the 12-month history." -ForegroundColor Yellow
    }

    # --Commit whatever actually changed ---------------------------------------
    Write-Host ""
    git add data/
    git diff --staged --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[done] No data changed; nothing to commit." -ForegroundColor Green
    }
    elseif ($NoPush) {
        Write-Host "[skip] -NoPush set; changes staged but not committed." -ForegroundColor Yellow
    }
    else {
        git commit -m "data: refresh property transactions feed"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[error] git commit failed." -ForegroundColor Red
            $failed += "commit"
        }
        else {
            # main can move between the pull above and here; rebase and retry.
            $pushed = $false
            foreach ($attempt in 1..5) {
                git push origin main
                if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
                Write-Host "[warn] push rejected (attempt $attempt) - rebasing onto origin/main" -ForegroundColor Yellow
                git pull --rebase origin main
                Start-Sleep -Seconds 3
            }
            if ($pushed) {
                Write-Host "[done] Pushed. The Pages deploy runs automatically." -ForegroundColor Green
                Write-Host "       https://github.com/RowanFlynnPilot/wpr-property-transactions/actions"
            }
            else {
                Write-Host "[error] git push failed after 5 attempts." -ForegroundColor Red
                $failed += "push"
            }
        }
    }
}
catch {
    Write-Host "[error] Unhandled: $($_.Exception.Message)" -ForegroundColor Red
    $failed += "unhandled"
}
finally {
    Write-Host ""
    Write-Host "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host "Log: $LogFile"
    Stop-Transcript | Out-Null
}

if ($failed.Count -gt 0) {
    Write-Host ("[fail] " + ($failed -join ", ")) -ForegroundColor Red
    exit 1
}
exit 0
