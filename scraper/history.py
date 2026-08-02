"""Build the rolling 12-month aggregates from monthly (county, month) pulls.

Two artifacts, one pull path:

  data/price_history.json — monthly-median trend (medians + counts, no addresses
  or names) for the frontend trend chart and KPIs. Three use groups so the
  headline follows the Overall/Residential/Commercial selector: All, Residential
  (DOR Single family), and Commercial (DOR Commercial + Manufacturing +
  Multi-family). Geography is each county plus "Region" (all six combined).

  data/muni_medians.json — per-(county, municipality) single-family medians over
  the trailing window, for wpr-finance-tools' "typical sale here" feature. The
  artifact stores the underlying per-month PRICE LISTS (prices only — no
  addresses, names, or parcels) because a trailing-window median must be computed
  from raw prices; monthly medians cannot be recombined. Every median row carries
  its count — consumers apply their own sample-size threshold.

TAP caps a search at 1000 returns, so each (county, month) is pulled separately
and bucketed. Runs are incremental — the trailing HISTORY_REFRESH_MONTHS plus any
month missing from EITHER committed artifact are re-pulled; the first run after
adding the muni artifact backfills the full window (~72 pulls).

    python -m scraper.history
"""

import calendar
import json
import statistics
import tempfile
from datetime import date
from pathlib import Path

from . import config
from .parse import parse_csv
from .policy import apply_policy
from .tap import download_report

# Use groups for the Overall/Residential/Commercial selector. Keep in sync with the
# frontend grouping (frontend/src/lib/use.js). Multi-family (apartment/investment
# property) is grouped with Commercial per the editor — "Residential" means
# single-family homes.
RESIDENTIAL_USES = {"Single family"}
COMMERCIAL_USES = {"Commercial", "Manufacturing", "Multi-family"}
USE_GROUPS = ["All", "Residential", "Commercial"]

def _in_group(use: str, group: str) -> bool:
    if group == "All":
        return True
    if group == "Residential":
        return use in RESIDENTIAL_USES
    if group == "Commercial":
        return use in COMMERCIAL_USES
    return False


def _month_keys(today: date, n: int) -> list[str]:
    y, m = today.year, today.month
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _month_bounds(key: str, today: date) -> tuple[date, date]:
    y, m = (int(p) for p in key.split("-"))
    first = date(y, m, 1)
    last = date(y, m, calendar.monthrange(y, m)[1])
    return first, min(last, today)


def _median(prices: list[int]) -> int | None:
    return int(round(statistics.median(prices))) if prices else None


def muni_price_lists(published, county: str) -> dict[str, list[int]]:
    """One county-month of published records -> {"County|Municipality": sorted
    single-family sale prices}. Prices only — the artifact must stay free of
    addresses, names, and parcels. Pure; unit-tested browser-free."""
    out: dict[str, list[int]] = {}
    for p in published:
        if p.property_use in RESIDENTIAL_USES:
            out.setdefault(f"{county}|{p.municipality}", []).append(p.sale_price)
    return {k: sorted(v) for k, v in sorted(out.items())}


def muni_median_rows(months: list[str], monthly_prices: dict[str, dict[str, list[int]]]) -> list[dict]:
    """Trailing-window medians from the per-month price lists. Every row carries
    its count; no threshold is applied here — that is a consumer decision.
    Pure; unit-tested browser-free."""
    pooled: dict[str, list[int]] = {}
    for month in months:
        for key, prices in monthly_prices.get(month, {}).items():
            pooled.setdefault(key, []).extend(prices)
    rows = []
    for key in sorted(pooled):
        county, municipality = key.split("|", 1)
        prices = pooled[key]
        rows.append({
            "county": county,
            "municipality": municipality,
            "median": _median(prices),
            "count": len(prices),
        })
    return rows


def _load_existing() -> dict:
    """Committed file -> {month: {group: {geoKey: {'median','count'}}}}."""
    path = config.HISTORY_OUTPUT_PATH
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    groups = data.get("useGroups", [])
    if not groups:  # old (pre-use-group) schema -> force a full rebuild
        return {}
    out: dict[str, dict] = {}
    for i, month in enumerate(data["months"]):
        out[month] = {}
        for g in groups:
            out[month][g] = {}
            for k, vals in data["series"][g].items():
                cnt = data["counts"][g][k]
                out[month][g][k] = {"median": vals[i], "count": cnt[i]}
    return out


