from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.contribution import NGOContributionSummaryResponse
from app.services.contribution_service import ContributionService

router = APIRouter(prefix="/ngos", tags=["NGO Contributions"])


@router.get(
    "/{ngo_id}/contributions",
    response_model=NGOContributionSummaryResponse,
    summary="Get verified completed contributions of an NGO",
    description="Returns aggregate statistics and detailed list of all completed, verified assistance contributions provided by this NGO.",
)
def get_ngo_contributions(ngo_id: int, db: Session = Depends(get_db)):
    return ContributionService.get_ngo_contributions_summary(db, ngo_id)
