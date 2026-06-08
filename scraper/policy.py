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

# Trailing postal suffix "<city>, WI <zip>". DOR is inconsistent: the comma before
# the city is sometimes missing and the city sometimes runs onto the street with
# only a space (e.g. "Dj Lane Weston, WI 54476"). The state + ZIP is the reliable
# anchor, so we match on that and remove the city separately.
_STATE_ZIP = re.compile(r"\s*,?\s*WI\s+\d{5}(?:-\d{4})?\s*$", re.IGNORECASE)


def _strip_city_zip(a: str) -> str:
    """Remove a trailing 'City, WI ZIP' postal suffix, leaving just the street.
    Only fires when the WI+ZIP anchor is present, so a bare comma elsewhere is
    never touched."""
    without_zip = _STATE_ZIP.sub("", a)
    if without_zip == a:
        return a  # no postal suffix
    without_zip = without_zip.strip().rstrip(",").strip()
    # Drop the city: everything after the last comma, or — when DOR ran the city
    # onto the street with no comma — the trailing word.
    if "," in without_zip:
        return without_zip.rsplit(",", 1)[0].strip()
    return without_zip.rsplit(" ", 1)[0].strip()


# Marathon County parcel number embedded in an address string (e.g.
# "County Road Ff (Vacant Land) - 004-3006-032-0999"). Parcel IDs are withheld
# (a free GIS lookup re-identifies the property), so strip any that appear.
_PARCEL = re.compile(r"\s*-?\s*\d{3}-\d{4}-\d{3}-\d{4}\b")


def _strip_leading_number(segment: str) -> str:
    """Drop a leading house/fire number (and a stray leading '&') from one address
    segment. Returns '' if the segment is only a number."""
    s = segment.strip().lstrip("&").strip()
    first, _, rest = s.partition(" ")
    if _HOUSE_NUMBER.match(first):
        return rest.strip()
    return s


def _redact_address(address: str) -> str:
    """Reduce a raw DOR address to a street/block label:
      - strip the trailing postal 'City, WI ZIP' (``_strip_city_zip``),
      - remove any embedded parcel number (withheld per policy),
      - per comma-segment, drop a leading house/fire number and a stray '&',
        discard empties, and dedupe — this cleans malformed rows like
        'Prairie View Cir, 152692 Prairie View Cir' and trailing-comma artifacts,
      - title-case the result.
    Ordinal street names ('15th Street') are kept — they are not house numbers."""
    a = _PARCEL.sub("", _strip_city_zip(address.strip()))
    seen = []
    for seg in a.split(","):
        cleaned = _strip_leading_number(seg).strip(" -").strip()
        if cleaned and cleaned.lower() not in (s.lower() for s in seen):
            seen.append(cleaned)
    return ", ".join(seen).title()


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
