from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict


class ContributionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ngo_id: int
    collaboration_id: int
    requirement_code: str
    requirement_name: str
    quantity_provided: int
    unit: str
    beneficiaries_helped: int
    completed_on_time: bool
    completed_at: datetime
    created_at: datetime


class NGOContributionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ngo_id: int
    ngo_code: str
    ngo_name: str
    completed_requests: int
    beneficiaries_helped: int
    total_quantity_provided: int
    on_time_completion_rate: float
    contributions: List[ContributionItemResponse] = []
