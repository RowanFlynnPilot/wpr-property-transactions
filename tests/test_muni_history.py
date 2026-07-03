"""Browser-free tests for the per-municipality median aggregation in
scraper/history.py (muni_price_lists + muni_median_rows)."""

from scraper.history import muni_median_rows, muni_price_lists
from scraper.models import PublishedRecord


def _rec(municipality: str, use: str, price: int) -> PublishedRecord:
    return PublishedRecord(
        county="Marathon",
        document_number="1",
        recorded_date="2026-06-15",
        document_type="Warranty deed",
        conveyance_type="Sale",
        municipality=municipality,
        property_type="Land and buildings/improvements",
        property_use=use,
        address="123 Main St",
        grantor="A",
        grantee="B",
        sale_price=price,
        acres=0.25,
    )


def test_price_lists_filter_to_single_family_and_sort():
    published = [
        _rec("Wausau, City of", "Single family", 250000),
        _rec("Wausau, City of", "Single family", 180000),
        _rec("Wausau, City of", "Commercial", 900000),
        _rec("Wausau, City of", "Multi-family", 400000),
        _rec("Weston, Village of", "Single family", 300000),
    ]
    lists = muni_price_lists(published, "Marathon")
    assert lists == {
        "Marathon|Wausau, City of": [180000, 250000],
        "Marathon|Weston, Village of": [300000],
    }


def test_median_rows_pool_across_months():
    monthly = {
        "2026-05": {"Marathon|Wausau, City of": [100000, 200000]},
        "2026-06": {"Marathon|Wausau, City of": [300000],
                    "Marathon|Bern, Town of": [150000]},
    }
    rows = muni_median_rows(["2026-05", "2026-06"], monthly)
    assert rows == [
        {"county": "Marathon", "municipality": "Bern, Town of",
         "median": 150000, "count": 1},
        {"county": "Marathon", "municipality": "Wausau, City of",
         "median": 200000, "count": 3},
    ]


def test_median_rows_respect_window():
    monthly = {
        "2025-01": {"Marathon|Wausau, City of": [999999]},  # outside window
        "2026-06": {"Marathon|Wausau, City of": [100000, 300000]},
    }
    rows = muni_median_rows(["2026-06"], monthly)
    assert rows == [
        {"county": "Marathon", "municipality": "Wausau, City of",
         "median": 200000, "count": 2},
    ]


def test_municipality_names_with_commas_round_trip():
    published = [_rec("Marathon City, Village of", "Single family", 210000)]
    lists = muni_price_lists(published, "Marathon")
    rows = muni_median_rows(["2026-06"], {"2026-06": lists})
    assert rows[0]["municipality"] == "Marathon City, Village of"
    assert rows[0]["county"] == "Marathon"
