from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.contribution import Contribution
from app.models.collaboration import Collaboration
from app.models.ngo import NGO
from app.schemas.contribution import ContributionItemResponse, NGOContributionSummaryResponse
from app.utils.enums import EstimatedDurationUnit
from app.utils.exceptions import BusinessRuleValidationException, EntityNotFoundException


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class ContributionService:
    @staticmethod
    def record_completed_contribution(db: Session, collaboration: Collaboration) -> Contribution:
        """
        Records a Contribution ONLY when a collaboration reaches COMPLETED status.
        Never before.
        """
        # Ensure no duplicate contribution
        existing = db.query(Contribution).filter(
            Contribution.collaboration_id == collaboration.id
        ).first()
        if existing:
            return existing

        now = to_naive_utc(datetime.now(timezone.utc))

        # Check if completed on time based on estimated duration from accepted_at
        is_on_time = True
        accepted_at_naive = to_naive_utc(collaboration.accepted_at)
        if accepted_at_naive and collaboration.estimated_duration_value and collaboration.estimated_duration_unit:
            dur_val = collaboration.estimated_duration_value
            unit = collaboration.estimated_duration_unit

            if unit == EstimatedDurationUnit.HOURS:
                target_deadline = accepted_at_naive + timedelta(hours=dur_val)
            elif unit == EstimatedDurationUnit.DAYS:
                target_deadline = accepted_at_naive + timedelta(days=dur_val)
            elif unit == EstimatedDurationUnit.WEEKS:
                target_deadline = accepted_at_naive + timedelta(weeks=dur_val)
            elif unit == EstimatedDurationUnit.MONTHS:
                target_deadline = accepted_at_naive + timedelta(days=dur_val * 30)
            else:
                target_deadline = accepted_at_naive + timedelta(days=dur_val)

            comp_time = to_naive_utc(collaboration.completed_at) or now
            if comp_time > target_deadline + timedelta(hours=12):  # reasonable grace margin
                is_on_time = False

        req = collaboration.request
        beneficiaries = max(1, collaboration.accepted_quantity)

        contrib = Contribution(
            ngo_id=collaboration.ngo_id,
            collaboration_id=collaboration.id,
            requirement_id=req.requirement_id,
            quantity_provided=collaboration.accepted_quantity,
            unit=req.unit,
            beneficiaries_helped=beneficiaries,
            completed_on_time=is_on_time,
            completed_at=to_naive_utc(collaboration.completed_at) or now,
            created_at=now,
        )
        db.add(contrib)
        db.commit()
        db.refresh(contrib)
        return contrib

    @staticmethod
    def get_ngo_contributions_summary(db: Session, ngo_id: int) -> NGOContributionSummaryResponse:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException("NGO", ngo_id)

        contributions = (
            db.query(Contribution)
            .filter(Contribution.ngo_id == ngo.id)
            .order_by(Contribution.completed_at.desc())
            .all()
        )

        completed_count = len(contributions)
        beneficiaries_helped = sum(c.beneficiaries_helped for c in contributions)
        total_quantity = sum(c.quantity_provided for c in contributions)

        on_time_count = sum(1 for c in contributions if c.completed_on_time)
        on_time_rate = round((on_time_count / completed_count * 100.0), 1) if completed_count > 0 else 0.0

        items = []
        for c in contributions:
            items.append(
                ContributionItemResponse(
                    id=c.id,
                    ngo_id=c.ngo_id,
                    collaboration_id=c.collaboration_id,
                    requirement_code=c.requirement.code,
                    requirement_name=c.requirement.name,
                    quantity_provided=c.quantity_provided,
                    unit=c.unit,
                    beneficiaries_helped=c.beneficiaries_helped,
                    completed_on_time=c.completed_on_time,
                    completed_at=c.completed_at,
                    created_at=c.created_at,
                )
            )

        return NGOContributionSummaryResponse(
            ngo_id=ngo.id,
            ngo_code=ngo.ngo_code,
            ngo_name=ngo.ngo_name,
            completed_requests=completed_count,
            beneficiaries_helped=beneficiaries_helped,
            total_quantity_provided=total_quantity,
            on_time_completion_rate=on_time_rate,
            contributions=items,
        )
