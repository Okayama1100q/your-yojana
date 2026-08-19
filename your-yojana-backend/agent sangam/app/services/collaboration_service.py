from datetime import datetime, timezone
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.collaboration import CollaborationRequest, Collaboration, RequestStatusHistory
from app.models.master import ServiceCategory, Requirement
from app.models.ngo import NGO, NGOService
from app.schemas.collaboration import (
    CollaborationRequestCreate,
    CollaborationAcceptRequest,
    CollaborationRejectRequest,
    CollaborationStatusUpdateRequest,
    CollaborationDetailResponse,
    UserRequestTrackingResponse,
    UserRequestSummaryResponse,
    StatusHistoryResponse,
)
from app.utils.enums import (
    CollaborationStatus,
    RequestOverallStatus,
    EstimatedDurationUnit,
    VALID_STATUS_TRANSITIONS,
)
from app.utils.exceptions import (
    EntityNotFoundException,
    BusinessRuleValidationException,
    InvalidStateTransitionException,
)
from app.services.master_service import MasterDataService
from app.services.matching_engine import DeterministicMatchingEngine
from app.services.contribution_service import ContributionService


def utc_now():
    return datetime.now(timezone.utc)


ACTIVE_ACCEPTED_STATUSES = {
    CollaborationStatus.ACCEPTED,
    CollaborationStatus.PREPARING,
    CollaborationStatus.DISPATCHED,
    CollaborationStatus.IN_TRANSIT,
    CollaborationStatus.DELIVERED,
    CollaborationStatus.RECEIVED,
    CollaborationStatus.COMPLETED,
}


