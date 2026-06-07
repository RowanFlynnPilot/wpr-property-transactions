"""Apply the editorial publish policy. One responsibility: turn raw scraped
Transactions into the PublishedRecord set that becomes the world-readable feed.

Editor sign-off (2026-06-07):
  (1) genuine sales only        -> keep conveyance_type in SALE_CONVEYANCE_TYPES
  (2) ~$1,000 floor             -> keep sale_price >= MIN_SALE_PRICE
  (3) street/block, no house no -> strip leading house/fire number from address
  (4) never publish mailing     -> already absent from the data model
  (5) community-level map       -> no geocoordinates published (municipality only)

Redaction happens HERE, before write_json, because the feed is public.
"""

import re

from . import config
from .models import Transaction, PublishedRecord

# Leading house number: urban ("225"), hyphenated range ("1224-1226"), or
# Wisconsin rural fire number ("N5678", "N12W3456"). Matched against the first
# whitespace-delimited token. Ordinal street names ("15TH") have trailing letters
# and so do NOT match — they are street names, not house numbers, and are kept.
_HOUSE_NUMBER = re.compile(r"^([NSEW]?\d+([NSEW]\d+)?|\d+-\d+)$", re.IGNORECASE)


def _redact_address(address: str) -> str:
    """Drop the leading house/fire number; return the road name (title-cased).
    Addresses with no leading number (rural descriptors, blanks) pass through."""
    a = address.strip()
    if not a:
        return ""
    first, _, rest = a.partition(" ")
    if rest and _HOUSE_NUMBER.match(first):
        return rest.strip().title()
    return a.title()


def _is_publishable(t: Transaction) -> bool:
    return (
        t.conveyance_type in config.SALE_CONVEYANCE_TYPES
        and t.sale_price >= config.MIN_SALE_PRICE
    )


def apply_policy(transactions: list[Transaction]) -> list[PublishedRecord]:
    return [
        PublishedRecord(
            county=t.county,
            document_number=t.document_number,
            recorded_date=t.recorded_date,
            document_type=t.document_type,
            conveyance_type=t.conveyance_type,
            municipality=t.municipality,
            property_type=t.property_type,
            address=_redact_address(t.address),
            grantor=t.grantor,
            grantee=t.grantee,
            sale_price=t.sale_price,
            acres=t.acres,
        )
        for t in transactions
        if _is_publishable(t)
    ]
