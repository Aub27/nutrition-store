import pytest

from app.core.security import hash_password, validate_password_strength, verify_password
from app.core.text import clean_text, normalize_ma_phone, safe_image_url, slugify


@pytest.mark.parametrize("raw", ["0612345678", "06 12 34 56 78", "+212612345678", "00212612345678", "07.12.34.56.78", "0522123456"])
def test_valid_moroccan_phones(raw):
    assert normalize_ma_phone(raw).startswith("+212")


@pytest.mark.parametrize("raw", ["", "12345", "+33612345678", "0412345678", "06123456789", "abc"])
def test_invalid_phones(raw):
    with pytest.raises(ValueError):
        normalize_ma_phone(raw)


def test_clean_text_strips_control_characters():
    assert clean_text("  Hello\x00   world\x07 ") == "Hello world"
    assert clean_text("a\r\n\r\n\r\n\r\nb", multiline=True) == "a\n\nb"


def test_slugify():
    assert slugify("Créatine Monohydrate 300 g!") == "creatine-monohydrate-300-g"


@pytest.mark.parametrize("url", ["javascript:alert(1)", "data:text/html,x", "http://plain.example/a.png", "//evil.example/a.png", "/media/../etc/passwd"])
def test_unsafe_image_urls(url):
    with pytest.raises(ValueError):
        safe_image_url(url)


def test_safe_image_urls():
    assert safe_image_url("/media/a.webp") == "/media/a.webp"
    assert safe_image_url("https://cdn.example/a.png") == "https://cdn.example/a.png"
    assert safe_image_url("  ") is None


def test_password_policy_and_hashing():
    assert validate_password_strength("short") is not None
    assert validate_password_strength("alllowercaseletters") is not None
    assert validate_password_strength("Str0ng!Passw0rd#") is None
    hashed = hash_password("Str0ng!Passw0rd#")
    assert hashed != "Str0ng!Passw0rd#"
    assert verify_password("Str0ng!Passw0rd#", hashed)
    assert not verify_password("wrong", hashed)
    assert not verify_password("x" * 100, hashed)  # >72 bytes never raises
    assert not verify_password("anything", None)  # unknown user path
