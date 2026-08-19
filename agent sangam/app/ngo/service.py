from datetime import datetime, timezone, timedelta
import json
from typing import List, Dict
from sqlalchemy.orm import Session

from app.core.models.master import ServiceCategory, Requirement
from app.core.models.ngo import NGO, NGOService, NGOCoverage
from app.core.models.collaboration import CollaborationRequest, Collaboration, RequestStatusHistory
from app.core.models.contribution import Contribution
from app.core.enums import (
    RegistrationStatus,
    EstimatedDurationUnit,
    RequestOverallStatus,
    CollaborationStatus,
    VALID_STATUS_TRANSITIONS,
)
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    ValidationException,
    DuplicateEntityException,
)
from app.core.ranking_service import DynamicRankingService
from app.ngo.schemas import (
    NGORegistrationRequest,
    NGOServiceCreate,
    NGOCoverageCreate,
    NGOServiceResponse,
    NGOCoverageResponse,
    NGOBasicDetailsResponse,
    NGOProfileResponse,
    NGORankResponse,
    CollaborationAcceptRequest,
    CollaborationRejectRequest,
    CollaborationStatusUpdateRequest,
    CollaborationDetailResponse,
    StatusHistoryEntryResponse,
    NGOContributionSummaryResponse,
    NGOContributionDetailResponse,
)


