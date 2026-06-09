"""The Transaction record schema. One responsibility: define the shape of a
parsed RETR row and how it serializes to the static JSON the frontend reads.

Field set is a lean projection of the 78-column DOR CSV — enough for the table
(parties, address, parcel, deed type) and the charts (price, type, municipality,
date, acres). `conveyance_type` is retained so downstream editorial filtering
(sale vs. non-sale) needs no re-scrape. `sale_price` is whole dollars; 0 is valid
(quitclaims / trust / estate transfers — ~45% of rows).
"""

from dataclasses import dataclass, asdict
from datetime import date
import json
from pathlib import Path


@dataclass(frozen=True)
class Transaction:
    county: str
    document_number: str
    recorded_date: str        # ISO date string, YYYY-MM-DD
    document_type: str        # e.g. "Warranty deed", "Quit claim deed"
    conveyance_type: str      # e.g. "Sale", "Trust (conveyance to)" — sale signal
    municipality: str
    parcel_id: str
    property_type: str        # structure: Land and buildings / Land only / Condominium
    property_use: str         # DOR class: Residential / Commercial / Manufacturing / ...
    address: str
    grantor: str
    grantee: str
    sale_price: int           # whole dollars; 0 is valid (non-sale transfer)
    acres: float

    def __post_init__(self) -> None:
        if not self.county or not self.municipality:
            raise ValueError(f"Transaction missing county/municipality: {self!r}")
        if self.sale_price < 0:
            raise ValueError(f"Negative sale_price: {self!r}")


@dataclass(frozen=True)
class PublishedRecord:
    """The public projection of a Transaction, after the editorial policy is
    applied (scraper/policy.py). This is exactly what lands in the world-readable
    feed: full street address (house number kept; city/ZIP and parcel removed), no
    parcel number, no party mailing addresses. If a field isn't here, it is not
    published.
    """

    county: str
    document_number: str
    recorded_date: str
    document_type: str
    conveyance_type: str
    municipality: str
    property_type: str
    property_use: str         # Residential / Commercial / Manufacturing / Agricultural / ...
    address: str              # full street address (city/ZIP + parcel removed)
    grantor: str              # seller name
    grantee: str              # buyer name
    sale_price: int
    acres: float


def write_json(records: list, out_path: Path, *, generated_on: date) -> None:
    """Write the static feed from any list of dataclass records. Single output
    mechanism, no backup file."""
    if not records:
        raise RuntimeError(
            "Refusing to write an empty feed — a real run always finds rows. "
            "Investigate the scrape/policy rather than overwriting good data with nothing."
        )
    payload = {
        "generated_on": generated_on.isoformat(),
        "count": len(records),
        "transactions": [asdict(r) for r in records],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
