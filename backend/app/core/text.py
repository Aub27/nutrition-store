"""Text cleaning helpers shared by schemas."""
import re
import unicodedata

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE = re.compile(r"[ \t]+")


def clean_text(value: str, *, multiline: bool = False) -> str:
    value = unicodedata.normalize("NFC", value)
    value = _CONTROL_CHARS.sub("", value)
    if multiline:
        value = value.replace("\r\n", "\n").replace("\r", "\n")
        value = re.sub(r"\n{3,}", "\n\n", value)
        value = "\n".join(_WHITESPACE.sub(" ", line).strip() for line in value.split("\n"))
    else:
        value = " ".join(value.split())
    return value.strip()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s_]+", "-", value).strip("-")


_PHONE_RE = re.compile(r"^(?:\+212|00212|0)([5-7]\d{8})$")


def normalize_ma_phone(value: str) -> str:
    """Normalise a Moroccan phone number to +212XXXXXXXXX or raise ValueError."""
    compact = re.sub(r"[\s.\-()]", "", value)
    match = _PHONE_RE.match(compact)
    if not match:
        raise ValueError("Numéro de téléphone marocain invalide (ex: 06 12 34 56 78).")
    return f"+212{match.group(1)}"


def safe_image_url(value: str | None) -> str | None:
    """Only allow our own uploads or absolute https URLs (blocks javascript:/data: URLs)."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > 500:
        raise ValueError("URL d'image trop longue.")
    if value.startswith("/media/") and ".." not in value:
        return value
    if re.match(r"^https://[^\s<>\"']+$", value):
        return value
    raise ValueError("URL d'image invalide (utilisez un envoi de fichier ou une URL https).")
