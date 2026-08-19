from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ngo import (
    NGORegistrationRequest,
    NGOBasicResponse,
    NGOProfileResponse,
    NGOStatsSummary,
)
from app.services.ngo_service import NGOServiceLayer
from app.services.contribution_service import ContributionService
from app.services.ranking_service import RankingService

router = APIRouter(prefix="/ngos", tags=["NGO Profile & Registration"])


@router.post(
    "/register",
    response_model=NGOBasicResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new NGO",
    description="Registers an NGO in PENDING status. Admin approval is required before matching eligibility.",
)
def register_ngo(data: NGORegistrationRequest, db: Session = Depends(get_db)):
    return NGOServiceLayer.register_ngo(db, data)


@router.get(
    "/{ngo_id}",
    response_model=NGOProfileResponse,
    summary="Get comprehensive NGO profile",
    description="Fetches NGO basic details, registered services, coverage areas, contribution statistics, and current dynamic ranking.",
)
def get_ngo_profile(ngo_id: int, db: Session = Depends(get_db)):
    ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)
    services = NGOServiceLayer.get_services(db, ngo_id)
    coverage = NGOServiceLayer.get_coverage(db, ngo_id)

    # Get contribution summary
    contrib_summary = ContributionService.get_ngo_contributions_summary(db, ngo_id)

    # Get dynamic ranking
    ranking = RankingService.get_ngo_ranking(db, ngo_id)

    stats = NGOStatsSummary(
        completed_requests=contrib_summary.completed_requests,
        beneficiaries_helped=contrib_summary.beneficiaries_helped,
        total_quantity_provided=contrib_summary.total_quantity_provided,
        on_time_completion_rate=contrib_summary.on_time_completion_rate,
        ranking_score=ranking.ranking_score,
        current_rank=ranking.current_rank,
    )

    return NGOProfileResponse(
        basic_details=ngo,
        services=services,
        coverage=coverage,
        performance=stats,
    )
