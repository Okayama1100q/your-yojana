import json
from typing import List
from sqlalchemy.orm import Session

from app.core.models.master import ServiceCategory, Requirement
from app.core.models.collaboration import CollaborationRequest, Collaboration, RequestStatusHistory
from app.core.models.ngo import NGO
from app.core.enums import RequestOverallStatus, CollaborationStatus, EstimatedDurationUnit
from app.core.exceptions import EntityNotFoundException, ValidationException
from app.core.matching_engine import DeterministicMatchingEngine
from app.user.schemas import (
    UserCollaborationRequestCreate,
    UserRequestTrackingResponse,
    MatchedCandidateNGOResponse,
    StatusHistoryEntryResponse,
    UserRequestSummaryResponse,
)


class UserCollaborationService:
    @classmethod
    def get_service_categories(cls, db: Session) -> List[ServiceCategory]:
        return db.query(ServiceCategory).filter(ServiceCategory.active == True).all()

    @classmethod
    def get_category_requirements(cls, db: Session, category_code: str) -> List[Requirement]:
        cat = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.code == category_code.upper(), ServiceCategory.active == True)
            .first()
        )
        if not cat:
            raise EntityNotFoundException(f"Service category '{category_code}' not found")
        return (
            db.query(Requirement)
            .filter(Requirement.service_category_id == cat.id, Requirement.active == True)
            .all()
        )

    @classmethod
    def create_user_request_and_match(
        cls, db: Session, request_data: UserCollaborationRequestCreate
    ) -> UserRequestTrackingResponse:
        # Validate category
        cat = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.code == request_data.service_category.upper(), ServiceCategory.active == True)
            .first()
        )
        if not cat:
            raise EntityNotFoundException(f"Service category '{request_data.service_category}' not found")

        # Validate requirement
        req = (
            db.query(Requirement)
            .filter(
                Requirement.service_category_id == cat.id,
                Requirement.code == request_data.requirement.upper(),
                Requirement.active == True,
            )
            .first()
        )
        if not req:
            raise EntityNotFoundException(
                f"Requirement '{request_data.requirement}' not found under category '{request_data.service_category}'"
            )

        # Create CollaborationRequest
        collab_req = CollaborationRequest(
            external_user_id=request_data.external_user_id,
            service_category_id=cat.id,
            requirement_id=req.id,
            requirement_details=request_data.requirement_details,
            state=request_data.state,
            district=request_data.district,
            area=request_data.area,
            income=request_data.income,
            quantity=request_data.quantity,
            unit=request_data.unit,
            status=RequestOverallStatus.OPEN,
        )
        db.add(collab_req)
        db.flush()

        # Run Deterministic Matching
        matches = DeterministicMatchingEngine.match_ngos_for_request(
            db=db,
            service_category_id=cat.id,
            requirement_id=req.id,
            requested_quantity=request_data.quantity,
            req_state=request_data.state,
            req_district=request_data.district,
            req_area=request_data.area,
        )

        for match in matches:
            collab = Collaboration(
                request_id=collab_req.id,
                ngo_id=match.ngo_id,
                status=CollaborationStatus.REQUESTED,
                matched_score=match.matched_score,
                matched_reasons=json.dumps(match.matched_reasons),
                requested_quantity=request_data.quantity,
                accepted_quantity=0,
                estimated_duration_value=match.estimated_duration_value,
                estimated_duration_unit=EstimatedDurationUnit(match.estimated_duration_unit),
            )
            db.add(collab)
            db.flush()

            # Record initial status in history
            history = RequestStatusHistory(
                collaboration_id=collab.id,
                status=CollaborationStatus.REQUESTED,
                remarks=f"Matched deterministically with score {match.matched_score:.2f} pts and sent to NGO for review.",
            )
            db.add(history)

        db.commit()
        db.refresh(collab_req)

        return cls.get_request_tracking(db, collab_req.id)

    @classmethod
    def get_request_tracking(cls, db: Session, request_id: int) -> UserRequestTrackingResponse:
        collab_req = (
            db.query(CollaborationRequest)
            .filter(CollaborationRequest.id == request_id)
            .first()
        )
        if not collab_req:
            raise EntityNotFoundException(f"Collaboration request #{request_id} not found")

        collaborations = (
            db.query(Collaboration)
            .filter(Collaboration.request_id == request_id)
            .order_by(Collaboration.matched_score.desc())
            .all()
        )

        total_accepted = sum(c.accepted_quantity for c in collaborations if c.status not in (CollaborationStatus.REJECTED, CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO))
        total_completed = sum(c.accepted_quantity for c in collaborations if c.status == CollaborationStatus.COMPLETED)
        remaining = max(0, collab_req.quantity - total_accepted)

        matched_responses = []
        for c in collaborations:
            ngo: NGO = c.ngo
            reasons = []
            if c.matched_reasons:
                try:
                    reasons = json.loads(c.matched_reasons)
                except Exception:
                    reasons = [c.matched_reasons]

            hist_entries = [
                StatusHistoryEntryResponse(
                    status=h.status,
                    remarks=h.remarks,
                    created_at=h.created_at,
                )
                for h in c.status_history
            ]

            est_display = None
            if c.estimated_duration_value and c.estimated_duration_unit:
                unit_str = c.estimated_duration_unit.value.lower() if hasattr(c.estimated_duration_unit, "value") else str(c.estimated_duration_unit).lower()
                est_display = f"{c.estimated_duration_value} {unit_str}"

            matched_responses.append(
                MatchedCandidateNGOResponse(
                    id=c.id,
                    ngo_id=ngo.id,
                    ngo_code=ngo.ngo_code,
                    ngo_name=ngo.ngo_name,
                    status=c.status,
                    matched_score=c.matched_score,
                    matched_reasons=reasons,
                    requested_quantity=c.requested_quantity,
                    accepted_quantity=c.accepted_quantity,
                    estimated_duration_value=c.estimated_duration_value,
                    estimated_duration_unit=c.estimated_duration_unit,
                    estimated_display=est_display,
                    response_message=c.response_message,
                    rejection_reason=c.rejection_reason,
                    status_history=hist_entries,
                )
            )

        return UserRequestTrackingResponse(
            request_id=collab_req.id,
            external_user_id=collab_req.external_user_id,
            service_category_code=collab_req.service_category.code,
            service_category_name=collab_req.service_category.name,
            requirement_code=collab_req.requirement.code,
            requirement_name=collab_req.requirement.name,
            requirement_details=collab_req.requirement_details,
            state=collab_req.state,
            district=collab_req.district,
            area=collab_req.area,
            requested_quantity=collab_req.quantity,
            unit=collab_req.unit,
            status=collab_req.status,
            accepted_quantity=total_accepted,
            remaining_quantity=remaining,
            completed_quantity=total_completed,
            created_at=collab_req.created_at,
            collaborations=matched_responses,
        )

    @classmethod
    def get_requests_by_user(cls, db: Session, external_user_id: str) -> List[UserRequestSummaryResponse]:
        requests = (
            db.query(CollaborationRequest)
            .filter(CollaborationRequest.external_user_id == external_user_id)
            .order_by(CollaborationRequest.created_at.desc())
            .all()
        )

        summaries = []
        for req in requests:
            collabs = db.query(Collaboration).filter(Collaboration.request_id == req.id).all()
            total_accepted = sum(c.accepted_quantity for c in collabs if c.status not in (CollaborationStatus.REJECTED, CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO))
            summaries.append(
                UserRequestSummaryResponse(
                    request_id=req.id,
                    external_user_id=req.external_user_id,
                    service_category_code=req.service_category.code,
                    requirement_code=req.requirement.code,
                    quantity=req.quantity,
                    unit=req.unit,
                    state=req.state,
                    district=req.district,
                    area=req.area,
                    status=req.status,
                    accepted_quantity=total_accepted,
                    created_at=req.created_at,
                )
            )
        return summaries
