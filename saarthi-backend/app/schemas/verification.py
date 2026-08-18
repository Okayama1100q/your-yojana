from pydantic import BaseModel, Field
from datetime import datetime

class VerificationRequest(BaseModel):
    document_url: str = Field(..., json_schema_extra={"example": "https://example.com/certificate.pdf"})

class VerificationResponse(BaseModel):
    enrollment_id: str
    previous_status: str
    new_status: str
    is_valid: bool
    confidence_score: float
    agent_reason: str
    verified_at: datetime
