from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.enums import RegistrationStatus
from app.admin.schemas import (
    AdminNGOListItemResponse,
    LeaderboardResponse,
)
from app.admin.service import AdminNGOService

admin_router = APIRouter(tags=["Admin Management & Leaderboard"])


# =========================================================================
# GLOBAL LEADERBOARD (Static path registered safely)
# =========================================================================

@admin_router.get(
    "/ngos/ranking",
    response_model=LeaderboardResponse,
    summary="Get dynamic overall NGO leaderboard ranked by performance metrics",
    description="Returns the live overall leaderboard across all approved NGOs calculated on-demand from verified contribution records.",
)
def get_ngo_ranking_leaderboard(db: Session = Depends(get_db)):
    return AdminNGOService.get_leaderboard(db)


# =========================================================================
# ADMIN NGO MANAGEMENT (Approve, Reject, Suspend, Reactivate)
# =========================================================================

@admin_router.get(
    "/admin/ngos",
    response_model=List[AdminNGOListItemResponse],
    summary="List all registered NGOs with optional status and active filtering",
)
def list_admin_ngos(
    status: Optional[RegistrationStatus] = Query(None, description="Filter by registration status"),
    active: Optional[bool] = Query(None, description="Filter by active flag"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return AdminNGOService.list_ngos(db, status=status, active=active, limit=limit, offset=offset)


@admin_router.post(
    "/admin/ngos/{ngo_id}/approve",
    response_model=AdminNGOListItemResponse,
    summary="Approve a pending NGO registration",
)
def approve_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return AdminNGOService.approve_ngo(db, ngo_id)


@admin_router.post(
    "/admin/ngos/{ngo_id}/reject",
    response_model=AdminNGOListItemResponse,
    summary="Reject an NGO registration",
)
def reject_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return AdminNGOService.reject_ngo(db, ngo_id)


@admin_router.post(
    "/admin/ngos/{ngo_id}/suspend",
    response_model=AdminNGOListItemResponse,
    summary="Suspend an active NGO",
)
def suspend_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return AdminNGOService.suspend_ngo(db, ngo_id)


@admin_router.post(
    "/admin/ngos/{ngo_id}/reactivate",
    response_model=AdminNGOListItemResponse,
    summary="Reactivate a suspended NGO",
)
def reactivate_ngo(ngo_id: int, db: Session = Depends(get_db)):
    return AdminNGOService.reactivate_ngo(db, ngo_id)
