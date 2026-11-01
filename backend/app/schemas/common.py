"""Reusable validated string types."""
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, StringConstraints

from app.core.text import clean_text, normalize_ma_phone, safe_image_url

T = TypeVar("T")


def _short(v: str) -> str:
    return clean_text(v)


def _long(v: str) -> str:
    return clean_text(v, multiline=True)


ShortText = Annotated[str, StringConstraints(max_length=255), AfterValidator(_short)]
LongText = Annotated[str, StringConstraints(max_length=5000), AfterValidator(_long)]
Phone = Annotated[str, StringConstraints(max_length=30), AfterValidator(normalize_ma_phone)]
ImageUrl = Annotated[str, AfterValidator(safe_image_url)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
