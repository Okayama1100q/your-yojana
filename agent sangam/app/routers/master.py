from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.master import ServiceCategoryResponse, RequirementResponse
from app.services.master_service import MasterDataService

router = APIRouter(prefix="", tags=["Master Data"])


@router.get(
    "/service-categories",
    response_model=List[ServiceCategoryResponse],
    summary="Get all standardized service categories",
    description="Returns the source-of-truth list of master service categories for populating dropdowns.",
)
def get_service_categories(db: Session = Depends(get_db)):
    return MasterDataService.get_all_categories(db, active_only=True)


@router.get(
    "/service-categories/{category_code}/requirements",
    response_model=List[RequirementResponse],
    summary="Get standardized requirements for a category",
    description="Returns the source-of-truth list of requirements belonging to the given service category code.",
)
def get_category_requirements(category_code: str, db: Session = Depends(get_db)):
    return MasterDataService.get_requirements_by_category_code(db, category_code, active_only=True)
