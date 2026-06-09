"""Unit tests for the editorial publish policy (scraper/policy.py).

Per the 2026-06-08 amendment the feed publishes the FULL street address (house
number kept). `_clean_address` still strips the redundant trailing 'City, WI ZIP'
(county + municipality are separate fields), removes embedded parcel numbers (still
withheld), and tidies malformed DOR rows. These tests pin that behavior.
"""

from scraper.policy import _clean_address, _is_publishable, apply_policy
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
        property_use="Residential",
        address="225 Grand Ave",
        grantor="DOE, JANE",
        grantee="ROE, RICHARD",
        sale_price=220000,
        acres=0.5,
    )
    base.update(over)
    return Transaction(**base)


class TestCleanAddress:
    def test_keeps_urban_house_number(self):
        assert _clean_address("225 Grand Ave") == "225 Grand Ave"

    def test_keeps_hyphenated_range(self):
        assert _clean_address("1224-1226 Third St") == "1224-1226 Third St"

    def test_keeps_wi_fire_number(self):
        assert _clean_address("N5678 County Road K") == "N5678 County Road K"
        assert _clean_address("N12W3456 Smith Rd") == "N12W3456 Smith Rd"

    def test_keeps_ordinal_street_name(self):
        assert _clean_address("15th Street") == "15Th Street"

    def test_keeps_address_with_no_number(self):
        assert _clean_address("County Road X") == "County Road X"

    def test_empty_passes_through(self):
        assert _clean_address("") == ""
        assert _clean_address("   ") == ""

    def test_title_cases(self):
        assert _clean_address("225 GRAND AVE") == "225 Grand Ave"


class TestStripCityZip:
    """The trailing 'City, WI ZIP' postal suffix is removed; the street address
    (with house number) remains. Inputs use the raw uppercase DOR form."""

    def test_comma_delimited_city(self):
        assert _clean_address("123 FOLZ ROAD, STRATFORD, WI 54484") == "123 Folz Road"

    def test_comma_city_keeps_house_number(self):
        assert _clean_address("225 JAMES STREET, KRONENWETTER, WI 54455") == "225 James Street"

    def test_no_comma_before_state(self):
        assert _clean_address("400 11TH STREET, MOSINEE WI 54455") == "400 11Th Street"

    def test_no_comma_before_city(self):
        # City runs onto the street with only a space.
        assert _clean_address("770 DJ LANE WESTON, WI 54476") == "770 Dj Lane"
        assert _clean_address("12 SILVER BIRCH CIRCLE ELAND, WI 54427") == "12 Silver Birch Circle"

    def test_zip_plus_four(self):
        assert _clean_address("310 BROWN STREET, WAUSAU, WI 54403-1234") == "310 Brown Street"

    def test_no_postal_suffix_unchanged(self):
        assert _clean_address("OKEEFE DR") == "Okeefe Dr"


class TestMalformedAddresses:
    """DOR data-quality oddities are tidied, but the real house number is kept and
    the parcel ID (still withheld) is removed."""

    def test_embedded_parcel_number_stripped(self):
        assert (
            _clean_address("COUNTY ROAD FF (VACANT LAND) - 004-3006-032-0999")
            == "County Road Ff (Vacant Land)"
        )

    def test_duplicated_street_keeps_numbered_form(self):
        assert (
            _clean_address("PRAIRIE VIEW CIR, 152692 PRAIRIE VIEW CIR")
            == "152692 Prairie View Cir"
        )
        assert _clean_address("BROOKS PL, 639 BROOKS PL") == "639 Brooks Pl"

    def test_leading_ampersand_kept_number(self):
        assert _clean_address("& 1007 N 3RD AVE") == "1007 N 3Rd Ave"

    def test_trailing_comma_artifact(self):
        assert _clean_address("ALLEN STREET,") == "Allen Street"
        assert _clean_address("COUNTY ROAD M,") == "County Road M"

    def test_lone_trailing_number_segment_dropped(self):
        # "639" with no street can't be reattached; the bare street is kept.
        assert _clean_address("BROOKS PL, 639") == "Brooks Pl"

    def test_keeps_apartment_segment(self):
        assert _clean_address("11 WHITESPIRE RD, APT 11") == "11 Whitespire Rd, Apt 11"

    def test_keeps_distinct_descriptor_segments(self):
        assert (
            _clean_address("VACANT LAND, EAU CLAIRE RIVER ROAD")
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
    def test_filters_and_cleans(self):
        txns = [
            _txn(address="225 Grand Ave", sale_price=220000),          # kept
            _txn(sale_price=500),                                      # dropped: below floor
            _txn(conveyance_type="Quit claim", sale_price=300000),    # dropped: non-sale
        ]
        out = apply_policy(txns)
        assert len(out) == 1
        rec = out[0]
        assert isinstance(rec, PublishedRecord)
        assert rec.address == "225 Grand Ave"
        assert rec.grantor == "DOE, JANE"  # seller name published

    def test_parcel_id_never_published(self):
        rec = apply_policy([_txn(parcel_id="290-9999")])[0]
        assert not hasattr(rec, "parcel_id")
