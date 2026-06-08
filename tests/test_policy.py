"""Unit tests for the editorial publish policy (scraper/policy.py).

The address redaction is a privacy control on a world-readable feed: a regression
that lets a leading house number through re-identifies a specific home. These
tests pin every documented edge case (urban number, hyphenated range, WI rural
fire number, ordinal street name) so that can't regress silently.
"""

from scraper.policy import _redact_address, _is_publishable, apply_policy
from scraper.models import Transaction, PublishedRecord


def _txn(**over):
    """A publishable Transaction with overridable fields."""
    base = dict(
        county="Marathon",
        document_number="1",
        recorded_date="2026-06-01",
        document_type="Warranty deed",
        conveyance_type="Sale",
        municipality="Wausau, City of",
        parcel_id="290-1234",
        property_type="Land and buildings/improvements",
        address="225 Grand Ave",
        grantor="DOE, JANE",
        grantee="ROE, RICHARD",
        sale_price=220000,
        acres=0.5,
    )
    base.update(over)
    return Transaction(**base)


class TestRedactAddress:
    def test_strips_urban_house_number(self):
        assert _redact_address("225 Grand Ave") == "Grand Ave"

    def test_strips_hyphenated_range(self):
        assert _redact_address("1224-1226 Third St") == "Third St"

    def test_strips_wi_fire_number_simple(self):
        assert _redact_address("N5678 County Road K") == "County Road K"

    def test_strips_wi_fire_number_grid(self):
        # N12W3456 — the WI grid-style rural fire number.
        assert _redact_address("N12W3456 Smith Rd") == "Smith Rd"

    def test_keeps_ordinal_street_name(self):
        # "15th" is a street name, not a house number — must NOT be stripped.
        out = _redact_address("15th Street")
        assert "Street" in out
        assert out.lower().startswith("15th")

    def test_keeps_address_with_no_leading_number(self):
        assert _redact_address("County Road X") == "County Road X"

    def test_empty_passes_through(self):
        assert _redact_address("") == ""
        assert _redact_address("   ") == ""

    def test_title_cases_road_name(self):
        assert _redact_address("225 GRAND AVE") == "Grand Ave"


class TestStripCityZip:
    """Trailing 'City, WI ZIP' postal suffix is removed, leaving the street only.
    Inputs use the raw uppercase DOR form."""

    def test_comma_delimited_city(self):
        assert _redact_address("FOLZ ROAD, STRATFORD, WI 54484") == "Folz Road"

    def test_comma_city_with_house_number(self):
        assert _redact_address("225 JAMES STREET, KRONENWETTER, WI 54455") == "James Street"

    def test_no_comma_before_state(self):
        assert _redact_address("11TH STREET, MOSINEE WI 54455") == "11Th Street"

    def test_no_comma_before_city(self):
        # City runs onto the street with only a space.
        assert _redact_address("DJ LANE WESTON, WI 54476") == "Dj Lane"
        assert _redact_address("SILVER BIRCH CIRCLE ELAND, WI 54427") == "Silver Birch Circle"

    def test_multi_word_street_with_city(self):
        assert (
            _redact_address("VACANT LAND ON COUNTY ROAD F, SPENCER, WI 54479")
            == "Vacant Land On County Road F"
        )

    def test_zip_plus_four(self):
        assert _redact_address("BROWN STREET, WAUSAU, WI 54403-1234") == "Brown Street"

    def test_no_postal_suffix_unchanged(self):
        # A street with no WI+ZIP anchor is left alone (and a stray comma is safe).
        assert _redact_address("OKEEFE DR") == "Okeefe Dr"


class TestMalformedAddresses:
    """Pre-existing DOR data-quality oddities that must not leak identifying
    numbers into the public feed."""

    def test_embedded_parcel_number_stripped(self):
        assert (
            _redact_address("COUNTY ROAD FF (VACANT LAND) - 004-3006-032-0999")
            == "County Road Ff (Vacant Land)"
        )

    def test_duplicated_street_with_fire_number(self):
        assert (
            _redact_address("PRAIRIE VIEW CIR, 152692 PRAIRIE VIEW CIR")
            == "Prairie View Cir"
        )

    def test_duplicated_street_with_house_number(self):
        assert _redact_address("BROOKS PL, 639 BROOKS PL") == "Brooks Pl"

    def test_leading_ampersand_then_house_number(self):
        assert _redact_address("& 1007 N 3RD AVE") == "N 3Rd Ave"

    def test_trailing_comma_artifact(self):
        assert _redact_address("ALLEN STREET,") == "Allen Street"
        assert _redact_address("COUNTY ROAD M,") == "County Road M"

    def test_lone_trailing_number_segment_dropped(self):
        assert _redact_address("BROOKS PL, 639") == "Brooks Pl"

    def test_keeps_apartment_segment(self):
        assert _redact_address("WHITESPIRE RD, APT 11") == "Whitespire Rd, Apt 11"

    def test_keeps_distinct_descriptor_segments(self):
        assert (
            _redact_address("VACANT LAND, EAU CLAIRE RIVER ROAD")
            == "Vacant Land, Eau Claire River Road"
        )


class TestIsPublishable:
    def test_sale_above_floor_is_published(self):
        assert _is_publishable(_txn(conveyance_type="Sale", sale_price=1000)) is True

    def test_below_floor_excluded(self):
        assert _is_publishable(_txn(conveyance_type="Sale", sale_price=999)) is False

    def test_non_sale_excluded(self):
        assert _is_publishable(
            _txn(conveyance_type="Trust (conveyance to)", sale_price=500000)
        ) is False


class TestApplyPolicy:
    def test_filters_and_redacts(self):
        txns = [
            _txn(address="225 Grand Ave", sale_price=220000),          # kept
            _txn(sale_price=500),                                      # dropped: below floor
            _txn(conveyance_type="Quit claim", sale_price=300000),    # dropped: non-sale
        ]
        out = apply_policy(txns)
        assert len(out) == 1
        rec = out[0]
        assert isinstance(rec, PublishedRecord)
        assert rec.address == "Grand Ave"

    def test_parcel_id_never_published(self):
        rec = apply_policy([_txn(parcel_id="290-9999")])[0]
        assert not hasattr(rec, "parcel_id")
