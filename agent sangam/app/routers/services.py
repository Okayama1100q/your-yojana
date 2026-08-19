from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.service_coverage import NGOServiceCreate, NGOServiceResponse
from app.services.ngo_service import NGOServiceLayer

router = APIRouter(prefix="/ngos", tags=["NGO Services"])


@router.get(
    "/{ngo_id}/services",
    response_model=List[NGOServiceResponse],
    summary="Get services offered by an NGO",
    description="Returns all active standardized services offered by the NGO.",
)
def get_ngo_services(ngo_id: int, db: Session = Depends(get_db)):
    return NGOServiceLayer.get_services(db, ngo_id)


@router.post(
    "/{ngo_id}/services",
    response_model=NGOServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add or update a service provided by an NGO",
    description="Adds a standardized requirement under a valid service category with quantity, unit, and estimated duration.",
)
def add_ngo_service(ngo_id: int, data: NGOServiceCreate, db: Session = Depends(get_db)):
    service = NGOServiceLayer.add_service(db, ngo_id, data)
    dur_display = f"{service.estimated_duration_value} {service.estimated_duration_unit.value.lower()}"
    return NGOServiceResponse(
        id=service.id,
        ngo_id=service.ngo_id,
        service_category_code=service.service_category.code,
        service_category_name=service.service_category.name,
        requirement_code=service.requirement.code,
        requirement_name=service.requirement.name,
        available_quantity=service.available_quantity,
        unit=service.unit,
        estimated_duration_value=service.estimated_duration_value,
        estimated_duration_unit=service.estimated_duration_unit,
        estimated_display=dur_display,
        active=service.active,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )
