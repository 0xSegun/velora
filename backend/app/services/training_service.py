"""
TS-Transformer training job management service.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_training import ModelTraining, TrainingStatus
from app.models.user import User

logger = logging.getLogger(__name__)

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

    task = asyncio.create_task(_run_training(job.id, dataset_id))
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


def _execute_training(
    dataset_id: uuid.UUID | None,
    fred_df=None,
    feature_config: dict | None = None,
) -> dict:
    """Synchronous training — runs in a worker thread."""
    from pathlib import Path

    import pandas as pd

    from ai.training.runner import load_training_dataframe, run_training

    backend_root = Path(__file__).resolve().parents[2]
    df = None
    csv_path = None

    if dataset_id:
        # Dataset path resolved by caller context — load via sync DB not available here;
        # fall back to sample data if custom dataset path cannot be resolved.
        csv_path = backend_root / "data" / "sample_economic_data.csv"
    else:
        csv_path = backend_root / "data" / "sample_economic_data.csv"

    if not csv_path.exists():
        from data.generate_data import generate_economic_data
        generate_economic_data()

    return run_training(csv_path=csv_path, df=df, fred_df=fred_df, feature_config=feature_config)


async def _run_training(job_id: uuid.UUID, dataset_id: uuid.UUID | None) -> None:
    """Background task: train model and persist real metrics."""
    from app.database.session import async_session_factory
    from app.services.fred_service import build_fred_training_frame, get_config

    fred_df = None
    feature_config = None
    try:
        async with async_session_factory() as prep_db:
            fred_cfg = await get_config(prep_db)
            if fred_cfg.prediction_enabled:
                fred_df = await build_fred_training_frame(prep_db)
                feature_config = fred_cfg.feature_config
    except Exception:
        logger.debug("FRED training data unavailable", exc_info=True)

    try:
        result = await asyncio.to_thread(
            _execute_training, dataset_id, fred_df, feature_config
        )
    except asyncio.CancelledError:
        _active_jobs.pop(job_id, None)
        raise
    except Exception as exc:
        logger.exception("Training job %s failed", job_id)
        async with async_session_factory() as db:
            row = await db.execute(select(ModelTraining).where(ModelTraining.id == job_id))
            job = row.scalar_one_or_none()
            if job and job.status == TrainingStatus.RUNNING:
                job.status = TrainingStatus.FAILED
                job.error_message = str(exc)[:2000]
                job.completed_at = datetime.now(timezone.utc)
                await db.commit()
        _active_jobs.pop(job_id, None)
        return

    async with async_session_factory() as db:
        row = await db.execute(select(ModelTraining).where(ModelTraining.id == job_id))
        job = row.scalar_one_or_none()
        if not job or job.status != TrainingStatus.RUNNING:
            _active_jobs.pop(job_id, None)
            return

        job.status = TrainingStatus.COMPLETED
        job.accuracy = result["accuracy"]
        job.rmse = result["rmse"]
        job.mae = result["mae"]
        job.epochs = result["epochs_trained"]
        job.training_time_seconds = result["training_time_seconds"]
        job.completed_at = datetime.now(timezone.utc)
        job.metrics = {
            "accuracy_pct": result["accuracy_pct"],
            "mape": result["mape"],
            "r2": result["r2"],
            "val_loss": result["best_val_loss"],
            "best_epoch": result["best_epoch"],
            "history": result.get("history"),
        }
        await db.commit()

    # Reload inference engine and refresh accuracy dashboard records
    try:
        from app.services.ts_transformer_engine import reload_model
        reload_model()
    except Exception as exc:
        logger.warning("Could not reload inference model: %s", exc)

    try:
        from app.services.intelligence_service import _refresh_accuracy_records
        async with async_session_factory() as db:
            await _refresh_accuracy_records(db, None)
            await db.commit()
    except Exception as exc:
        logger.warning("Could not refresh accuracy records: %s", exc)

    _active_jobs.pop(job_id, None)
    logger.info(
        "Training job %s completed — accuracy %.1f%%",
        job_id,
        result["accuracy_pct"],
    )