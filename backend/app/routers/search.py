"""
Global search endpoint — live typeahead across platform entities.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.search import SearchResponse
from app.services import search_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query("", min_length=0, max_length=120),
    limit: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search countries, reports, predictions, research, and admin entities."""
    is_admin = current_user.role == UserRole.ADMIN
    return await search_service.global_search(
        db,
        user=current_user,
        query=q,
        admin=is_admin,
        limit_per_type=limit,
    )