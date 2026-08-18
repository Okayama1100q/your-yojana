from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DisbursementCreateRequest(BaseModel):
    amount: float = Field(..., gt=0.0, json_schema_extra={"example": 2000.0})
    status: str = Field("PAID", json_schema_extra={"example": "PAID"})
    remarks: Optional[str] = Field(None, json_schema_extra={"example": "Monthly pension installment"})

class DisbursementResponse(BaseModel):
    disbursement_id: str
    enrollment_id: str
    user_id: str
    scheme_id: str
    amount: float
    disbursed_at: datetime
    status: str
    remarks: Optional[str]

class EnrollmentDashboardDetail(BaseModel):
    enrollment_id: str
    scheme_id: str
    scheme_name: str
    status: str
    total_disbursed: float
    disbursements: List[DisbursementResponse]

class CitizenDashboardResponse(BaseModel):
    user_id: str
    active_enrollments_count: int
    total_benefits_amount: float
    enrollments: List[EnrollmentDashboardDetail]
