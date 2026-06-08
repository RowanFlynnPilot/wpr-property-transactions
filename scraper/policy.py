"""Apply the editorial publish policy. One responsibility: turn raw scraped
Transactions into the PublishedRecord set that becomes the world-readable feed.

Editor sign-off (2026-06-07), amended (2026-06-08):
  (1) genuine sales only        -> keep conveyance_type in SALE_CONVEYANCE_TYPES
  (2) ~$1,000 floor             -> keep sale_price >= MIN_SALE_PRICE
  (3) full street address       -> keep the house number; still drop the redundant
                                   trailing 'City, WI ZIP' (county + municipality are
                                   separate fields) and any embedded parcel number.
                                   [AMENDED 2026-06-08: the editor reversed the
                                   original "street/block, no house number" choice —
                                   the feed now carries full property addresses.]
  (4) never publish mailing     -> party NAMES are published (grantor/grantee); their
                                   mailing addresses are absent from the data model.
  (5) community-level map       -> no geocoordinates published (municipality only)

Address cleaning happens HERE, before write_json, because the feed is public.
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


def _clean_address(address: str) -> str:
    """Normalize a raw DOR address to a clean full street address (house number
    KEPT, per the 2026-06-08 amendment):
      - strip the trailing postal 'City, WI ZIP' (``_strip_city_zip``) — county and
        municipality are separate published fields,
      - remove any embedded parcel number (still withheld),
      - per comma-segment, drop a stray leading '&' and trailing-comma artifacts,
        and collapse malformed 'St, <num> St' duplications to the numbered form,
      - title-case the result.
    `_strip_leading_number` is used only to derive a street key for dedupe — the
    house number itself is preserved in the output."""
    a = _PARCEL.sub("", _strip_city_zip(address.strip()))
    chosen: dict[str, str] = {}  # street key -> display segment
    order: list[str] = []
    for seg in a.split(","):
        s = seg.strip().lstrip("&").strip(" -").strip()
        if not s:
            continue
        key = _strip_leading_number(s).strip(" -").strip().lower()
        if not key:
            continue  # segment was only a number
        has_number = _strip_leading_number(s) != s
        if key not in chosen:
            chosen[key] = s
            order.append(key)
        elif has_number and _strip_leading_number(chosen[key]) == chosen[key]:
            chosen[key] = s  # upgrade a bare street to its numbered duplicate
    return ", ".join(chosen[k] for k in order).title()


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
            address=_clean_address(t.address),
            grantor=t.grantor,
            grantee=t.grantee,
            sale_price=t.sale_price,
            acres=t.acres,
        )
        for t in transactions
        if _is_publishable(t)
    ]
