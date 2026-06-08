"""Build the rolling 12-month monthly-median price history (per county + overall).

One responsibility: produce `data/price_history.json`, a tiny aggregate artifact
(medians + counts, no addresses or names) for the frontend trend chart.

TAP caps a search at 1000 returns, so each (county, month) is pulled separately
(well under the cap) and bucketed. Runs are incremental: the trailing
HISTORY_REFRESH_MONTHS plus any month missing from the committed series are
re-pulled; older months are reused from the existing file. The first run, with no
file, backfills the whole window.

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

# A backfill makes ~72 sequential TAP pulls; a single transient navigation
# timeout shouldn't abort the whole run. Each pull opens its own browser, so a
# retry is a clean fresh attempt.
_PULL_ATTEMPTS = 3


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
    """The n trailing 'YYYY-MM' keys, oldest first, ending with today's month."""
    y, m = today.year, today.month
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _month_bounds(key: str, today: date) -> tuple[date, date]:
    """First and last day of a 'YYYY-MM' month, clamped to today for the current
    (still-accruing) month."""
    y, m = (int(p) for p in key.split("-"))
    first = date(y, m, 1)
    last = date(y, m, calendar.monthrange(y, m)[1])
    return first, min(last, today)


def _load_existing() -> dict:
    """Committed series -> {month: {key: {'median': int|None, 'count': int}}}."""
    path = config.HISTORY_OUTPUT_PATH
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for i, month in enumerate(data.get("months", [])):
        out[month] = {}
        for key, vals in data.get("series", {}).items():
            out[month][key] = {
                "median": vals[i],
                "count": data.get("counts", {}).get(key, [0] * len(vals))[i],
            }
    return out


def _median(prices: list[int]) -> int | None:
    return int(round(statistics.median(prices))) if prices else None


def _pull_month(key: str, today: date, tmp_dir: Path) -> dict:
    """Pull every county for one month and aggregate medians + counts, including
    an 'Overall' across all counties."""
    d_from, d_to = _month_bounds(key, today)
    entry: dict[str, dict] = {}
    all_prices: list[int] = []
    for county in config.COUNTIES:
        csv_path = _download(county, d_from, d_to, tmp_dir)
        published = apply_policy(parse_csv(csv_path))
        prices = [p.sale_price for p in published]
        all_prices.extend(prices)
        entry[county] = {"median": _median(prices), "count": len(prices)}
    entry["Overall"] = {"median": _median(all_prices), "count": len(all_prices)}
    print(f"  {key}: {entry['Overall']['count']} sales, "
          f"overall median {entry['Overall']['median']}")
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

    keys = ["Overall", *config.COUNTIES]
    series = {k: [] for k in keys}
    counts = {k: [] for k in keys}
    for month in months:
        src = fresh.get(month) or existing.get(month) or {}
        for k in keys:
            cell = src.get(k, {"median": None, "count": 0})
            series[k].append(cell["median"])
            counts[k].append(cell["count"])

    payload = {
        "generated_on": today.isoformat(),
        "months": months,
        "counties": list(config.COUNTIES),
        "series": series,
        "counts": counts,
    }
    config.HISTORY_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    config.HISTORY_OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(months)}-month history for {len(keys)} series to "
          f"{config.HISTORY_OUTPUT_PATH}")


if __name__ == "__main__":
    build()
