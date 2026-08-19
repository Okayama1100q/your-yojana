from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.service_coverage import NGOCoverageCreate, NGOCoverageResponse
from app.services.ngo_service import NGOServiceLayer

router = APIRouter(prefix="/ngos", tags=["NGO Coverage"])


@router.get(
    "/{ngo_id}/coverage",
    response_model=List[NGOCoverageResponse],
    summary="Get geographic coverage areas of an NGO",
    description="Returns all active state, district, and area coverage records configured for this NGO.",
)
def get_ngo_coverage(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.get_coverage(db, ngo_id)


@router.post(
    "/{ngo_id}/coverage",
    response_model=NGOCoverageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add geographic coverage area for an NGO",
    description="Configures service coverage in a specific state, district, and optional micro-locality area.",
)
def add_ngo_coverage(ngo_id: int, data: NGOCoverageCreate, db: Session = Depends(get_db)):
    return NGOServiceLayer.add_coverage(db, ngo_id, data)
