"""DOR CSV -> Transaction list. One responsibility: turn the downloaded report
into typed records. Knows nothing about browsers.

Column names are the DOR RETR CSV headers (78 columns; we project a lean subset).
"""

import csv
from datetime import datetime
from pathlib import Path

from .models import Transaction


def _money(raw: str) -> int:
    """'$220,000.00' -> 220000 (whole dollars). '' / '$0.00' -> 0."""
    s = raw.replace("$", "").replace(",", "").strip()
    return int(round(float(s))) if s else 0


def _iso_date(raw: str) -> str:
    """DOR 'MM-DD-YYYY' -> ISO 'YYYY-MM-DD'. Fail loudly on unexpected format."""
    return datetime.strptime(raw.strip(), "%m-%d-%Y").date().isoformat()


def _acres(raw: str) -> float:
    """'0.85' -> 0.85; '20,269.00' -> 20269.0 (DOR uses thousands separators for
    large land parcels). '' -> 0.0."""
    s = raw.replace(",", "").strip()
    return float(s) if s else 0.0


def parse_csv(path: Path) -> list[Transaction]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [
            Transaction(
                county=r["County"].strip(),
                document_number=r["Document Number"].strip(),
                recorded_date=_iso_date(r["Recorded Date"]),
                document_type=r["Document Type"].strip(),
                conveyance_type=r["Conveyance Type"].strip(),
                municipality=r["Municipality"].strip(),
                parcel_id=r["Parcel Number"].strip(),
                property_type=r["Property Type"].strip(),
                address=r["Physical Address"].strip(),
                grantor=r["Grantor Name"].strip(),
                grantee=r["Grantee Name"].strip(),
                sale_price=_money(r["Sale Price"]),
                acres=_acres(r["Acres"]),
            )
            for r in reader
        ]
