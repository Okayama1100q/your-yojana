from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ngo import NGOBasicResponse
from app.services.ngo_service import NGOServiceLayer
from app.utils.enums import RegistrationStatus

router = APIRouter(prefix="/admin", tags=["Admin Management"])


@router.get(
    "/ngos",
    response_model=List[NGOBasicResponse],
    summary="List all NGOs (Admin)",
    description="Retrieves a list of all registered NGOs with optional status and active filters.",
)
def list_ngos(
    status: Optional[RegistrationStatus] = Query(None, description="Filter by registration status"),
    active: Optional[bool] = Query(None, description="Filter by active flag"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return NGOServiceLayer.list_ngos(db, status=status, active=active, limit=limit, offset=offset)


@router.post(
    "/ngos/{ngo_id}/approve",
    response_model=NGOBasicResponse,
    summary="Approve NGO registration (Admin)",
    description="Approves a pending or suspended NGO, making it eligible for automated matching.",
)
def approve_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.update_ngo_status(db, ngo_id, RegistrationStatus.APPROVED, active=True)


@router.post(
    "/ngos/{ngo_id}/reject",
    response_model=NGOBasicResponse,
    summary="Reject NGO registration (Admin)",
    description="Rejects an NGO registration. The NGO will be ineligible for matching.",
)
def reject_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.update_ngo_status(db, ngo_id, RegistrationStatus.REJECTED)


@router.post(
    "/ngos/{ngo_id}/suspend",
    response_model=NGOBasicResponse,
    summary="Suspend NGO (Admin)",
    description="Suspends an NGO from matching eligibility.",
)
def suspend_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.update_ngo_status(db, ngo_id, RegistrationStatus.SUSPENDED)


@router.post(
    "/ngos/{ngo_id}/reactivate",
    response_model=NGOBasicResponse,
    summary="Reactivate NGO (Admin)",
    description="Reactivates an approved NGO that was previously suspended.",
)
def reactivate_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.update_ngo_status(db, ngo_id, RegistrationStatus.APPROVED, active=True)
