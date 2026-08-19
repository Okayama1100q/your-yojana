from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.user.schemas import (
    ServiceCategoryResponse,
    RequirementResponse,
    UserCollaborationRequestCreate,
    UserRequestTrackingResponse,
    UserRequestSummaryResponse,
)
from app.user.service import UserCollaborationService

user_router = APIRouter(tags=["User / Citizen Collaboration"])


@user_router.get(
    "/service-categories",
    response_model=List[ServiceCategoryResponse],
    summary="List all standardized master service categories",
    description="Returns all 18 standardized master service categories to populate frontend dropdowns.",
)
def get_service_categories(db: Session = Depends(get_db)):
    return UserCollaborationService.get_service_categories(db)


@user_router.get(
    "/service-categories/{category_code}/requirements",
    response_model=List[RequirementResponse],
    summary="List standardized requirements for a service category",
    description="Returns the 6 standardized requirements associated with the given master category code.",
)
def get_category_requirements(category_code: str, db: Session = Depends(get_db)):
    return UserCollaborationService.get_category_requirements(db, category_code)


@user_router.post(
    "/collaboration/requests",
    response_model=UserRequestTrackingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a citizen collaboration request and run deterministic matching",
    description="Submits a requirement from a citizen, runs deterministic rule-based matching, creates candidate records, and returns full tracking details.",
)
def create_collaboration_request(
    request_data: UserCollaborationRequestCreate,
    db: Session = Depends(get_db),
):
    return UserCollaborationService.create_user_request_and_match(db, request_data)


@user_router.get(
    "/collaboration/requests/{request_id}",
    response_model=UserRequestTrackingResponse,
    summary="Get collaboration request details and matched candidate NGOs",
)
def get_collaboration_request(request_id: int, db: Session = Depends(get_db)):
    return UserCollaborationService.get_request_tracking(db, request_id)


@user_router.get(
    "/collaboration/requests/{request_id}/tracking",
    response_model=UserRequestTrackingResponse,
    summary="Track fulfillment progress and status timeline for a collaboration request",
)
def get_collaboration_request_tracking(request_id: int, db: Session = Depends(get_db)):
    return UserCollaborationService.get_request_tracking(db, request_id)


@user_router.get(
    "/collaboration/users/{external_user_id}/requests",
    response_model=List[UserRequestSummaryResponse],
    summary="List all collaboration requests submitted by an external citizen user ID",
)
def get_user_collaboration_requests(external_user_id: str, db: Session = Depends(get_db)):
    return UserCollaborationService.get_requests_by_user(db, external_user_id)
