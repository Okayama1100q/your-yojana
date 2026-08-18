from enum import Enum
from datetime import datetime, timezone
from typing import Dict, Any

class EnrollmentStatus(str, Enum):
    SELECTED = "SELECTED"
    REGISTRATION_PENDING = "REGISTRATION_PENDING"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    DISCONTINUED = "DISCONTINUED"
    DOCUMENT_CORRECTION_REQUIRED = "DOCUMENT_CORRECTION_REQUIRED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"
    RENEWAL_PENDING = "RENEWAL_PENDING"

def create_enrollment_document(
    enrollment_id: str,
    user_id: str,
    scheme_id: str,
    scheme_name: str,
    relevance_score: float,
    official_link: str,
    category: list[str],
    ai_explanation: str,
    eligibility_snapshot: Dict[str, Any]
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "enrollment_id": enrollment_id,
        "user_id": user_id,
        "scheme_id": scheme_id,
        "scheme_name": scheme_name,
        "relevance_score": relevance_score,
        "official_link": official_link,
        "category": category,
        "ai_explanation": ai_explanation,
        "status": EnrollmentStatus.REGISTRATION_PENDING.value,
        "eligibility_snapshot": eligibility_snapshot,
        "selected_at": now,
        "updated_at": now,
        "created_at": now
    }
