from fastapi import APIRouter, status
from app.schemas.benefit import DisbursementCreateRequest, DisbursementResponse, CitizenDashboardResponse
from app.services.benefit_service import BenefitService

router = APIRouter()

@router.post("/admin/enrollments/{enrollment_id}/disbursements", response_model=DisbursementResponse, status_code=status.HTTP_201_CREATED)
def disburse_benefits(enrollment_id: str, request: DisbursementCreateRequest):
    """
    Admin records a benefit disbursement (payment) for an enrollment.
    """
    return BenefitService.record_disbursement(enrollment_id, request)

@router.get("/citizen/dashboard", response_model=CitizenDashboardResponse)
def get_dashboard(user_id: str):
    """
    Retrieves the consolidated scheme tracking dashboard for a user.
    """
    return BenefitService.get_citizen_dashboard(user_id)
