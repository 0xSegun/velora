"""
Prediction endpoints — run forecasts, view history, compare countries.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.prediction import (
    PredictionCompareRequest,
    PredictionCompareResponse,
    PredictionHistory,
    PredictionRequest,
    PredictionResponse,
)
from app.services import prediction_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/predictions", tags=["Predictions"])


@router.post("/forecast", response_model=PredictionResponse, status_code=201)
async def run_forecast(
    payload: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run an inflation prediction for a given country and economic inputs."""
    return await prediction_service.run_prediction(db, current_user, payload)


@router.get("/history", response_model=PredictionHistory)
async def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    country_code: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's prediction history."""
    return await prediction_service.get_prediction_history(
        db, current_user, page, per_page, country_code
    )


@router.get("/latest", response_model=list[PredictionResponse])
async def get_latest(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get the latest predictions across all users."""
    return await prediction_service.get_latest_predictions(db, limit)


@router.post("/compare", response_model=PredictionCompareResponse)
async def compare_countries(
    payload: PredictionCompareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare inflation predictions across multiple countries."""
    return await prediction_service.compare_countries(db, current_user, payload)


@router.get("/countries/{country_code}", response_model=PredictionHistory)
async def get_by_country(
    country_code: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get prediction history for a specific country."""
    return await prediction_service.get_prediction_history(
        db, current_user, page, per_page, country_code
    )


@router.get("/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(
    prediction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific prediction by ID for the authenticated user."""
    return await prediction_service.get_prediction_by_id(db, prediction_id, user=current_user)
