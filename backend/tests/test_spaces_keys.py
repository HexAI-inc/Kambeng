"""Signed links for private files must point at the right object, whichever
Spaces address the file's URL was stored under."""

from app.services.do_spaces_strategy import DOSpacesStrategy


def _strategy() -> DOSpacesStrategy:
    # Skip __init__: no client or network needed to resolve keys.
    s = DOSpacesStrategy.__new__(DOSpacesStrategy)
    s.bucket = "hexaistorage"
    s.public_endpoint = "https://hexaistorage.lon1.cdn.digitaloceanspaces.com"
    return s


def test_key_from_every_stored_url_form():
    s = _strategy()
    key = "kambeng/kyc/12/national_id_ab12.jpg"
    for location in (
        f"https://hexaistorage.lon1.cdn.digitaloceanspaces.com/{key}",
        f"https://hexaistorage.lon1.digitaloceanspaces.com/{key}",
        f"https://lon1.digitaloceanspaces.com/hexaistorage/{key}",
        key,
        f"/{key}",
    ):
        assert s._key_from_location(location) == key, location


def test_key_is_url_decoded():
    s = _strategy()
    assert s._key_from_location("https://hexaistorage.lon1.digitaloceanspaces.com/kambeng/kyc/1/my%20id.pdf") == "kambeng/kyc/1/my id.pdf"