class NGOServiceManager:
    @classmethod
    def register_ngo(cls, db: Session, req_data: NGORegistrationRequest) -> NGO:
        # Check duplicate registration number
        existing = db.query(NGO).filter(NGO.registration_number == req_data.registration_number).first()
        if existing:
            raise DuplicateEntityException(f"NGO with registration number '{req_data.registration_number}' already exists")

        # Generate sequential NGO code
        count = db.query(NGO).count()
        ngo_code = f"NGO{count + 1:03d}"
        while db.query(NGO).filter(NGO.ngo_code == ngo_code).first():
            count += 1
            ngo_code = f"NGO{count + 1:03d}"

        ngo = NGO(
            ngo_code=ngo_code,
            ngo_name=req_data.ngo_name,
            registration_number=req_data.registration_number,
            contact_person=req_data.contact_person,
            phone=req_data.phone,
            state=req_data.state,
            district=req_data.district,
            address=req_data.address,
            description=req_data.description,
            registration_status=RegistrationStatus.PENDING,  # PENDING status by default!
            active=True,
        )
        db.add(ngo)
        db.commit()
        db.refresh(ngo)
        return ngo

    @classmethod
    def get_ngo_profile(cls, db: Session, ngo_id: int) -> NGOProfileResponse:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        services = [
            NGOServiceResponse(
                id=s.id,
                ngo_id=s.ngo_id,
                service_category_code=s.service_category.code,
                service_category_name=s.service_category.name,
                requirement_code=s.requirement.code,
                requirement_name=s.requirement.name,
                available_quantity=s.available_quantity,
                unit=s.unit,
                estimated_duration_value=s.estimated_duration_value,
                estimated_duration_unit=s.estimated_duration_unit,
                estimated_display=f"{s.estimated_duration_value} {s.estimated_duration_unit.value.lower()}",
                active=s.active,
                created_at=s.created_at,
            )
            for s in ngo.services
            if s.active
        ]

        coverage = [
            NGOCoverageResponse(
                id=c.id,
                ngo_id=c.ngo_id,
                state=c.state,
                district=c.district,
                area=c.area,
                active=c.active,
            )
            for c in ngo.coverage
            if c.active
        ]

        basic_details = NGOBasicDetailsResponse(
            id=ngo.id,
            ngo_code=ngo.ngo_code,
            ngo_name=ngo.ngo_name,
            registration_number=ngo.registration_number,
            contact_person=ngo.contact_person,
            phone=ngo.phone,
            state=ngo.state,
            district=ngo.district,
            address=ngo.address,
            description=ngo.description,
            registration_status=ngo.registration_status,
            active=ngo.active,
            created_at=ngo.created_at,
        )

        perf_data = DynamicRankingService.get_ngo_ranking_metrics(db, ngo.id)

        return NGOProfileResponse(
            id=ngo.id,
            ngo_code=ngo.ngo_code,
            ngo_name=ngo.ngo_name,
            basic_details=basic_details,
            services=services,
            coverage=coverage,
            performance=NGORankResponse(**perf_data),
        )

    @classmethod
    def get_ngo_services(cls, db: Session, ngo_id: int) -> List[NGOServiceResponse]:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        services = db.query(NGOService).filter(NGOService.ngo_id == ngo_id, NGOService.active == True).all()
        return [
            NGOServiceResponse(
                id=s.id,
                ngo_id=s.ngo_id,
                service_category_code=s.service_category.code,
                service_category_name=s.service_category.name,
                requirement_code=s.requirement.code,
                requirement_name=s.requirement.name,
                available_quantity=s.available_quantity,
                unit=s.unit,
                estimated_duration_value=s.estimated_duration_value,
                estimated_duration_unit=s.estimated_duration_unit,
                estimated_display=f"{s.estimated_duration_value} {s.estimated_duration_unit.value.lower()}",
                active=s.active,
                created_at=s.created_at,
            )
            for s in services
        ]

    @classmethod
    def add_ngo_service(cls, db: Session, ngo_id: int, service_data: NGOServiceCreate) -> NGOServiceResponse:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        cat = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.code == service_data.service_category.upper(), ServiceCategory.active == True)
            .first()
        )
        if not cat:
            raise EntityNotFoundException(f"Service category '{service_data.service_category}' not found")

        req = (
            db.query(Requirement)
            .filter(
                Requirement.service_category_id == cat.id,
                Requirement.code == service_data.requirement.upper(),
                Requirement.active == True,
            )
            .first()
        )
        if not req:
            raise EntityNotFoundException(
                f"Requirement '{service_data.requirement}' not found under category '{service_data.service_category}'"
            )

        existing = (
            db.query(NGOService)
            .filter(
                NGOService.ngo_id == ngo_id,
                NGOService.service_category_id == cat.id,
                NGOService.requirement_id == req.id,
            )
            .first()
        )

        if existing:
            existing.available_quantity = service_data.available_quantity
            existing.unit = service_data.unit
            existing.estimated_duration_value = service_data.estimated_duration_value
            existing.estimated_duration_unit = service_data.estimated_duration_unit
            existing.active = True
            db.commit()
            db.refresh(existing)
            target = existing
        else:
            new_service = NGOService(
                ngo_id=ngo_id,
                service_category_id=cat.id,
                requirement_id=req.id,
                available_quantity=service_data.available_quantity,
                unit=service_data.unit,
                estimated_duration_value=service_data.estimated_duration_value,
                estimated_duration_unit=service_data.estimated_duration_unit,
                active=True,
            )
            db.add(new_service)
            db.commit()
            db.refresh(new_service)
            target = new_service

        return NGOServiceResponse(
            id=target.id,
            ngo_id=target.ngo_id,
            service_category_code=cat.code,
            service_category_name=cat.name,
            requirement_code=req.code,
            requirement_name=req.name,
            available_quantity=target.available_quantity,
            unit=target.unit,
            estimated_duration_value=target.estimated_duration_value,
            estimated_duration_unit=target.estimated_duration_unit,
            estimated_display=f"{target.estimated_duration_value} {target.estimated_duration_unit.value.lower()}",
            active=target.active,
            created_at=target.created_at,
        )

    @classmethod
    def get_ngo_coverage(cls, db: Session, ngo_id: int) -> List[NGOCoverageResponse]:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        coverage = db.query(NGOCoverage).filter(NGOCoverage.ngo_id == ngo_id, NGOCoverage.active == True).all()
        return [
            NGOCoverageResponse(
                id=c.id,
                ngo_id=c.ngo_id,
                state=c.state,
                district=c.district,
                area=c.area,
                active=c.active,
            )
            for c in coverage
        ]

    @classmethod
    def add_ngo_coverage(cls, db: Session, ngo_id: int, cov_data: NGOCoverageCreate) -> NGOCoverageResponse:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        new_cov = NGOCoverage(
            ngo_id=ngo_id,
            state=cov_data.state,
            district=cov_data.district,
            area=cov_data.area,
            active=True,
        )
        db.add(new_cov)
        db.commit()
        db.refresh(new_cov)
        return NGOCoverageResponse(
            id=new_cov.id,
            ngo_id=new_cov.ngo_id,
            state=new_cov.state,
            district=new_cov.district,
            area=new_cov.area,
            active=new_cov.active,
        )


