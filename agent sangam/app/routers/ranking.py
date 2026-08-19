from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ranking import NGORankingResponse, LeaderboardResponse
from app.services.ranking_service import RankingService

router = APIRouter(prefix="/ngos", tags=["NGO Performance & Ranking"])


@router.get(
    "/ranking",
    response_model=LeaderboardResponse,
    summary="Get dynamic NGO ranking leaderboard",
    description="Returns the live overall leaderboard of approved NGOs ranked dynamically by completed contributions, beneficiaries helped, quantity provided, and on-time performance.",
)
def get_overall_leaderboard(db: Session = Depends(get_db)):
    return RankingService.get_leaderboard(db)


@router.get(
    "/{ngo_id}/ranking",
    response_model=NGORankingResponse,
    summary="Get individual NGO rank and score metrics",
    description="Calculates and returns the live rank, score breakdown, and metric values for a specific NGO.",
)
def get_individual_ngo_ranking(ngo_id: int, db: Session = Depends(get_db)):
    return RankingService.get_ngo_ranking(db, ngo_id)
