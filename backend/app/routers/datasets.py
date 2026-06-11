"""
Dataset upload and management endpoints.
"""

import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import dataset_service
from app.utils.security import require_admin

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


@router.post("/upload", dependencies=[Depends(require_admin)])
async def upload_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dataset = await dataset_service.upload_dataset(db, current_user, file)
    return {
        "id": str(dataset.id),
        "filename": dataset.original_filename,
        "upload_date": dataset.upload_date.isoformat(),
        "dataset_version": dataset.dataset_version,
        "row_count": dataset.row_count,
        "file_size_bytes": dataset.file_size_bytes,
    }


@router.get("")
async def list_datasets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    data = await dataset_service.list_datasets(db, page=page, per_page=per_page)
    return {
        **data,
        "datasets": [
            {
                "id": str(d.id),
                "filename": d.original_filename,
                "upload_date": d.upload_date.isoformat(),
                "uploaded_by": str(d.uploaded_by) if d.uploaded_by else None,
                "dataset_version": d.dataset_version,
                "row_count": d.row_count,
                "file_type": d.file_type,
            }
            for d in data["datasets"]
        ],
    }


@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    dataset = await dataset_service.get_dataset(db, dataset_id)
    return {
        "id": str(dataset.id),
        "filename": dataset.original_filename,
        "stored_filename": dataset.filename,
        "file_path": dataset.file_path,
        "upload_date": dataset.upload_date.isoformat(),
        "uploaded_by": str(dataset.uploaded_by) if dataset.uploaded_by else None,
        "dataset_version": dataset.dataset_version,
        "row_count": dataset.row_count,
        "file_type": dataset.file_type,
        "file_size_bytes": dataset.file_size_bytes,
    }


@router.delete("/{dataset_id}", dependencies=[Depends(require_admin)])
async def delete_dataset(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    await dataset_service.delete_dataset(db, dataset_id)
    return {"message": "Dataset deleted"}