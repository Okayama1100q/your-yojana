from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CitizenProfileSchema(BaseModel):
    gender: str = Field(..., example="Male")
    age: int = Field(..., gt=0, example=65)
    marital_status: str = Field(..., example="Married")
    state: str = Field(..., example="Madhya Pradesh")
    area_of_residence: str = Field(..., example="Urban")
    community: str = Field(..., example="SC")
    disability: bool = Field(..., example=True)
    minority_status: bool = Field(..., example=False)
    student_status: bool = Field(..., example=False)
    bpl_category: bool = Field(..., example=True)
    family_annual_income: float = Field(..., example=60000)
    parent_guardian_annual_income: Optional[float] = None

class SelectedSchemeSchema(BaseModel):
    scheme_id: str = Field(..., example="MP-KSK-DISABILITY")
    scheme_name: str = Field(..., example="Madhya Pradesh Kalakar Evam Sahityakar Kalyan Kosh Niyam - Disability Assistance")
    relevance_score: float = Field(..., ge=0.0, le=1.0, example=0.7013)
    official_link: str = Field(..., example="https://example.gov.in")
    category: List[str] = Field(..., example=["Sports & Culture", "Social Welfare & Empowerment"])
    ai_explanation: str = Field(..., example="You qualify for this scheme...")

class EnrollmentCreateRequest(BaseModel):
    user_id: str = Field(..., example="USR-1001")
    profile: CitizenProfileSchema
    selected_scheme: SelectedSchemeSchema

class EnrollmentResponse(BaseModel):
    enrollment_id: str
    user_id: str
    scheme_id: str
    status: str
    created_at: datetime
