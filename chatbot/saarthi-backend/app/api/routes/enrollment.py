from fastapi import APIRouter, status
from app.schemas.enrollment import EnrollmentCreateRequest, EnrollmentResponse
from app.schemas.lifecycle import LifecycleUpdateRequest
from app.services.enrollment_service import EnrollmentService
from app.services.lifecycle_service import LifecycleService

router = APIRouter()

@router.post("/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_citizen(request: EnrollmentCreateRequest):
    """
    Creates a new scheme enrollment for a citizen based on Swasthika's recommendation.
    """
    enrollment_doc = EnrollmentService.create_enrollment(request)
    
    return EnrollmentResponse(
        enrollment_id=enrollment_doc["enrollment_id"],
        user_id=enrollment_doc["user_id"],
        scheme_id=enrollment_doc["scheme_id"],
        status=enrollment_doc["status"],
        created_at=enrollment_doc["created_at"]
    )

@router.patch("/enrollments/{enrollment_id}/lifecycle")
def update_enrollment_lifecycle(enrollment_id: str, request: LifecycleUpdateRequest):
    """
    Allows a citizen to transition their enrollment status to ACTIVE, SUSPENDED, or DISCONTINUED.
    """
    return LifecycleService.update_status(enrollment_id, request)

