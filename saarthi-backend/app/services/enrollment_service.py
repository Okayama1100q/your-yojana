from fastapi import HTTPException
from app.core.database import get_database
from app.schemas.enrollment import EnrollmentCreateRequest
from app.models.enrollment import create_enrollment_document, EnrollmentStatus
from datetime import datetime, timezone
from pymongo.errors import PyMongoError
import uuid

# Define terminal statuses that allow re-enrollment
TERMINAL_STATUSES = [
    EnrollmentStatus.REJECTED.value,
    EnrollmentStatus.EXPIRED.value
]

class EnrollmentService:
    @staticmethod
    def _generate_enrollment_id() -> str:
        """Generates a collision-safe readable ID"""
        # A simple generation strategy for now: ENR- + timestamp + 4 random chars
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        random_suffix = uuid.uuid4().hex[:4].upper()
        return f"ENR-{timestamp}-{random_suffix}"

    @classmethod
    def create_enrollment(cls, request: EnrollmentCreateRequest) -> dict:
        db = get_database()
        collection = db["enrollments"]

        # Check for existing active/pending enrollments to prevent duplicates
        existing_enrollment = collection.find_one({
            "user_id": request.user_id,
            "scheme_id": request.selected_scheme.scheme_id,
            "status": {"$nin": TERMINAL_STATUSES}
        })

        if existing_enrollment:
            raise HTTPException(
                status_code=409, 
                detail="User already has an active or pending enrollment for this scheme."
            )

        enrollment_id = cls._generate_enrollment_id()
        
        # We store the citizen profile as the eligibility snapshot
        eligibility_snapshot = request.profile.model_dump()

        document = create_enrollment_document(
            enrollment_id=enrollment_id,
            user_id=request.user_id,
            scheme_id=request.selected_scheme.scheme_id,
            scheme_name=request.selected_scheme.scheme_name,
            relevance_score=request.selected_scheme.relevance_score,
            official_link=request.selected_scheme.official_link,
            category=request.selected_scheme.category,
            ai_explanation=request.selected_scheme.ai_explanation,
            eligibility_snapshot=eligibility_snapshot
        )

        try:
            collection.insert_one(document)
        except PyMongoError as e:
            raise HTTPException(
                status_code=500,
                detail="An error occurred while saving the enrollment."
            )
            
        return document
