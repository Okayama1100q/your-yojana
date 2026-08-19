from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.utils.enums import CollaborationStatus, RequestOverallStatus, EstimatedDurationUnit


class CollaborationRequestCreate(BaseModel):
    external_user_id: str = Field(..., min_length=1, max_length=128, description="Citizen/User identifier from Your Yojana")
    service_category: str = Field(..., description="Standardized category code, e.g. FISHERIES")
    requirement: str = Field(..., description="Standardized requirement code, e.g. FISHING_NET")
    requirement_details: Optional[str] = Field(None, description="Free text context for NGO reference")
    state: str = Field(..., min_length=2, description="Target state")
    district: str = Field(..., min_length=2, description="Target district")
    area: str = Field(..., min_length=2, description="Target area / locality")
    income: float = Field(default=0.0, ge=0.0, description="Annual income (INR)")
    quantity: int = Field(..., gt=0, description="Requested quantity")
    unit: str = Field(..., min_length=1, description="Unit of measure, e.g. nets, units, kits")


class CollaborationAcceptRequest(BaseModel):
    accepted_quantity: int = Field(..., gt=0, description="Quantity the NGO commits to provide")
    estimated_duration_value: int = Field(..., gt=0, description="Estimated duration quantity")
    estimated_duration_unit: EstimatedDurationUnit = Field(
        default=EstimatedDurationUnit.DAYS,
        description="Duration unit: HOURS, DAYS, WEEKS, MONTHS"
    )
    response_message: Optional[str] = Field(None, description="Optional note or pickup/delivery instructions from NGO")


class CollaborationRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=2, description="Reason for inability to fulfill the request")


class CollaborationStatusUpdateRequest(BaseModel):
    status: CollaborationStatus = Field(..., description="New lifecycle status")
    remarks: Optional[str] = Field(None, description="Optional transition remarks or tracking notes")


class StatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: CollaborationStatus
    remarks: Optional[str] = None
    created_at: datetime


class CollaborationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    ngo_id: int
    ngo_code: str
    ngo_name: str
    status: CollaborationStatus
    matched_score: float
    matched_reasons: List[str] = []
    requested_quantity: int
    accepted_quantity: int
    estimated_duration_value: Optional[int] = None
    estimated_duration_unit: Optional[EstimatedDurationUnit] = None
    estimated_display: Optional[str] = None
    response_message: Optional[str] = None
    rejection_reason: Optional[str] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status_history: List[StatusHistoryResponse] = []
    created_at: datetime
    updated_at: datetime


class UserRequestTrackingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    external_user_id: str
    service_category_code: str
    service_category_name: str
    requirement_code: str
    requirement_name: str
    requirement_details: Optional[str] = None
    state: str
    district: str
    area: str
    income: float
    requested_quantity: int
    unit: str
    status: RequestOverallStatus
    accepted_quantity: int
    remaining_quantity: int
    completed_quantity: int
    collaborations: List[CollaborationDetailResponse] = []
    created_at: datetime
    updated_at: datetime


class UserRequestSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    external_user_id: str
    service_category_code: str
    requirement_code: str
    state: str
    district: str
    area: str
    quantity: int
    unit: str
    status: RequestOverallStatus
    accepted_quantity: int
    remaining_quantity: int
    created_at: datetime
