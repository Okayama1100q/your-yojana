from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.core.enums import RegistrationStatus


class AdminNGOListItemResponse(BaseModel):
    id: int
    ngo_code: str
    ngo_name: str
    registration_number: str
    contact_person: str
    phone: str
    state: str
    district: str
    registration_status: RegistrationStatus
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LeaderboardEntryResponse(BaseModel):
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
    leaderboard: List[LeaderboardEntryResponse]
