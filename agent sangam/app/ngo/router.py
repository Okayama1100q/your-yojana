from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import EntityNotFoundException
from app.core.ranking_service import DynamicRankingService
from app.ngo.schemas import (
    NGORegistrationRequest,
    NGORegistrationResponse,
    NGOProfileResponse,
    NGOServiceCreate,
    NGOServiceResponse,
    NGOCoverageCreate,
    NGOCoverageResponse,
    NGORankResponse,
    CollaborationAcceptRequest,
    CollaborationRejectRequest,
    CollaborationStatusUpdateRequest,
    CollaborationDetailResponse,
    NGOContributionSummaryResponse,
)
from app.ngo.service import NGOServiceManager, NGOCollaborationService

ngo_router = APIRouter(tags=["NGO Portal & Operations"])


# =========================================================================
# NGO REGISTRATION (Belongs strictly to NGO area!)
# =========================================================================

@ngo_router.post(
    "/ngos/register",
    response_model=NGORegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new NGO (Creates in PENDING status)",
    description="Registers an NGO organization in PENDING registration status. Admin approval is required before matching eligibility.",
)
def register_ngo(ngo_data: NGORegistrationRequest, db: Session = Depends(get_db)):
    return NGOServiceManager.register_ngo(db, ngo_data)


# =========================================================================
# NGO PROFILE & METRICS
# =========================================================================

@ngo_router.get(
    "/ngos/{ngo_id}",
    response_model=NGOProfileResponse,
    summary="Get comprehensive NGO profile including services, coverage and dynamic rank",
)
def get_ngo_profile(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceManager.get_ngo_profile(db, ngo_id)


@ngo_router.get(
    "/ngos/{ngo_id}/services",
    response_model=List[NGOServiceResponse],
    summary="List registered active services for an NGO",
)
def get_ngo_services(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceManager.get_ngo_services(db, ngo_id)


@ngo_router.post(
    "/ngos/{ngo_id}/services",
    response_model=NGOServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register or update a service capacity for an NGO",
)
def add_ngo_service(ngo_id: int, service_data: NGOServiceCreate, db: Session = Depends(get_db)):
    return NGOServiceManager.add_ngo_service(db, ngo_id, service_data)


@ngo_router.get(
    "/ngos/{ngo_id}/coverage",
    response_model=List[NGOCoverageResponse],
    summary="List geographic coverage areas for an NGO",
)
def get_ngo_coverage(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceManager.get_ngo_coverage(db, ngo_id)


@ngo_router.post(
    "/ngos/{ngo_id}/coverage",
    response_model=NGOCoverageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a geographic coverage area for an NGO",
)
def add_ngo_coverage(ngo_id: int, cov_data: NGOCoverageCreate, db: Session = Depends(get_db)):
    return NGOServiceManager.add_ngo_coverage(db, ngo_id, cov_data)


# =========================================================================
# COLLABORATION MANAGEMENT (NGO Side)
# =========================================================================

@ngo_router.get(
    "/ngos/{ngo_id}/requests",
    response_model=List[CollaborationDetailResponse],
    summary="List all collaboration requests matched with this NGO",
)
def get_ngo_collaboration_requests(ngo_id: int, db: Session = Depends(get_db)):
    return NGOCollaborationService.get_ngo_collaborations(db, ngo_id, pending_only=False)


@ngo_router.get(
    "/ngos/{ngo_id}/requests/pending",
    response_model=List[CollaborationDetailResponse],
    summary="List pending collaboration requests awaiting NGO action",
)
def get_ngo_pending_requests(ngo_id: int, db: Session = Depends(get_db)):
    return NGOCollaborationService.get_ngo_collaborations(db, ngo_id, pending_only=True)


@ngo_router.post(
    "/collaborations/{id}/accept",
    response_model=CollaborationDetailResponse,
    summary="NGO accepts a collaboration request (full or partial quantity)",
)
def accept_collaboration(
    id: int,
    accept_data: CollaborationAcceptRequest,
    db: Session = Depends(get_db),
):
    return NGOCollaborationService.accept_collaboration(db, id, accept_data)


@ngo_router.post(
    "/collaborations/{id}/reject",
    response_model=CollaborationDetailResponse,
    summary="NGO rejects a collaboration request with an explanation reason",
)
def reject_collaboration(
    id: int,
    reject_data: CollaborationRejectRequest,
    db: Session = Depends(get_db),
):
    return NGOCollaborationService.reject_collaboration(db, id, reject_data)


@ngo_router.post(
    "/collaborations/{id}/status",
    response_model=CollaborationDetailResponse,
    summary="Advance collaboration fulfillment status through lifecycle",
)
def update_collaboration_status(
    id: int,
    status_data: CollaborationStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    return NGOCollaborationService.update_collaboration_status(db, id, status_data)


# =========================================================================
# CONTRIBUTIONS & INDIVIDUAL RANKING
# =========================================================================

@ngo_router.get(
    "/ngos/{ngo_id}/contributions",
    response_model=NGOContributionSummaryResponse,
    summary="Get verified completed contributions summary for an NGO",
)
def get_ngo_contributions(ngo_id: int, db: Session = Depends(get_db)):
    return NGOCollaborationService.get_ngo_contributions(db, ngo_id)


@ngo_router.get(
    "/ngos/{ngo_id}/ranking",
    response_model=NGORankResponse,
    summary="Get individual NGO rank and ranking metrics",
)
def get_individual_ngo_ranking(ngo_id: int, db: Session = Depends(get_db)):
    data = DynamicRankingService.get_ngo_ranking_metrics(db, ngo_id)
    if not data:
        raise EntityNotFoundException(f"NGO #{ngo_id} not found")
    return NGORankResponse(**data)
