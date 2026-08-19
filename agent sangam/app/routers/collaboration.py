from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.collaboration import (
    CollaborationRequestCreate,
    CollaborationAcceptRequest,
    CollaborationRejectRequest,
    CollaborationStatusUpdateRequest,
    CollaborationDetailResponse,
    UserRequestTrackingResponse,
    UserRequestSummaryResponse,
)
from app.services.collaboration_service import CollaborationServiceLayer

router = APIRouter(prefix="", tags=["User Collaboration & NGO Fulfillment"])


@router.post(
    "/collaboration/requests",
    response_model=UserRequestTrackingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit user collaboration request (Main Your Yojana App)",
    description="Submits a structured citizen requirement, triggers deterministic matching across approved NGOs, and creates initial candidate collaboration records.",
)
def create_collaboration_request(
    data: CollaborationRequestCreate, db: Session = Depends(get_db)
):
    return CollaborationServiceLayer.create_user_request(db, data)


@router.get(
    "/collaboration/requests/{request_id}",
    response_model=UserRequestTrackingResponse,
    summary="Get user collaboration request details",
    description="Retrieves the collaboration request along with matched candidate NGOs and current fulfillment status.",
)
def get_collaboration_request(request_id: int, db: Session = Depends(get_db)):
    return CollaborationServiceLayer.get_request_tracking(db, request_id)


@router.get(
    "/collaboration/requests/{request_id}/tracking",
    response_model=UserRequestTrackingResponse,
    summary="Get Amazon-style shipment/fulfillment tracking timeline",
    description="Returns complete tracking timeline, accepted quantities, estimated durations, and chronological status history across fulfilling NGOs.",
)
def get_collaboration_tracking(request_id: int, db: Session = Depends(get_db)):
    return CollaborationServiceLayer.get_request_tracking(db, request_id)


@router.get(
    "/collaboration/users/{external_user_id}/requests",
    response_model=List[UserRequestSummaryResponse],
    summary="Get all requests submitted for an external user",
    description="Returns summary of all collaboration requests submitted under the specified citizen external_user_id.",
)
def get_user_collaboration_requests(
    external_user_id: str, db: Session = Depends(get_db)
):
    return CollaborationServiceLayer.get_user_requests(db, external_user_id)


@router.get(
    "/ngos/{ngo_id}/requests",
    response_model=List[CollaborationDetailResponse],
    summary="Get all collaboration requests for an NGO portal",
    description="Fetches all collaboration opportunities matched to this NGO.",
)
def get_ngo_all_requests(ngo_id: int, db: Session = Depends(get_db)):
    return CollaborationServiceLayer.get_ngo_requests(db, ngo_id, pending_only=False)


@router.get(
    "/ngos/{ngo_id}/requests/pending",
    response_model=List[CollaborationDetailResponse],
    summary="Get pending collaboration requests awaiting NGO action",
    description="Fetches requests in REQUESTED / SENT_TO_NGO status that require accept or reject from the NGO.",
)
def get_ngo_pending_requests(ngo_id: int, db: Session = Depends(get_db)):
    return CollaborationServiceLayer.get_ngo_requests(db, ngo_id, pending_only=True)


@router.post(
    "/collaborations/{collaboration_id}/accept",
    response_model=CollaborationDetailResponse,
    summary="NGO accepts collaboration request (Full or Partial)",
    description="NGO commits to provide a specified quantity and provides estimated delivery/provision duration. Decrements available capacity and updates tracking timeline.",
)
def accept_collaboration(
    collaboration_id: int,
    data: CollaborationAcceptRequest,
    db: Session = Depends(get_db),
):
    return CollaborationServiceLayer.accept_collaboration(db, collaboration_id, data)


@router.post(
    "/collaborations/{collaboration_id}/reject",
    response_model=CollaborationDetailResponse,
    summary="NGO rejects collaboration request",
    description="NGO declines the request with an explanation reason. The remaining quantity stays available for other matching NGOs.",
)
def reject_collaboration(
    collaboration_id: int,
    data: CollaborationRejectRequest,
    db: Session = Depends(get_db),
):
    return CollaborationServiceLayer.reject_collaboration(db, collaboration_id, data)


@router.post(
    "/collaborations/{collaboration_id}/status",
    response_model=CollaborationDetailResponse,
    summary="Advance collaboration fulfillment lifecycle status",
    description="Updates status along the strict state machine (ACCEPTED -> PREPARING -> DISPATCHED -> IN_TRANSIT -> DELIVERED -> RECEIVED -> COMPLETED). Automatically creates a verified Contribution record upon reaching COMPLETED.",
)
def update_collaboration_status(
    collaboration_id: int,
    data: CollaborationStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    return CollaborationServiceLayer.update_collaboration_status(db, collaboration_id, data)
