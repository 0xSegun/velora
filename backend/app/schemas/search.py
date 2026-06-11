"""Global search schemas."""

from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    id: str
    type: str
    title: str
    subtitle: str | None = None
    href: str
    meta: str | None = None


class SearchGroup(BaseModel):
    type: str
    label: str
    results: list[SearchResultItem] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    groups: list[SearchGroup] = Field(default_factory=list)
    total: int = 0