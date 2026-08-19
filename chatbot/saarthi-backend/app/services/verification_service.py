from fastapi import HTTPException
from app.core.database import get_database
from app.agent.verification_agent import VerificationAgent
from app.models.enrollment import EnrollmentStatus
from datetime import datetime, timezone
from typing import List, Dict, Any

class VerificationService:
    @staticmethod
    def get_pending_enrollments() -> List[Dict[str, Any]]:
        """
        Retrieves all enrollments that are pending verification.
        We'll treat REGISTRATION_PENDING as needing verification for now.
        """
        db = get_database()
        cursor = db.enrollments.find({"status": EnrollmentStatus.REGISTRATION_PENDING.value})
        
        enrollments = []
        for doc in cursor:
            # Convert ObjectId to string if needed, but we rely on enrollment_id
            doc["_id"] = str(doc["_id"])
            enrollments.append(doc)
            
        return enrollments

    @staticmethod
    def process_verification(enrollment_id: str, document_url: str) -> dict:
        """
        Processes the verification of a document for a specific enrollment using the AI agent.
        """
        db = get_database()
        
        # 1. Fetch enrollment
        enrollment = db.enrollments.find_one({"enrollment_id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Enrollment not found")
            
        previous_status = enrollment.get("status")
        if previous_status not in [EnrollmentStatus.REGISTRATION_PENDING.value, EnrollmentStatus.DOCUMENT_CORRECTION_REQUIRED.value]:
            raise HTTPException(
                status_code=400, 
                detail=f"Enrollment is not in a valid state for verification. Current state: {previous_status}"
            )
            
        # 2. Call Verification Agent
        agent_result = VerificationAgent.verify_document(enrollment_id, document_url)
        
        # 3. Determine new status
        new_status = EnrollmentStatus.APPROVED.value if agent_result["is_valid"] else EnrollmentStatus.DOCUMENT_CORRECTION_REQUIRED.value
        
        now = datetime.now(timezone.utc)
        
        # 4. Update Database
        update_result = db.enrollments.update_one(
            {"enrollment_id": enrollment_id},
            {"$set": {
                "status": new_status,
                "updated_at": now,
                "last_verification_reason": agent_result["reason"]
            }}
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update enrollment status in database.")
            
        # 5. Return result
        return {
            "enrollment_id": enrollment_id,
            "previous_status": previous_status,
            "new_status": new_status,
            "is_valid": agent_result["is_valid"],
            "confidence_score": agent_result["confidence"],
            "agent_reason": agent_result["reason"],
            "verified_at": now
        }
