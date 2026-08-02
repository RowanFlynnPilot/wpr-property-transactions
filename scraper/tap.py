"""Talk to TAP. One responsibility: drive the DOR GenTax Advanced Search for one
county + recorded-date window and download the full result set as a CSV report.
Returns the path to the downloaded CSV. Parsing lives in parse.py.

The Advanced filter builder re-renders when a filter is added, which clears the
County value — so County is set LAST, immediately before Search. Criterion "Type"
dropdowns and value fields are located by content, not by GenTax id, so they
survive re-renders. Any missing control raises loudly.
"""

import os
import time
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

from . import config

# When set (the CI workflow sets it), capture a Playwright trace + a failure
# screenshot under this directory so a failed runner scrape is debuggable instead
# of just a stack trace. Unset locally — keeps normal runs clean. Evidence first:
# the trace is how we'll tighten the flow's timing from real runner behaviour.
_TRACE_DIR = os.environ.get("RETR_TRACE_DIR")


def _unset_criterion_select(page: Page):
    """The newest 'Type' dropdown still reading 'Required'/blank — identified by
    offering the criteria list (it contains the sentinel option). Polls until the
    just-added filter row paints, then fails loudly."""
    for _ in range(20):  # up to ~10s
        found = None
        for s in page.query_selector_all("select"):
            if not s.is_visible():
                continue
            info = page.evaluate(
                """([s, sentinel]) => ({
                     cur: (s.options[s.selectedIndex] || {}).text || '',
                     isCriterion: Array.from(s.options).some(o => o.text.trim() === sentinel)
                   })""",
                [s, config.CRIT_SENTINEL_OPTION])
            if info["isCriterion"] and info["cur"].strip() in ("Required", ""):
                found = s
        if found is not None:
            return found
        page.wait_for_timeout(500)
    raise RuntimeError("No unset criterion 'Type' dropdown found — TAP layout changed.")


def _county_select(page: Page, county: str):
    """Primary County dropdown: first visible select (DOM order) offering the
    county as an option. Primary County precedes 'Additional county'."""
    for s in page.query_selector_all("select"):
        if not s.is_visible():
            continue
        if page.evaluate("([s, c]) => Array.from(s.options).some(o => o.text.trim() === c)", [s, county]):
            return s
    raise RuntimeError(f"County dropdown offering {county!r} not found — TAP layout changed.")


def _results_present(page: Page) -> bool:
    """After Search: True once the results grid has painted, False when the search
    legitimately matched zero returns.

    A zero-row result is normal data, not an error — e.g. the current month pulled
    on the 2nd when the 1st-2nd fell on a weekend, so no deeds were recorded.
    GenTax still renders the 'Select All' control for an empty grid but leaves it
    hidden (and omits the results table entirely), so waiting for it to become
    visible would burn the full timeout and fail the run.

    Verified against the live portal: empty -> control attached but hidden;
    non-empty -> control visible. If the control is missing from the DOM
    altogether, the layout changed and we fail loudly rather than silently
    reporting no sales.
    """
    try:
        page.wait_for_selector(config.TXT_SELECT_ALL, state="visible")
        return True
    except PlaywrightTimeout:
        if page.query_selector(config.TXT_SELECT_ALL) is None:
            raise RuntimeError(
                "Neither results nor a hidden 'Select All' control appeared after "
                "Search — TAP layout changed."
            ) from None
        return False


def _date_inputs(page: Page):
    """The two recorded-date text inputs (the only visible non-radio text inputs)."""
    out = []
    for el in page.query_selector_all("input"):
        if not el.is_visible():
            continue
        a = page.evaluate("e => ({id: e.id, t: e.getAttribute('type')})", el)
        if a["t"] in ("text", None) and not (a["id"] or "").startswith("Dc-l"):
            out.append(el)
    if len(out) < 2:
        raise RuntimeError("Expected two recorded-date inputs — TAP layout changed.")
    return out


