"""
TS-Transformer training job management service.
"""

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_training import ModelTraining, TrainingStatus
from app.models.user import User

_active_jobs: dict[uuid.UUID, asyncio.Task] = {}


async def start_training(
    db: AsyncSession,
    user: User,
    dataset_id: uuid.UUID | None = None,
) -> ModelTraining:
    if dataset_id:
        try:
            from app.services.intelligence_service import inspect_dataset
            report = await inspect_dataset(db, dataset_id)
            if report["quality_score"] < 70:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset quality too low ({report['quality_score']}%). Fix issues before training.",
                )
        except HTTPException:
            raise
        except Exception:
            pass
    running = await db.execute(
        select(ModelTraining).where(ModelTraining.status == TrainingStatus.RUNNING).limit(1)
    )
    if running.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A training job is already running")

    job = ModelTraining(
        dataset_id=dataset_id,
        status=TrainingStatus.RUNNING,
        started_by=user.id,
        model_version="ts-transformer-1.0",
        epochs=0,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    task = asyncio.create_task(_simulate_training(job.id))
    _active_jobs[job.id] = task
    return job


async def stop_training(db: AsyncSession, job_id: uuid.UUID) -> ModelTraining:
    result = await db.execute(select(ModelTraining).where(ModelTraining.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    if job.status != TrainingStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Training is not running")

    task = _active_jobs.pop(job_id, None)
    if task and not task.done():
        task.cancel()

    job.status = TrainingStatus.STOPPED
    job.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return job


async def get_training_status(db: AsyncSession, job_id: uuid.UUID) -> ModelTraining:
    result = await db.execute(select(ModelTraining).where(ModelTraining.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return job


async def get_training_history(db: AsyncSession, page: int = 1, per_page: int = 20) -> dict:
    offset = (page - 1) * per_page
    total_result = await db.execute(select(func.count()).select_from(ModelTraining))
    total = total_result.scalar() or 0
    result = await db.execute(
        select(ModelTraining)
        .order_by(ModelTraining.training_date.desc())
        .offset(offset)
        .limit(per_page)
    )
    return {
        "runs": result.scalars().all(),
        "total": total,
        "page": page,
        "per_page": per_page,
    }


async def get_latest_running(db: AsyncSession) -> ModelTraining | None:
    result = await db.execute(
        select(ModelTraining)
        .where(ModelTraining.status == TrainingStatus.RUNNING)
        .order_by(ModelTraining.training_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _simulate_training(job_id: uuid.UUID) -> None:
    """Background placeholder until full TS-Transformer pipeline is wired."""
    from app.database.session import async_session_factory

    await asyncio.sleep(3)
    async with async_session_factory() as db:
        result = await db.execute(select(ModelTraining).where(ModelTraining.id == job_id))
        job = result.scalar_one_or_none()
        if not job or job.status != TrainingStatus.RUNNING:
            return
        job.status = TrainingStatus.COMPLETED
        job.accuracy = 0.94
        job.rmse = 0.42
        job.mae = 0.31
        job.epochs = 50
        job.training_time_seconds = 3.0
        job.completed_at = datetime.now(timezone.utc)
        job.metrics = {"val_loss": 0.18, "train_loss": 0.15}
        await db.commit()
    _active_jobs.pop(job_id, None)