"""
Dataset upload and management service.
"""

import uuid
from pathlib import Path

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.dataset import Dataset
from app.models.user import User

settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


def _upload_dir() -> Path:
    path = BACKEND_ROOT / settings.UPLOAD_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


async def upload_dataset(
    db: AsyncSession,
    user: User,
    file: UploadFile,
) -> Dataset:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    stored_name = f"{uuid.uuid4()}{suffix}"
    dest = _upload_dir() / stored_name
    dest.write_bytes(content)

    row_count = None
    try:
        if suffix == ".csv":
            row_count = len(pd.read_csv(dest))
        elif suffix in {".xlsx", ".xls"}:
            row_count = len(pd.read_excel(dest))
        elif suffix == ".json":
            row_count = len(pd.read_json(dest))
    except Exception:
        row_count = None

    dataset = Dataset(
        filename=stored_name,
        original_filename=file.filename,
        file_path=str(dest.relative_to(BACKEND_ROOT)),
        file_type=suffix.lstrip("."),
        file_size_bytes=len(content),
        uploaded_by=user.id,
        row_count=row_count,
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)
    return dataset


async def list_datasets(db: AsyncSession, page: int = 1, per_page: int = 20) -> dict:
    offset = (page - 1) * per_page
    total_result = await db.execute(select(func.count()).select_from(Dataset))
    total = total_result.scalar() or 0
    result = await db.execute(
        select(Dataset).order_by(Dataset.upload_date.desc()).offset(offset).limit(per_page)
    )
    items = result.scalars().all()
    return {"datasets": items, "total": total, "page": page, "per_page": per_page}


async def get_dataset(db: AsyncSession, dataset_id: uuid.UUID) -> Dataset:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


async def delete_dataset(db: AsyncSession, dataset_id: uuid.UUID) -> None:
    dataset = await get_dataset(db, dataset_id)
    file_path = BACKEND_ROOT / dataset.file_path
    if file_path.exists():
        file_path.unlink()
    await db.delete(dataset)