"""Throwaway spike: does a single 12-month county pull fit one TAP session?

Pulls Marathon for the trailing ~12 months, prints download time, CSV size, raw +
published counts, and the per-month median (the exact aggregate the history feature
needs). Not part of the pipeline.

    python spike/history_spike.py
"""

import collections
import statistics
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path

from scraper.tap import download_report
from scraper.parse import parse_csv
from scraper.policy import apply_policy


def run() -> None:
    today = date.today()
    start = today - timedelta(days=366)
    print(f"Pulling Marathon, {start} -> {today} …")
    with tempfile.TemporaryDirectory() as tmp:
        t0 = time.time()
        csv = download_report("Marathon", start, today, Path(tmp))
        elapsed = time.time() - t0
        size_mb = Path(csv).stat().st_size / 1e6
        rows = parse_csv(csv)
    pub = apply_policy(rows)
    print(f"\ndownload+save: {elapsed:.1f}s | csv {size_mb:.2f} MB")
    print(f"raw returns: {len(rows)} | published sales (>=$1k): {len(pub)}\n")
    by_month = collections.defaultdict(list)
    for p in pub:
        by_month[p.recorded_date[:7]].append(p.sale_price)
    print("per-month published median:")
    for m in sorted(by_month):
        v = by_month[m]
        print(f"  {m}: {len(v):4} sales  median ${int(statistics.median(v)):,}")


if __name__ == "__main__":
    run()
