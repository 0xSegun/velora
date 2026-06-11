"""
User management endpoints — profile and admin user management.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import AdminUserUpdate, UserListResponse, UserResponse, UserUpdate
from app.services import email_service
from app.services.country_service import serialize_country
from app.utils.security import get_current_user, require_admin


def _user_response(user: User) -> UserResponse:
    meta = serialize_country(user.country)
    base = UserResponse.model_validate(user)
    return base.model_copy(
        update={
            "country_name": meta["name"],
            "country_flag": meta["flag"],
            "auth_provider": user.auth_provider,
        }
    )

router = APIRouter(prefix="/api/users", tags=["Users"])


# ── Profile ───────────────────────────────────────────────────────────────────


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return _user_response(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's profile."""
    update_data = payload.model_dump(exclude_unset=True)
    if "full_name" in update_data and update_data["full_name"]:
        parts = update_data["full_name"].strip().split(maxsplit=1)
        current_user.first_name = parts[0]
        current_user.last_name = parts[1] if len(parts) > 1 else ""
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)

    try:
        await email_service.send_profile_updated_email(
            to=current_user.email,
            name=current_user.full_name or current_user.first_name or current_user.email,
        )
    except Exception:
        pass

    return _user_response(current_user)


# ── Admin: user management ────────────────────────────────────────────────────


@router.get("/", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all users with pagination and optional filters (admin only)."""
    query = select(User)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (User.email.ilike(pattern)) | (User.full_name.ilike(pattern))
        )
    if role:
        try:
            query = query.where(User.role == UserRole(role))
        except ValueError:
            pass

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    )
    users = [_user_response(u) for u in result.scalars().all()]

    return UserListResponse(users=users, total=total, page=page, per_page=per_page)


@router.put("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update any user's profile or role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    previous_role = user.role

    # Convert role string to enum if present
    if "role" in update_data and update_data["role"] is not None:
        try:
            update_data["role"] = UserRole(update_data["role"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {update_data['role']}",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    if "role" in update_data and user.role != previous_role:
        try:
            await email_service.send_role_changed_email(
                to=user.email,
                name=user.full_name or user.first_name or user.email,
                role=user.role.value,
            )
        except Exception:
            pass

    return _user_response(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Soft-delete a user by deactivating their account (admin only)."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    await db.flush()

    try:
        await email_service.send_account_deactivated_email(
            to=user.email,
            name=user.full_name or user.first_name or user.email,
        )
    except Exception:
        pass
