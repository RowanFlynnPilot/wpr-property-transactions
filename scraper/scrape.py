"""Orchestration entry point. One responsibility: for each county, download the
report, parse it, collect, and write the static feed.

    python -m scraper.scrape
"""

import tempfile
from datetime import date, timedelta
from pathlib import Path

from . import config
from .models import write_json
from .parse import parse_csv
from .policy import apply_policy
from .tap import download_report


def run() -> None:
    today = date.today()
    start = today - timedelta(days=config.DATE_WINDOW_DAYS)
    raw = []

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for county in config.COUNTIES:
            csv_path = download_report(county, start, today, tmp_dir)
            rows = parse_csv(csv_path)
            print(f"{county}: {len(rows)} returns scraped")
            raw.extend(rows)

    published = apply_policy(raw)
    print(f"{len(raw)} returns -> {len(published)} published "
          f"(sales >= ${config.MIN_SALE_PRICE})")
    write_json(published, config.OUTPUT_PATH, generated_on=today)
    print(f"Wrote {len(published)} transactions to {config.OUTPUT_PATH}")


if __name__ == "__main__":
    run()