class NGOCollaborationService:
    @classmethod
    def get_ngo_collaborations(cls, db: Session, ngo_id: int, pending_only: bool = False) -> List[CollaborationDetailResponse]:
        query = db.query(Collaboration).filter(Collaboration.ngo_id == ngo_id)
        if pending_only:
            query = query.filter(Collaboration.status.in_([CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO]))

        collabs = query.order_by(Collaboration.created_at.desc()).all()
        results = []
        for c in collabs:
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

            results.append(
                CollaborationDetailResponse(
                    id=c.id,
                    request_id=c.request_id,
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
                    accepted_at=c.accepted_at,
                    completed_at=c.completed_at,
                    created_at=c.created_at,
                    status_history=hist_entries,
                )
            )
        return results

    @classmethod
    def accept_collaboration(
        cls, db: Session, collaboration_id: int, accept_data: CollaborationAcceptRequest
    ) -> CollaborationDetailResponse:
        collab = db.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            raise EntityNotFoundException(f"Collaboration #{collaboration_id} not found")

        if collab.status not in (CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO):
            raise InvalidOperationException(f"Cannot accept collaboration in '{collab.status.value}' status")

        collab_req: CollaborationRequest = collab.request

        # Verify NGO service stock
        service = (
            db.query(NGOService)
            .filter(
                NGOService.ngo_id == collab.ngo_id,
                NGOService.service_category_id == collab_req.service_category_id,
                NGOService.requirement_id == collab_req.requirement_id,
                NGOService.active == True,
            )
            .first()
        )

        if not service:
            raise InvalidOperationException("NGO does not have an active service for this requirement")

        if service.available_quantity < accept_data.accepted_quantity:
            raise InvalidOperationException(
                f"Requested accepted quantity ({accept_data.accepted_quantity}) exceeds available stock ({service.available_quantity})"
            )

        # Check remaining needed quantity for the user request
        all_collabs_for_req = db.query(Collaboration).filter(Collaboration.request_id == collab_req.id).all()
        total_accepted_so_far = sum(
            c.accepted_quantity for c in all_collabs_for_req
            if c.id != collab.id and c.status not in (CollaborationStatus.REJECTED, CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO)
        )
        remaining_needed = collab_req.quantity - total_accepted_so_far
        if accept_data.accepted_quantity > remaining_needed:
            raise InvalidOperationException(
                f"Accepted quantity ({accept_data.accepted_quantity}) exceeds remaining needed quantity ({remaining_needed})"
            )

        # Decrement NGO service stock
        service.available_quantity -= accept_data.accepted_quantity

        # Update collaboration
        now = datetime.now(timezone.utc)
        collab.status = CollaborationStatus.ACCEPTED
        collab.accepted_quantity = accept_data.accepted_quantity
        collab.estimated_duration_value = accept_data.estimated_duration_value
        collab.estimated_duration_unit = accept_data.estimated_duration_unit
        collab.response_message = accept_data.response_message
        collab.accepted_at = now

        # Add to immutable status history
        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=CollaborationStatus.ACCEPTED,
            remarks=f"Accepted {accept_data.accepted_quantity} units. Estimated delivery: {accept_data.estimated_duration_value} {accept_data.estimated_duration_unit.value.lower()}.",
            created_at=now,
        )
        db.add(history)

        # Recalculate parent CollaborationRequest overall status
        all_collabs = db.query(Collaboration).filter(Collaboration.request_id == collab_req.id).all()
        total_accepted = sum(c.accepted_quantity for c in all_collabs if c.status not in (CollaborationStatus.REJECTED, CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO))
        if total_accepted >= collab_req.quantity:
            collab_req.status = RequestOverallStatus.FULLY_SUPPORTED
        elif total_accepted > 0:
            collab_req.status = RequestOverallStatus.PARTIALLY_SUPPORTED
        else:
            collab_req.status = RequestOverallStatus.OPEN

        db.commit()
        db.refresh(collab)

        return cls.get_collaboration_detail(db, collab.id)

    @classmethod
    def reject_collaboration(
        cls, db: Session, collaboration_id: int, reject_data: CollaborationRejectRequest
    ) -> CollaborationDetailResponse:
        collab = db.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            raise EntityNotFoundException(f"Collaboration #{collaboration_id} not found")

        if collab.status not in (CollaborationStatus.REQUESTED, CollaborationStatus.SENT_TO_NGO):
            raise InvalidOperationException(f"Cannot reject collaboration in '{collab.status.value}' status")

        now = datetime.now(timezone.utc)
        collab.status = CollaborationStatus.REJECTED
        collab.rejection_reason = reject_data.rejection_reason

        # Status history
        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=CollaborationStatus.REJECTED,
            remarks=f"Rejected by NGO: {reject_data.rejection_reason}",
            created_at=now,
        )
        db.add(history)

        db.commit()
        db.refresh(collab)
        return cls.get_collaboration_detail(db, collab.id)

    @classmethod
    def update_collaboration_status(
        cls, db: Session, collaboration_id: int, status_data: CollaborationStatusUpdateRequest
    ) -> CollaborationDetailResponse:
        collab = db.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            raise EntityNotFoundException(f"Collaboration #{collaboration_id} not found")

        current_status = collab.status
        target_status = status_data.status

        # Validate allowed transition
        allowed_targets = VALID_STATUS_TRANSITIONS.get(current_status, set())
        if target_status not in allowed_targets:
            raise InvalidOperationException(
                f"Invalid status transition from '{current_status.value}' to '{target_status.value}'. Allowed transitions: {[s.value for s in allowed_targets]}"
            )

        now = datetime.now(timezone.utc)
        collab.status = target_status

        if target_status == CollaborationStatus.COMPLETED:
            collab.completed_at = now
            # Create verified contribution record!
            cls._record_contribution_on_completion(db, collab)

        # Record in status history
        history = RequestStatusHistory(
            collaboration_id=collab.id,
            status=target_status,
            remarks=status_data.remarks or f"Status updated to {target_status.value}.",
            created_at=now,
        )
        db.add(history)

        # Update parent request overall status
        collab_req: CollaborationRequest = collab.request
        all_collabs = db.query(Collaboration).filter(Collaboration.request_id == collab_req.id).all()
        total_completed = sum(c.accepted_quantity for c in all_collabs if c.status == CollaborationStatus.COMPLETED)
        if total_completed >= collab_req.quantity:
            collab_req.status = RequestOverallStatus.CLOSED
        elif all(c.status in (CollaborationStatus.COMPLETED, CollaborationStatus.REJECTED) for c in all_collabs):
            collab_req.status = RequestOverallStatus.CLOSED

        db.commit()
        db.refresh(collab)
        return cls.get_collaboration_detail(db, collab.id)

    @classmethod
    def _record_contribution_on_completion(cls, db: Session, collab: Collaboration):
        existing = db.query(Contribution).filter(Contribution.collaboration_id == collab.id).first()
        if existing:
            return

        collab_req: CollaborationRequest = collab.request

        # Determine on-time completion based on accepted_at and estimated duration
        on_time = True
        if collab.accepted_at and collab.estimated_duration_value and collab.estimated_duration_unit:
            unit = collab.estimated_duration_unit
            val = collab.estimated_duration_value
            delta = timedelta(days=val)
            if unit == EstimatedDurationUnit.HOURS:
                delta = timedelta(hours=val)
            elif unit == EstimatedDurationUnit.WEEKS:
                delta = timedelta(weeks=val)
            elif unit == EstimatedDurationUnit.MONTHS:
                delta = timedelta(days=val * 30)

            deadline = collab.accepted_at + delta
            now = datetime.now(timezone.utc)
            # Ensure timezone naive comparison for SQLite compatibility
            deadline_naive = deadline.replace(tzinfo=None) if deadline.tzinfo else deadline
            now_naive = now.replace(tzinfo=None) if now.tzinfo else now
            if now_naive > deadline_naive:
                on_time = False

        contrib = Contribution(
            ngo_id=collab.ngo_id,
            collaboration_id=collab.id,
            requirement_id=collab_req.requirement_id,
            quantity_provided=collab.accepted_quantity,
            unit=collab_req.unit,
            beneficiaries_helped=max(1, collab.accepted_quantity),
            completed_on_time=on_time,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(contrib)
        db.flush()

    @classmethod
    def get_collaboration_detail(cls, db: Session, collaboration_id: int) -> CollaborationDetailResponse:
        c = db.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not c:
            raise EntityNotFoundException(f"Collaboration #{collaboration_id} not found")

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

        return CollaborationDetailResponse(
            id=c.id,
            request_id=c.request_id,
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
            accepted_at=c.accepted_at,
            completed_at=c.completed_at,
            created_at=c.created_at,
            status_history=hist_entries,
        )

    @classmethod
    def get_ngo_contributions(cls, db: Session, ngo_id: int) -> NGOContributionSummaryResponse:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        contribs = db.query(Contribution).filter(Contribution.ngo_id == ngo_id).order_by(Contribution.completed_at.desc()).all()
        total_requests = len(contribs)
        total_beneficiaries = sum(c.beneficiaries_helped for c in contribs)
        total_qty = sum(c.quantity_provided for c in contribs)
        on_time_count = sum(1 for c in contribs if c.completed_on_time)
        on_time_rate = (on_time_count / total_requests * 100.0) if total_requests > 0 else 0.0

        detail_items = [
            NGOContributionDetailResponse(
                id=c.id,
                ngo_id=c.ngo_id,
                collaboration_id=c.collaboration_id,
                requirement_name=c.requirement.name,
                quantity_provided=c.quantity_provided,
                unit=c.unit,
                beneficiaries_helped=c.beneficiaries_helped,
                completed_on_time=c.completed_on_time,
                completed_at=c.completed_at,
            )
            for c in contribs
        ]

        return NGOContributionSummaryResponse(
            ngo_id=ngo.id,
            ngo_code=ngo.ngo_code,
            ngo_name=ngo.ngo_name,
            completed_requests=total_requests,
            beneficiaries_helped=total_beneficiaries,
            total_quantity_provided=total_qty,
            on_time_completion_rate=round(on_time_rate, 2),
            contributions=detail_items,
        )
