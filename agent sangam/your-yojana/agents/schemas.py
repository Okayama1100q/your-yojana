from pydantic import BaseModel, ConfigDict


class ComplaintAnalysis(BaseModel):

    model_config = ConfigDict(extra="forbid")

    category: str
    issue: str

    health_risk: bool
    safety_risk: bool
    essential_service: bool
    vulnerable_population: bool

    duration_days: int

    affected_count: int
    affected_unit: str

    location: str


class PriorityResult(BaseModel):

    model_config = ConfigDict(extra="forbid")

    score: int
    level: str
    reasons: list[dict]
    recommended_response_hours: int