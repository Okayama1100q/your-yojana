from fastapi import HTTPException
from app.core.database import get_database
from app.models.enrollment import EnrollmentStatus
from app.schemas.lifecycle import LifecycleUpdateRequest
from datetime import datetime, timezone

class LifecycleService:
    @staticmethod
    def update_status(enrollment_id: str, request: LifecycleUpdateRequest) -> dict:
        db = get_database()
        
        # 1. Fetch enrollment
        enrollment = db.enrollments.find_one({"enrollment_id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Enrollment not found")
            
        # 2. Check ownership
        if enrollment.get("user_id") != request.user_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Enrollment does not belong to the specified user."
            )
            
        current_status = enrollment.get("status")
        # Allowed statuses to modify
        allowed_source_statuses = [
            EnrollmentStatus.APPROVED.value,
            EnrollmentStatus.ACTIVE.value,
            EnrollmentStatus.SUSPENDED.value,
            EnrollmentStatus.DISCONTINUED.value
        ]
        if current_status not in allowed_source_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from: {current_status}. Enrollment must be APPROVED, ACTIVE, SUSPENDED, or DISCONTINUED."
            )
            
        # Validate target status
        target_status = request.status
        allowed_target_statuses = [
            EnrollmentStatus.ACTIVE.value,
            EnrollmentStatus.SUSPENDED.value,
            EnrollmentStatus.DISCONTINUED.value
        ]
        if target_status not in allowed_target_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid target status: {target_status}. Allowed target statuses are ACTIVE, SUSPENDED, or DISCONTINUED."
            )
            
        if current_status == target_status:
            return {
                "enrollment_id": enrollment_id,
                "user_id": request.user_id,
                "previous_status": current_status,
                "new_status": target_status,
                "updated_at": enrollment.get("updated_at")
            }
            
        now = datetime.now(timezone.utc)
        
        # Update DB
        db.enrollments.update_one(
            {"enrollment_id": enrollment_id},
            {"$set": {
                "status": target_status,
                "updated_at": now
            }}
        )
        
        return {
            "enrollment_id": enrollment_id,
            "user_id": request.user_id,
            "previous_status": current_status,
            "new_status": target_status,
            "updated_at": now
        }
