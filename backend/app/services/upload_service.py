"""Safe image uploads: decode with Pillow, strip metadata, re-encode, random file name."""
import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import settings

Image.MAX_IMAGE_PIXELS = 25_000_000  # decompression-bomb guard
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_SIDE = 1600
_CHUNK = 64 * 1024


def upload_root() -> Path:
    root = Path(settings.upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


async def save_image(file: UploadFile) -> str:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    buffer = io.BytesIO()
    while chunk := await file.read(_CHUNK):
        buffer.write(chunk)
        if buffer.tell() > max_bytes:
            raise HTTPException(status_code=413, detail=f"Image trop lourde (max {settings.max_upload_mb} Mo).")
    if buffer.tell() == 0:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    buffer.seek(0)

    try:
        with Image.open(buffer) as probe:
            fmt = probe.format
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise HTTPException(status_code=415, detail="Format non supporté (JPEG, PNG ou WebP).")
        buffer.seek(0)
        with Image.open(buffer) as img:
            img.load()
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            has_alpha = img.mode in ("RGBA", "LA", "P")
            converted = img.convert("RGBA" if has_alpha else "RGB")
            out = io.BytesIO()
            converted.save(out, format="WEBP", quality=85, method=4)  # drops EXIF/GPS metadata
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
        raise HTTPException(status_code=400, detail="Fichier image invalide.")

    name = f"{uuid.uuid4().hex}.webp"
    (upload_root() / name).write_bytes(out.getvalue())
    return f"/media/{name}"