def download_report(county: str, date_from: date, date_to: date, dest_dir: Path) -> Path | None:
    """Run the search for one county/window and download the CSV report.

    Returns None when the search matched no returns at all (a normal outcome for
    a short window — see _results_present); callers treat that as zero rows.

    Retries the whole browser session on failure. The DOR TAP portal is a
    third-party government endpoint that intermittently stalls (the initial
    navigation or a later step times out); a fresh session almost always
    succeeds. Fails loudly only after config.DOWNLOAD_ATTEMPTS are exhausted, so
    both the weekly scrape and the monthly history pull survive a transient blip.
    """
    last_exc: Exception | None = None
    for attempt in range(1, config.DOWNLOAD_ATTEMPTS + 1):
        try:
            return _download_once(county, date_from, date_to, dest_dir)
        except Exception as exc:
            last_exc = exc
            if attempt < config.DOWNLOAD_ATTEMPTS:
                print(f"  {county} attempt {attempt}/{config.DOWNLOAD_ATTEMPTS} failed "
                      f"({type(exc).__name__}: {exc}); retrying in "
                      f"{config.DOWNLOAD_RETRY_SLEEP_S}s")
                time.sleep(config.DOWNLOAD_RETRY_SLEEP_S)
    raise last_exc


def _download_once(county: str, date_from: date, date_to: date, dest_dir: Path) -> Path | None:
    """A single browser session: search one county/window and download the CSV.
    None when the search matched nothing."""
    d_from = date_from.strftime("%m/%d/%Y")
    d_to = date_to.strftime("%m/%d/%Y")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=config.HEADLESS)
        context = browser.new_context(user_agent=config.USER_AGENT, accept_downloads=True)
        if _TRACE_DIR:
            context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()
        page.set_default_timeout(config.NAV_TIMEOUT_MS)

        try:
            return _run_flow(page, county, d_from, d_to, dest_dir)
        except Exception:
            if _TRACE_DIR:
                _dump_diagnostics(page, context, county)
            raise
        finally:
            browser.close()


def _dump_diagnostics(page: Page, context, county: str) -> None:
    """Persist a screenshot + trace.zip for the failing county so the CI run can
    upload them as artifacts. Best-effort: never mask the original failure."""
    out = Path(_TRACE_DIR)
    out.mkdir(parents=True, exist_ok=True)
    slug = county.lower().replace(" ", "_")
    try:
        page.screenshot(path=str(out / f"failure_{slug}.png"), full_page=True)
    except Exception:
        pass
    try:
        context.tracing.stop(path=str(out / f"trace_{slug}.zip"))
    except Exception:
        pass


def _run_flow(page: Page, county: str, d_from: str, d_to: str, dest_dir: Path) -> Path | None:
    # NOT networkidle: GenTax's FWDC.loadManager polls continuously, so the page
    # often never reaches network-idle and goto times out. Wait for the DOM, then
    # for the specific control we're about to use.
    page.goto(config.TAP_RETR_URL, wait_until="domcontentloaded")
    page.wait_for_selector(config.SEL_DISCLAIMER_AGREE)
    page.click(config.SEL_DISCLAIMER_AGREE)
    page.wait_for_timeout(2000)
    page.click(config.SEL_ADVANCED_MODE)
    page.wait_for_timeout(2000)

    # Filter 1: County and municipality
    page.click(config.TXT_ADD_FILTER)
    page.wait_for_timeout(2000)
    _unset_criterion_select(page).select_option(label=config.CRIT_COUNTY)
    page.wait_for_timeout(2500)

    # Filter 2: Date recorded
    page.click(config.TXT_ADD_FILTER)
    page.wait_for_timeout(2000)
    _unset_criterion_select(page).select_option(label=config.CRIT_DATE_RECORDED)
    page.wait_for_timeout(2500)

    di = _date_inputs(page)
    di[-2].fill(d_from)
    di[-1].fill(d_to)
    page.wait_for_timeout(800)

    # County LAST (adding a filter re-renders and clears it).
    _county_select(page, county).select_option(label=county)
    page.wait_for_timeout(1500)

    page.click(config.SEL_SEARCH)
    # Results paint asynchronously; wait for the grid's Select All control rather
    # than for network-idle (same loadManager caveat as the initial navigation).
    # No matches is a valid outcome — report it as zero rows, not a failure.
    if not _results_present(page):
        print(f"  {county} {d_from}..{d_to}: no returns matched (0 rows)")
        return None
    page.wait_for_timeout(3000)

    page.click(config.TXT_SELECT_ALL)
    page.wait_for_timeout(2000)
    page.click(config.TXT_GENERATE_REPORT)
    page.wait_for_timeout(3000)

    dest_dir.mkdir(parents=True, exist_ok=True)
    with page.expect_download(timeout=config.NAV_TIMEOUT_MS) as dlinfo:
        page.click(config.TXT_CSV_REPORT)
    download = dlinfo.value
    out = dest_dir / f"retr_{county.lower()}.csv"
    download.save_as(str(out))
    return out
