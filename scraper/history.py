"""Build the rolling 12-month monthly-median price history.

One responsibility: produce `data/price_history.json`, a tiny aggregate artifact
(medians + counts, no addresses or names) for the frontend trend chart and KPIs.

Carries three use groups so the headline follows the Overall/Residential/Commercial
selector: All (every sale), Residential (DOR Single family + Multi-family), and
Commercial (DOR Commercial + Manufacturing). For each (group, geography, month) we
store the median sale price and the sale count, where geography is each county plus
"Region" (all six combined).

TAP caps a search at 1000 returns, so each (county, month) is pulled separately and
bucketed. Runs are incremental — the trailing HISTORY_REFRESH_MONTHS plus any month
missing from the committed series are re-pulled; the first run backfills the window.

    python -m scraper.history
"""

import calendar
import json
import statistics
import tempfile
import time
from datetime import date
from pathlib import Path

from . import config
from .parse import parse_csv
from .policy import apply_policy
from .tap import download_report

# Use groups for the Overall/Residential/Commercial selector. Keep in sync with the
# frontend grouping (frontend/src/lib/use.js).
RESIDENTIAL_USES = {"Single family", "Multi-family"}
COMMERCIAL_USES = {"Commercial", "Manufacturing"}
USE_GROUPS = ["All", "Residential", "Commercial"]

_PULL_ATTEMPTS = 3


def _in_group(use: str, group: str) -> bool:
    if group == "All":
        return True
    if group == "Residential":
        return use in RESIDENTIAL_USES
    if group == "Commercial":
        return use in COMMERCIAL_USES
    return False


def _download(county: str, d_from: date, d_to: date, tmp_dir: Path) -> Path:
    for attempt in range(1, _PULL_ATTEMPTS + 1):
        try:
            return download_report(county, d_from, d_to, tmp_dir)
        except Exception as exc:
            if attempt == _PULL_ATTEMPTS:
                raise
            print(f"    {county} {d_from:%Y-%m} attempt {attempt} failed ({exc}); retrying")
            time.sleep(5)


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


def _pull_month(key: str, today: date, tmp_dir: Path) -> dict:
    """Pull every county for one month; aggregate medians + counts per use group and
    geography. Returns {group: {geoKey: {'median','count'}}}."""
    d_from, d_to = _month_bounds(key, today)
    by_county = {}
    for county in config.COUNTIES:
        published = apply_policy(parse_csv(_download(county, d_from, d_to, tmp_dir)))
        by_county[county] = [(p.property_use, p.sale_price) for p in published]

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
          f"Com={entry['Commercial']['Region']['count']}")
    return entry


def build() -> None:
    today = date.today()
    months = _month_keys(today, config.HISTORY_MONTHS)
    existing = _load_existing()
    refresh = set(months[-config.HISTORY_REFRESH_MONTHS:]) | {m for m in months if m not in existing}

    print(f"History window {months[0]}..{months[-1]}; "
          f"pulling {len(refresh)} month(s) x {len(config.COUNTIES)} counties, "
          f"reusing {len(months) - len(refresh)} from file")

    fresh: dict[str, dict] = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for key in sorted(refresh):
            fresh[key] = _pull_month(key, today, tmp_dir)

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


if __name__ == "__main__":
    build()
