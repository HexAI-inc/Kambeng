from app.core.security import create_access_token, get_password_hash, verify_password


def test_password_hash_and_verify():
    password = "StrongPass123!"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_create_access_token_returns_string():
    token = create_access_token({"sub": "+2201111111"})
    assert isinstance(token, str)
    assert len(token) > 20
