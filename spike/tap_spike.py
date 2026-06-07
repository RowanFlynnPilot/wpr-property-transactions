"""Throwaway discovery script — NOT part of the pipeline. Documents how the DOR
TAP/GenTax RETR Advanced Search was reverse-engineered, and lets you re-confirm
selectors if DOR changes the portal.

Confirmed flow (Marathon County, recorded-date window):
  1. GET https://tap.revenue.wi.gov/mta/?Link=RETRSearch  (GenTax shell, JS-only)
  2. Accept disclaimer:           click #Dc-b   ("Agree")
  3. Choose Advanced mode:        click label.FastComboButtonItem_ADVANCED
  4. Add Filter -> Type = "County and municipality"  (criterion <select> picked
     by content: the unset dropdown offering "Date recorded" as an option)
  5. Add Filter -> Type = "Date recorded"; fill the two recorded-date text inputs
     (MM/DD/YYYY; GenTax reformats to DD-Mon-YYYY)
  6. Set primary County = Marathon LAST (adding a filter re-renders and clears it)
  7. Search:                      click #Dc-51
  8. "Select All" (spans ALL result pages) -> "Generate Report" -> "CSV Report"
  9. Download = 78-column CSV, one row per return, including Sale Price.

Gotchas the spike surfaced:
  - GenTax Dc- control IDs are deterministic across sessions, BUT value fields are
    safer located by content (survive re-renders).
  - Use Playwright native select_option/fill — raw JS value-set does NOT commit to
    the framework's model (search then fails 'County Required').
  - page.evaluate takes ONE arg; pass multiple values as a list: ([el, x]) => ...
  - Generate Report requires a selection first ("Please select at least one return").
  - ~45% of rows are $0 non-sales; filter via Conveyance Type == "Sale" or Sale Price,
    or add an "Arm's length" search filter at source.

Run:  python spike/tap_spike.py
"""

from datetime import date, timedelta
from playwright.sync_api import sync_playwright

URL = "https://tap.revenue.wi.gov/mta/?Link=RETRSearch"
SENTINEL = "Date recorded"
today = date.today()
d_from = (today - timedelta(days=30)).strftime("%m/%d/%Y")
d_to = today.strftime("%m/%d/%Y")


def unset_criterion(page):
    for _ in range(20):
        found = None
        for s in page.query_selector_all("select"):
            if not s.is_visible():
                continue
            info = page.evaluate(
                "([s,x])=>({cur:(s.options[s.selectedIndex]||{}).text||'',"
                "isCrit:Array.from(s.options).some(o=>o.text.trim()===x)})", [s, SENTINEL])
            if info["isCrit"] and info["cur"].strip() in ("Required", ""):
                found = s
        if found:
            return found
        page.wait_for_timeout(500)
    raise RuntimeError("criterion select not found")


def county_select(page, county):
    for s in page.query_selector_all("select"):
        if s.is_visible() and page.evaluate(
                "([s,c])=>Array.from(s.options).some(o=>o.text.trim()===c)", [s, county]):
            return s
    raise RuntimeError("county select not found")


def date_inputs(page):
    out = []
    for el in page.query_selector_all("input"):
        if not el.is_visible():
            continue
        a = page.evaluate("e=>({id:e.id,t:e.getAttribute('type')})", el)
        if a["t"] in ("text", None) and not (a["id"] or "").startswith("Dc-l"):
            out.append(el)
    return out


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(accept_downloads=True)
    page = ctx.new_page()
    page.set_default_timeout(45000)
    page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(3000)
    page.click("#Dc-b"); page.wait_for_timeout(2000)
    page.click("label.FastComboButtonItem_ADVANCED"); page.wait_for_timeout(2000)
    page.click("text=Add Filter"); page.wait_for_timeout(2000)
    unset_criterion(page).select_option(label="County and municipality"); page.wait_for_timeout(2500)
    page.click("text=Add Filter"); page.wait_for_timeout(2000)
    unset_criterion(page).select_option(label="Date recorded"); page.wait_for_timeout(2500)
    di = date_inputs(page); di[-2].fill(d_from); di[-1].fill(d_to); page.wait_for_timeout(800)
    county_select(page, "Marathon").select_option(label="Marathon"); page.wait_for_timeout(1500)
    page.click("#Dc-51"); page.wait_for_load_state("networkidle"); page.wait_for_timeout(5000)
    print(page.evaluate("()=>{const e=[...document.querySelectorAll('*')]"
                        ".find(x=>!x.children.length&&/returns found/i.test(x.innerText||''));"
                        "return e?e.innerText.trim():'?'}"))
    page.click("text=Select All"); page.wait_for_timeout(2000)
    page.click("text=Generate Report"); page.wait_for_timeout(3000)
    with page.expect_download(timeout=30000) as dl:
        page.click("text=CSV Report")
    dl.value.save_as("spike/retr_sample.csv")
    print("downloaded -> spike/retr_sample.csv")
    browser.close()
