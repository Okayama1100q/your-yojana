from fastapi import HTTPException
from app.core.database import get_database
from app.models.benefit import create_disbursement_document
from app.models.enrollment import EnrollmentStatus
from app.schemas.benefit import DisbursementCreateRequest
from datetime import datetime, timezone
import uuid

class BenefitService:
    @staticmethod
    def _generate_disbursement_id() -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        random_suffix = uuid.uuid4().hex[:4].upper()
        return f"DISB-{timestamp}-{random_suffix}"

    @classmethod
    def record_disbursement(cls, enrollment_id: str, request: DisbursementCreateRequest) -> dict:
        db = get_database()
        
        # 1. Fetch enrollment
        enrollment = db.enrollments.find_one({"enrollment_id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Enrollment not found")
            
        current_status = enrollment.get("status")
        # Ensure enrollment is APPROVED or ACTIVE
        if current_status not in [EnrollmentStatus.APPROVED.value, EnrollmentStatus.ACTIVE.value]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot disburse benefits for enrollment in status: {current_status}. Must be APPROVED or ACTIVE."
            )
            
        # 2. If approved, automatically transition to ACTIVE
        if current_status == EnrollmentStatus.APPROVED.value:
            db.enrollments.update_one(
                {"enrollment_id": enrollment_id},
                {"$set": {
                    "status": EnrollmentStatus.ACTIVE.value,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
        # 3. Create disbursement document
        disbursement_id = cls._generate_disbursement_id()
        disbursement = create_disbursement_document(
            disbursement_id=disbursement_id,
            enrollment_id=enrollment_id,
            user_id=enrollment["user_id"],
            scheme_id=enrollment["scheme_id"],
            amount=request.amount,
            status=request.status,
            remarks=request.remarks
        )
        
        db.disbursements.insert_one(disbursement)
        
        # Convert ObjectId to string for JSON serialization
        disbursement["_id"] = str(disbursement["_id"])
        return disbursement

    @staticmethod
    def get_citizen_dashboard(user_id: str) -> dict:
        db = get_database()
        
        # 1. Fetch all enrollments for user
        enrollments_cursor = db.enrollments.find({"user_id": user_id})
        enrollments = list(enrollments_cursor)
        
        # 2. Fetch all disbursements for user
        disbursements_cursor = db.disbursements.find({"user_id": user_id})
        disbursements = list(disbursements_cursor)
        
        # Map disbursements to their respective enrollment_ids
        disb_map = {}
        for d in disbursements:
            d["_id"] = str(d["_id"])
            eid = d["enrollment_id"]
            if eid not in disb_map:
                disb_map[eid] = []
            disb_map[eid].append(d)
            
        active_enrollments_count = 0
        total_benefits_amount = 0.0
        enrollment_details = []
        
        for e in enrollments:
            e["_id"] = str(e["_id"])
            eid = e["enrollment_id"]
            status = e.get("status")
            
            if status == EnrollmentStatus.ACTIVE.value:
                active_enrollments_count += 1
                
            e_disbursements = disb_map.get(eid, [])
            total_disbursed = sum(d["amount"] for d in e_disbursements if d["status"] == "PAID")
            total_benefits_amount += total_disbursed
            
            enrollment_details.append({
                "enrollment_id": eid,
                "scheme_id": e["scheme_id"],
                "scheme_name": e.get("scheme_name", "Unknown Scheme"),
                "status": status,
                "total_disbursed": total_disbursed,
                "disbursements": e_disbursements
            })
            
        return {
            "user_id": user_id,
            "active_enrollments_count": active_enrollments_count,
            "total_benefits_amount": total_benefits_amount,
            "enrollments": enrollment_details
        }
