from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.utils.enums import RegistrationStatus
from app.schemas.service_coverage import NGOServiceResponse, NGOCoverageResponse


class NGORegistrationRequest(BaseModel):
    ngo_name: str = Field(..., min_length=3, max_length=255, description="Official name of the NGO")
    registration_number: str = Field(..., min_length=2, max_length=128, description="Government registration number")
    contact_person: str = Field(..., min_length=2, max_length=128, description="Primary contact person")
    phone: str = Field(..., min_length=7, max_length=32, description="Contact phone number")
    state: str = Field(..., min_length=2, max_length=128, description="Registered state")
    district: str = Field(..., min_length=2, max_length=128, description="Registered district")
    address: str = Field(..., min_length=5, description="Full registered address")
    description: Optional[str] = Field(None, description="Brief description of the organization's focus and mission")


class NGOStatusUpdateRequest(BaseModel):
    registration_status: RegistrationStatus = Field(..., description="New registration status: APPROVED, REJECTED, SUSPENDED")
    remarks: Optional[str] = Field(None, description="Admin remarks or reason for status update")


class NGOBasicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    updated_at: datetime


class NGOStatsSummary(BaseModel):
    completed_requests: int = 0
    beneficiaries_helped: int = 0
    total_quantity_provided: int = 0
    on_time_completion_rate: float = 0.0
    ranking_score: float = 0.0
    current_rank: Optional[int] = None


class NGOProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    basic_details: NGOBasicResponse
    services: List[NGOServiceResponse] = []
    coverage: List[NGOCoverageResponse] = []
    performance: NGOStatsSummary