class CollaborationServiceLayer:
    @staticmethod
    def create_user_request(db: Session, data: CollaborationRequestCreate) -> UserRequestTrackingResponse:
        # Validate category and requirement
        category = MasterDataService.get_category_by_code(db, data.service_category)
        requirement = MasterDataService.get_requirement_by_code(
            db, data.service_category, data.requirement
        )

        if requirement.service_category_id != category.id:
            raise BusinessRuleValidationException(
                f"Requirement '{data.requirement}' does not belong to category '{data.service_category}'."
            )

        if data.quantity <= 0:
            raise BusinessRuleValidationException("Quantity must be greater than 0.")
        if data.income < 0:
            raise BusinessRuleValidationException("Income cannot be negative.")

        # Create Collaboration Request record
        req = CollaborationRequest(
            external_user_id=data.external_user_id.strip(),
            service_category_id=category.id,
            requirement_id=requirement.id,
            requirement_details=data.requirement_details.strip() if data.requirement_details else None,
            state=data.state.strip(),
            district=data.district.strip(),
            area=data.area.strip(),
            income=data.income,
            quantity=data.quantity,
            unit=data.unit.strip(),
            status=RequestOverallStatus.OPEN,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # Run Deterministic Matching Engine
        matches = DeterministicMatchingEngine.match_ngos_for_request(
            db=db,
            service_category_id=category.id,
            requirement_id=requirement.id,
            requested_quantity=data.quantity,
            state=data.state,
            district=data.district,
            area=data.area,
        )

        # Create Collaboration entries for matched candidate NGOs
        for match in matches:
            collab = Collaboration(
                request_id=req.id,
                ngo_id=match.ngo_id,
                status=CollaborationStatus.REQUESTED,
                matched_score=match.score,
                matched_reasons=json.dumps(match.reasons),
                requested_quantity=data.quantity,
                accepted_quantity=0,
                estimated_duration_value=match.estimated_duration_value,
                estimated_duration_unit=match.estimated_duration_unit,
                response_message=None,
                rejection_reason=None,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(collab)
            db.flush()

            # Record initial history entry
            history = RequestStatusHistory(
                collaboration_id=collab.id,
                status=CollaborationStatus.REQUESTED,
                remarks=f"Matched with score {match.score}. Collaboration request sent to NGO.",
                created_at=utc_now(),
            )
            db.add(history)

        db.commit()
        db.refresh(req)
        return CollaborationServiceLayer.get_request_tracking(db, req.id)

    @staticmethod
    def get_collaboration_by_id(db: Session, collaboration_id: int) -> Collaboration:
        collab = db.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            raise EntityNotFoundException("Collaboration", collaboration_id)
        return collab

    @staticmethod
    def recalculate_request_status(db: Session, request: CollaborationRequest) -> None:
        """Recalculates the overall status and accepted quantity of a collaboration request."""
        collaborations = db.query(Collaboration).filter(
            Collaboration.request_id == request.id
        ).all()

        total_accepted = sum(
            c.accepted_quantity for c in collaborations if c.status in ACTIVE_ACCEPTED_STATUSES
        )
        total_completed = sum(
            c.accepted_quantity for c in collaborations if c.status == CollaborationStatus.COMPLETED
        )

        if total_completed >= request.quantity and request.quantity > 0:
            request.status = RequestOverallStatus.CLOSED
        elif total_accepted >= request.quantity and request.quantity > 0:
            request.status = RequestOverallStatus.FULLY_SUPPORTED
        elif total_accepted > 0:
            request.status = RequestOverallStatus.PARTIALLY_SUPPORTED
        else:
            request.status = RequestOverallStatus.OPEN

        request.updated_at = utc_now()
        db.commit()
        db.refresh(request)

    @staticmethod
    def accept_collaboration(
        db: Session, collaboration_id: int, data: CollaborationAcceptRequest
    ) -> CollaborationDetailResponse:
        collab = CollaborationServiceLayer.get_collaboration_by_id(db, collaboration_id)
        req = collab.request

        if collab.status not in (CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO):
            raise BusinessRuleValidationException(
                f"Cannot accept collaboration in current status '{collab.status.value}'."
            )

        if data.accepted_quantity <= 0:
            raise BusinessRuleValidationException("Accepted quantity must be greater than 0.")

        # Calculate current accepted quantity from other active collaborations for this request
        other_collabs = db.query(Collaboration).filter(
            Collaboration.request_id == req.id,
            Collaboration.id != collab.id,
            Collaboration.status.in_(ACTIVE_ACCEPTED_STATUSES),
        ).all()
        already_accepted = sum(c.accepted_quantity for c in other_collabs)
        remaining_needed = req.quantity - already_accepted

        if data.accepted_quantity > remaining_needed:
            raise BusinessRuleValidationException(
                f"Accepted quantity ({data.accepted_quantity}) exceeds remaining required quantity ({remaining_needed})."
            )

        # Check NGO's actual available stock
        service = db.query(NGOService).filter(
            NGOService.ngo_id == collab.ngo_id,
            NGOService.service_category_id == req.service_category_id,
            NGOService.requirement_id == req.requirement_id,
            NGOService.active == True,
        ).first()

        if not service or service.available_quantity < data.accepted_quantity:
            available = service.available_quantity if service else 0
            raise BusinessRuleValidationException(
                f"NGO has insufficient available quantity ({available}) to fulfill requested ({data.accepted_quantity})."
            )

        # Decrement NGO service available quantity
        service.available_quantity -= data.accepted_quantity

        # Update collaboration
        now = utc_now()
        collab.status = CollaborationStatus.ACCEPTED
        collab.accepted_quantity = data.accepted_quantity
        collab.estimated_duration_value = data.estimated_duration_value
        collab.estimated_duration_unit = data.estimated_duration_unit
        collab.response_message = data.response_message.strip() if data.response_message else None
        collab.accepted_at = now
        collab.updated_at = now

        # Add history record
        dur_display = f"{data.estimated_duration_value} {data.estimated_duration_unit.value.lower()}"
        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=CollaborationStatus.ACCEPTED,
            remarks=f"Accepted {data.accepted_quantity} {req.unit}. Estimated time: {dur_display}.",
            created_at=now,
        )
        db.add(history)

        db.commit()
        db.refresh(collab)

        # Update parent request status
        CollaborationServiceLayer.recalculate_request_status(db, req)

        return CollaborationServiceLayer._format_collaboration_detail(collab)

    @staticmethod
    def reject_collaboration(
        db: Session, collaboration_id: int, data: CollaborationRejectRequest
    ) -> CollaborationDetailResponse:
        collab = CollaborationServiceLayer.get_collaboration_by_id(db, collaboration_id)
        req = collab.request

        if collab.status in (CollaborationStatus.COMPLETED, CollaborationStatus.RECEIVED, CollaborationStatus.REJECTED):
            raise BusinessRuleValidationException(
                f"Cannot reject collaboration in status '{collab.status.value}'."
            )

        # If it was previously accepted, restore the reserved stock to NGO service
        if collab.status in ACTIVE_ACCEPTED_STATUSES and collab.accepted_quantity > 0:
            service = db.query(NGOService).filter(
                NGOService.ngo_id == collab.ngo_id,
                NGOService.service_category_id == req.service_category_id,
                NGOService.requirement_id == req.requirement_id,
            ).first()
            if service:
                service.available_quantity += collab.accepted_quantity

        now = utc_now()
        collab.status = CollaborationStatus.REJECTED
        collab.rejection_reason = data.rejection_reason.strip()
        collab.accepted_quantity = 0
        collab.updated_at = now

        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=CollaborationStatus.REJECTED,
            remarks=f"Rejected: {data.rejection_reason.strip()}",
            created_at=now,
        )
        db.add(history)

        db.commit()
        db.refresh(collab)

        CollaborationServiceLayer.recalculate_request_status(db, req)

        return CollaborationServiceLayer._format_collaboration_detail(collab)

    @staticmethod
    def update_collaboration_status(
        db: Session, collaboration_id: int, data: CollaborationStatusUpdateRequest
    ) -> CollaborationDetailResponse:
        collab = CollaborationServiceLayer.get_collaboration_by_id(db, collaboration_id)
        req = collab.request
        current_status = collab.status
        target_status = data.status

        # Validate status transition
        allowed_targets = VALID_STATUS_TRANSITIONS.get(current_status, set())
        if target_status not in allowed_targets:
            raise InvalidStateTransitionException(current_status.value, target_status.value)

        now = utc_now()
        collab.status = target_status
        collab.updated_at = now

        if target_status == CollaborationStatus.COMPLETED:
            collab.completed_at = now
            # Automatically record contribution
            ContributionService.record_completed_contribution(db, collab)

        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=target_status,
            remarks=data.remarks.strip() if data.remarks else f"Status advanced to {target_status.value}.",
            created_at=now,
        )
        db.add(history)

        db.commit()
        db.refresh(collab)

        CollaborationServiceLayer.recalculate_request_status(db, req)

        return CollaborationServiceLayer._format_collaboration_detail(collab)

    @staticmethod
    def get_request_tracking(db: Session, request_id: int) -> UserRequestTrackingResponse:
        req = db.query(CollaborationRequest).filter(CollaborationRequest.id == request_id).first()
        if not req:
            raise EntityNotFoundException("CollaborationRequest", request_id)

        collaborations = (
            db.query(Collaboration)
            .filter(Collaboration.request_id == req.id)
            .order_by(Collaboration.matched_score.desc(), Collaboration.id.asc())
            .all()
        )

        total_accepted = sum(c.accepted_quantity for c in collaborations if c.status in ACTIVE_ACCEPTED_STATUSES)
        total_completed = sum(c.accepted_quantity for c in collaborations if c.status == CollaborationStatus.COMPLETED)
        remaining = max(0, req.quantity - total_accepted)

        collab_details = [
            CollaborationServiceLayer._format_collaboration_detail(c) for c in collaborations
        ]

        return UserRequestTrackingResponse(
            request_id=req.id,
            external_user_id=req.external_user_id,
            service_category_code=req.service_category.code,
            service_category_name=req.service_category.name,
            requirement_code=req.requirement.code,
            requirement_name=req.requirement.name,
            requirement_details=req.requirement_details,
            state=req.state,
            district=req.district,
            area=req.area,
            income=req.income,
            requested_quantity=req.quantity,
            unit=req.unit,
            status=req.status,
            accepted_quantity=total_accepted,
            remaining_quantity=remaining,
            completed_quantity=total_completed,
            collaborations=collab_details,
            created_at=req.created_at,
            updated_at=req.updated_at,
        )

    @staticmethod
    def get_user_requests(db: Session, external_user_id: str) -> List[UserRequestSummaryResponse]:
        requests = (
            db.query(CollaborationRequest)
            .filter(CollaborationRequest.external_user_id == external_user_id.strip())
            .order_by(CollaborationRequest.created_at.desc())
            .all()
        )

        results = []
        for req in requests:
            collabs = db.query(Collaboration).filter(Collaboration.request_id == req.id).all()
            total_accepted = sum(c.accepted_quantity for c in collabs if c.status in ACTIVE_ACCEPTED_STATUSES)
            remaining = max(0, req.quantity - total_accepted)

            results.append(
                UserRequestSummaryResponse(
                    request_id=req.id,
                    external_user_id=req.external_user_id,
                    service_category_code=req.service_category.code,
                    requirement_code=req.requirement.code,
                    state=req.state,
                    district=req.district,
                    area=req.area,
                    quantity=req.quantity,
                    unit=req.unit,
                    status=req.status,
                    accepted_quantity=total_accepted,
                    remaining_quantity=remaining,
                    created_at=req.created_at,
                )
            )
        return results

    @staticmethod
    def get_ngo_requests(
        db: Session, ngo_id: int, pending_only: bool = False
    ) -> List[CollaborationDetailResponse]:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException("NGO", ngo_id)

        query = db.query(Collaboration).filter(Collaboration.ngo_id == ngo.id)
        if pending_only:
            query = query.filter(
                Collaboration.status.in_([CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO])
            )

        collaborations = query.order_by(Collaboration.created_at.desc()).all()
        return [CollaborationServiceLayer._format_collaboration_detail(c) for c in collaborations]

    @staticmethod
    def _format_collaboration_detail(collab: Collaboration) -> CollaborationDetailResponse:
        dur_display = None
        if collab.estimated_duration_value and collab.estimated_duration_unit:
            dur_display = f"{collab.estimated_duration_value} {collab.estimated_duration_unit.value.lower()}"

        history_items = [
            StatusHistoryResponse(
                id=h.id,
                status=h.status,
                remarks=h.remarks,
                created_at=h.created_at,
            )
            for h in collab.status_history
        ]

        return CollaborationDetailResponse(
            id=collab.id,
            request_id=collab.request_id,
            ngo_id=collab.ngo_id,
            ngo_code=collab.ngo.ngo_code,
            ngo_name=collab.ngo.ngo_name,
            status=collab.status,
            matched_score=collab.matched_score,
            matched_reasons=collab.get_matched_reasons_list(),
            requested_quantity=collab.requested_quantity,
            accepted_quantity=collab.accepted_quantity,
            estimated_duration_value=collab.estimated_duration_value,
            estimated_duration_unit=collab.estimated_duration_unit,
            estimated_display=dur_display,
            response_message=collab.response_message,
            rejection_reason=collab.rejection_reason,
            accepted_at=collab.accepted_at,
            completed_at=collab.completed_at,
            status_history=history_items,
            created_at=collab.created_at,
            updated_at=collab.updated_at,
        )
