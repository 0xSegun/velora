"""
TS-Transformer training endpoints.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import training_service
from app.utils.security import require_admin

router = APIRouter(prefix="/api/training", tags=["Training"])


class TrainingStartRequest(BaseModel):
    dataset_id: uuid.UUID | None = None


def _serialize_job(job) -> dict:
    return {
        "id": str(job.id),
        "dataset_id": str(job.dataset_id) if job.dataset_id else None,
        "training_date": job.training_date.isoformat(),
        "accuracy": job.accuracy,
        "rmse": job.rmse,
        "mae": job.mae,
        "epochs": job.epochs,
        "training_time_seconds": job.training_time_seconds,
        "status": job.status.value,
        "model_version": job.model_version,
        "metrics": job.metrics,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@router.post("/start", dependencies=[Depends(require_admin)])
async def start_training(
    payload: TrainingStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    job = await training_service.start_training(db, current_user, payload.dataset_id)
    return _serialize_job(job)


@router.post("/stop", dependencies=[Depends(require_admin)])
async def stop_training(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    job = await training_service.stop_training(db, job_id)
    return _serialize_job(job)


@router.get("/status")
async def training_status(
    job_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if job_id:
        job = await training_service.get_training_status(db, job_id)
        return _serialize_job(job)
    job = await training_service.get_latest_running(db)
    if not job:
        return {"status": "idle", "message": "No active training job"}
    return _serialize_job(job)


@router.get("/history")
async def training_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    data = await training_service.get_training_history(db, page=page, per_page=per_page)
    return {
        **data,
        "runs": [_serialize_job(j) for j in data["runs"]],
    }