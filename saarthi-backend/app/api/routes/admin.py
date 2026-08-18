from fastapi import APIRouter, status
from typing import List, Dict, Any
from app.schemas.verification import VerificationRequest, VerificationResponse
from app.services.verification_service import VerificationService

router = APIRouter()

@router.get("/enrollments/pending", response_model=List[Dict[str, Any]])
def get_pending_enrollments():
    """
    Retrieves a list of all enrollments that are pending verification.
    """
    return VerificationService.get_pending_enrollments()

@router.post("/enrollments/{enrollment_id}/verify", response_model=VerificationResponse)
def verify_enrollment(enrollment_id: str, request: VerificationRequest):
    """
    Triggers the AI verification agent to verify the provided document for the given enrollment.
    """
    return VerificationService.process_verification(enrollment_id, request.document_url)
