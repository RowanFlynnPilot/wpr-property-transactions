"""Unit tests for the browser-free CSV field parsers in scraper/parse.py.

These are pure and deterministic — no Playwright, no network — so they run in
CI on every push and guard the typed projection of the DOR CSV.
"""

import pytest

from scraper.parse import _money, _iso_date, _acres, _use


class TestMoney:
    def test_formatted_dollars(self):
        assert _money("$220,000.00") == 220000

    def test_no_cents(self):
        assert _money("$1,500") == 1500

    def test_zero_dollar_string(self):
        assert _money("$0.00") == 0

    def test_empty_is_zero(self):
        assert _money("") == 0
        assert _money("   ") == 0

    def test_rounds_to_whole_dollars(self):
        assert _money("$226,499.50") == 226500


class TestIsoDate:
    def test_mm_dd_yyyy_to_iso(self):
        assert _iso_date("06-01-2026") == "2026-06-01"

    def test_strips_whitespace(self):
        assert _iso_date("  12-31-2025 ") == "2025-12-31"

    def test_unexpected_format_fails_loudly(self):
        with pytest.raises(ValueError):
            _iso_date("2026/06/01")


class TestAcres:
    def test_decimal(self):
        assert _acres("0.85") == 0.85

    def test_empty_is_zero(self):
        assert _acres("") == 0.0

    def test_thousands_separator(self):
        # DOR writes large land parcels with a comma, e.g. a 20,269-acre forest.
        assert _acres("20,269.00") == 20269.0


class TestUse:
    def test_strips_class_suffix(self):
        assert _use("Residential (Class 1)") == "Residential"
        assert _use("Commercial (Class 2)") == "Commercial"
        assert _use("Manufacturing (Class 3)") == "Manufacturing"

    def test_empty_is_unclassified(self):
        assert _use("") == "Unclassified"
        assert _use(None) == "Unclassified"
