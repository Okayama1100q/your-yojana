from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.enums import RequestOverallStatus, CollaborationStatus, EstimatedDurationUnit


# Master data schemas
class ServiceCategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequirementResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    service_category_id: int
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# User Collaboration Request Schemas
class UserCollaborationRequestCreate(BaseModel):
    external_user_id: str = Field(..., description="External citizen ID from Your Yojana application")
    service_category: str = Field(..., description="Service category code, e.g., 'FISHERIES', 'EDUCATION'")
    requirement: str = Field(..., description="Requirement code, e.g., 'FISHING_NET', 'LAPTOP_DESKTOP'")
    requirement_details: Optional[str] = Field(None, description="Free text context notes from the citizen")
    state: str = Field(..., description="Target state")
    district: str = Field(..., description="Target district")
    area: Optional[str] = Field(None, description="Target area / locality / village")
    income: Optional[float] = Field(None, description="Citizen annual household income")
    quantity: int = Field(1, ge=1, description="Quantity requested")
    unit: str = Field(..., description="Unit of measurement, e.g., 'nets', 'laptops', 'kits'")


class StatusHistoryEntryResponse(BaseModel):
    status: CollaborationStatus
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MatchedCandidateNGOResponse(BaseModel):
    id: int
    collaboration_id: Optional[int] = None
    ngo_id: int
    ngo_code: str
    ngo_name: str
    status: CollaborationStatus
    matched_score: float
    matched_reasons: List[str]
    requested_quantity: int
    accepted_quantity: int
    estimated_duration_value: Optional[int] = None
    estimated_duration_unit: Optional[EstimatedDurationUnit] = None
    estimated_display: Optional[str] = None
    response_message: Optional[str] = None
    rejection_reason: Optional[str] = None
    status_history: List[StatusHistoryEntryResponse] = []

    class Config:
        from_attributes = True


class UserRequestTrackingResponse(BaseModel):
    request_id: int
    external_user_id: str
    service_category_code: str
    service_category_name: str
    requirement_code: str
    requirement_name: str
    requirement_details: Optional[str] = None
    state: str
    district: str
    area: Optional[str] = None
    requested_quantity: int
    unit: str
    status: RequestOverallStatus
    accepted_quantity: int
    remaining_quantity: int
    completed_quantity: int
    created_at: datetime
    collaborations: List[MatchedCandidateNGOResponse] = []

    class Config:
        from_attributes = True


class UserRequestSummaryResponse(BaseModel):
    request_id: int
    external_user_id: str
    service_category_code: str
    requirement_code: str
    quantity: int
    unit: str
    state: str
    district: str
    area: Optional[str] = None
    status: RequestOverallStatus
    accepted_quantity: int
    created_at: datetime

    class Config:
        from_attributes = True