def _pull_month(key: str, today: date, tmp_dir: Path) -> tuple[dict, dict]:
    """Pull every county for one month; aggregate medians + counts per use group
    and geography, plus per-municipality single-family price lists. Returns
    ({group: {geoKey: {'median','count'}}}, {"County|Municipality": [prices]})."""
    d_from, d_to = _month_bounds(key, today)
    by_county = {}
    muni_prices: dict[str, list[int]] = {}
    for county in config.COUNTIES:
        csv_path = download_report(county, d_from, d_to, tmp_dir)
        # None = the search matched no returns (e.g. the current month pulled on
        # the 2nd when the 1st-2nd was a weekend). Zero rows, not a failure.
        published = apply_policy(parse_csv(csv_path)) if csv_path else []
        by_county[county] = [(p.property_use, p.sale_price) for p in published]
        muni_prices.update(muni_price_lists(published, county))

    entry = {g: {} for g in USE_GROUPS}
    for g in USE_GROUPS:
        region: list[int] = []
        for county in config.COUNTIES:
            prices = [pr for (use, pr) in by_county[county] if _in_group(use, g)]
            entry[g][county] = {"median": _median(prices), "count": len(prices)}
            region.extend(prices)
        entry[g]["Region"] = {"median": _median(region), "count": len(region)}
    print(f"  {key}: All={entry['All']['Region']['count']} "
          f"Res={entry['Residential']['Region']['count']} "
          f"Com={entry['Commercial']['Region']['count']} "
          f"munis={len(muni_prices)}")
    return entry, muni_prices


def _load_existing_muni() -> dict:
    """Committed muni artifact -> {month: {"County|Municipality": [prices]}}."""
    path = config.MUNI_MEDIANS_OUTPUT_PATH
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("monthly_prices", {})


def build() -> None:
    today = date.today()
    months = _month_keys(today, config.HISTORY_MONTHS)
    existing = _load_existing()
    existing_muni = _load_existing_muni()
    refresh = (
        set(months[-config.HISTORY_REFRESH_MONTHS:])
        | {m for m in months if m not in existing}
        | {m for m in months if m not in existing_muni}
    )

    print(f"History window {months[0]}..{months[-1]}; "
          f"pulling {len(refresh)} month(s) x {len(config.COUNTIES)} counties, "
          f"reusing {len(months) - len(refresh)} from file")

    fresh: dict[str, dict] = {}
    fresh_muni: dict[str, dict] = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for key in sorted(refresh):
            fresh[key], fresh_muni[key] = _pull_month(key, today, tmp_dir)

    geo_keys = ["Region", *config.COUNTIES]
    series = {g: {k: [] for k in geo_keys} for g in USE_GROUPS}
    counts = {g: {k: [] for k in geo_keys} for g in USE_GROUPS}
    for month in months:
        src = fresh.get(month) or existing.get(month) or {}
        for g in USE_GROUPS:
            gsrc = src.get(g, {})
            for k in geo_keys:
                cell = gsrc.get(k, {"median": None, "count": 0})
                series[g][k].append(cell["median"])
                counts[g][k].append(cell["count"])

    payload = {
        "generated_on": today.isoformat(),
        "months": months,
        "counties": list(config.COUNTIES),
        "useGroups": USE_GROUPS,
        "series": series,
        "counts": counts,
    }
    config.HISTORY_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    config.HISTORY_OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(months)}-month history ({len(USE_GROUPS)} use groups) to "
          f"{config.HISTORY_OUTPUT_PATH}")

    monthly_prices = {m: (fresh_muni.get(m) or existing_muni.get(m) or {}) for m in months}
    muni_payload = {
        "generated_on": today.isoformat(),
        "use_group": "Single family",
        "months": months,
        "note": ("Per-municipality single-family sale prices by month (prices only) and "
                 "trailing-window medians. Counts are published with every median; "
                 "consumers apply their own sample-size threshold. The final month is "
                 "in progress until it closes."),
        "municipalities": muni_median_rows(months, monthly_prices),
        "monthly_prices": monthly_prices,
    }
    config.MUNI_MEDIANS_OUTPUT_PATH.write_text(
        json.dumps(muni_payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(muni_payload['municipalities'])} municipality medians to "
          f"{config.MUNI_MEDIANS_OUTPUT_PATH}")


if __name__ == "__main__":
    build()
