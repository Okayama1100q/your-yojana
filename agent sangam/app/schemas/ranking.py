from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class NGORankingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ngo_id: int
    ngo_code: str
    ngo_name: str
    current_rank: int
    ranking_score: float
    completed_requests: int
    beneficiaries_helped: int
    total_quantity_provided: int
    on_time_completion_rate: float


class LeaderboardResponse(BaseModel):
    total_ngos: int
    leaderboard: List[NGORankingResponse]
