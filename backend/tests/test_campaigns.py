import pytest

from app.api.routes.campaigns import generate_slug


def test_generate_slug_basic():
    assert generate_slug("Save The Turtles!") == "save-the-turtles"


def test_generate_slug_strips_symbols_and_spaces():
    assert generate_slug("  Help @ School #1  ") == "help-school-1"


@pytest.mark.parametrize(
    "title,expected",
    [
        ("A", "a"),
        ("Clean Water for Brikama", "clean-water-for-brikama"),
    ],
)
def test_generate_slug_parametrized(title, expected):
    assert generate_slug(title) == expected
