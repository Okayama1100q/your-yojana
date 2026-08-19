from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.enums import RegistrationStatus, EstimatedDurationUnit, CollaborationStatus


# Registration & Profile Schemas
class NGORegistrationRequest(BaseModel):
    ngo_name: str = Field(..., max_length=200, description="Official name of the NGO")
    registration_number: str = Field(..., max_length=100, description="Unique government registration number")
    contact_person: str = Field(..., max_length=100, description="Primary coordinator/contact person")
    phone: str = Field(..., max_length=20, description="Contact phone number")
    state: str = Field(..., max_length=100, description="State of registration/headquarters")
    district: str = Field(..., max_length=100, description="District of registration/headquarters")
    address: str = Field(..., max_length=300, description="Physical address")
    description: Optional[str] = Field(None, max_length=1000, description="Mission statement or organizational overview")


class NGORegistrationResponse(BaseModel):
    id: int
    ngo_code: str
    ngo_name: str
    registration_number: str
    registration_status: RegistrationStatus
    active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class NGOBasicDetailsResponse(BaseModel):
    id: int
    ngo_code: str
    ngo_name: str
    registration_number: str
    contact_person: str
    phone: str
    state: str
    district: str
    address: str
    description: Optional[str] = None
    registration_status: RegistrationStatus
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Service & Coverage Schemas
class NGOServiceCreate(BaseModel):
    service_category: str = Field(..., description="Category code, e.g., 'FISHERIES', 'HEALTHCARE'")
    requirement: str = Field(..., description="Requirement code, e.g., 'FISHING_NET', 'WHEELCHAIR'")
    available_quantity: int = Field(..., ge=1, description="Quantity available in inventory")
    unit: str = Field(..., max_length=50, description="Measurement unit")
    estimated_duration_value: int = Field(1, ge=1, description="Estimated duration quantity")
    estimated_duration_unit: EstimatedDurationUnit = Field(EstimatedDurationUnit.DAYS, description="Duration unit")


class NGOServiceResponse(BaseModel):
    id: int
    ngo_id: int
    service_category_code: str
    service_category_name: str
    requirement_code: str
    requirement_name: str
    available_quantity: int
    unit: str
    estimated_duration_value: int
    estimated_duration_unit: EstimatedDurationUnit
    estimated_display: str
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NGOCoverageCreate(BaseModel):
    state: str = Field(..., max_length=100, description="State covered")
    district: str = Field(..., max_length=100, description="District covered")
    area: Optional[str] = Field(None, max_length=100, description="Specific area / locality (optional)")


class NGOCoverageResponse(BaseModel):
    id: int
    ngo_id: int
    state: str
    district: str
    area: Optional[str] = None
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NGORankResponse(BaseModel):
    ngo_id: int
    ngo_code: str
    ngo_name: str
    current_rank: int
    ranking_score: float
    completed_requests: int
    beneficiaries_helped: int
    total_quantity_provided: int
    on_time_completion_rate: float


class NGOProfileResponse(BaseModel):
    id: Optional[int] = None
    ngo_code: Optional[str] = None
    ngo_name: Optional[str] = None
    basic_details: NGOBasicDetailsResponse
    services: List[NGOServiceResponse] = []
    coverage: List[NGOCoverageResponse] = []
    performance: NGORankResponse

    class Config:
        from_attributes = True


# Collaboration Acceptance & Status Update Schemas
class CollaborationAcceptRequest(BaseModel):
    accepted_quantity: int = Field(..., ge=1, description="Quantity the NGO commits to provide")
    estimated_duration_value: int = Field(..., ge=1, description="Estimated duration value")
    estimated_duration_unit: EstimatedDurationUnit = Field(EstimatedDurationUnit.DAYS, description="Duration unit")
    response_message: Optional[str] = Field(None, description="Optional delivery / fulfillment instructions")


class CollaborationRejectRequest(BaseModel):
    rejection_reason: str = Field(..., max_length=1000, description="Reason for rejection")


class CollaborationStatusUpdateRequest(BaseModel):
    status: CollaborationStatus = Field(..., description="Target status in the lifecycle")
    remarks: Optional[str] = Field(None, max_length=500, description="Tracking remarks or update notes")


class StatusHistoryEntryResponse(BaseModel):
    status: CollaborationStatus
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CollaborationDetailResponse(BaseModel):
    id: int
    request_id: int
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
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    status_history: List[StatusHistoryEntryResponse] = []

    class Config:
        from_attributes = True


# Contribution Schemas
class NGOContributionDetailResponse(BaseModel):
    id: int
    ngo_id: int
    collaboration_id: int
    requirement_name: str
    quantity_provided: int
    unit: str
    beneficiaries_helped: int
    completed_on_time: bool
    completed_at: datetime

    class Config:
        from_attributes = True


class NGOContributionSummaryResponse(BaseModel):
    ngo_id: int
    ngo_code: str
    ngo_name: str
    completed_requests: int
    beneficiaries_helped: int
    total_quantity_provided: int
    on_time_completion_rate: float
    contributions: List[NGOContributionDetailResponse] = []
