from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.models.ngo import NGO
from app.core.enums import RegistrationStatus
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.ranking_service import DynamicRankingService
from app.admin.schemas import LeaderboardResponse, LeaderboardEntryResponse


class AdminNGOService:
    @classmethod
    def list_ngos(
        cls,
        db: Session,
        status: Optional[RegistrationStatus] = None,
        active: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[NGO]:
        query = db.query(NGO)
        if status:
            query = query.filter(NGO.registration_status == status)
        if active is not None:
            query = query.filter(NGO.active == active)
        return query.order_by(NGO.created_at.desc()).offset(offset).limit(limit).all()

    @classmethod
    def approve_ngo(cls, db: Session, ngo_id: int) -> NGO:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        ngo.registration_status = RegistrationStatus.APPROVED
        ngo.active = True
        db.commit()
        db.refresh(ngo)
        return ngo

    @classmethod
    def reject_ngo(cls, db: Session, ngo_id: int) -> NGO:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        ngo.registration_status = RegistrationStatus.REJECTED
        db.commit()
        db.refresh(ngo)
        return ngo

    @classmethod
    def suspend_ngo(cls, db: Session, ngo_id: int) -> NGO:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        ngo.registration_status = RegistrationStatus.SUSPENDED
        db.commit()
        db.refresh(ngo)
        return ngo

    @classmethod
    def reactivate_ngo(cls, db: Session, ngo_id: int) -> NGO:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException(f"NGO #{ngo_id} not found")

        ngo.registration_status = RegistrationStatus.APPROVED
        ngo.active = True
        db.commit()
        db.refresh(ngo)
        return ngo

    @classmethod
    def get_leaderboard(cls, db: Session) -> LeaderboardResponse:
        items = DynamicRankingService.calculate_leaderboard(db)
        entries = [LeaderboardEntryResponse(**item) for item in items]
        return LeaderboardResponse(
            total_ngos=len(entries),
            leaderboard=entries,
        )
