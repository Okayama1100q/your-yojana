from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.ngo import NGO, NGOService, NGOCoverage
from app.models.master import ServiceCategory, Requirement
from app.schemas.ngo import NGORegistrationRequest, NGOProfileResponse, NGOBasicResponse, NGOStatsSummary
from app.schemas.service_coverage import NGOServiceCreate, NGOServiceResponse, NGOCoverageCreate, NGOCoverageResponse
from app.utils.enums import RegistrationStatus, EstimatedDurationUnit
from app.utils.exceptions import (
    EntityNotFoundException,
    DuplicateEntityException,
    BusinessRuleValidationException,
)
from app.services.master_service import MasterDataService


class NGOServiceLayer:
    @staticmethod
    def generate_ngo_code(db: Session) -> str:
        """Generate the next sequential NGO code like NGO021, etc."""
        count = db.query(func.count(NGO.id)).scalar() or 0
        candidate_num = count + 1
        while True:
            code = f"NGO{candidate_num:03d}"
            existing = db.query(NGO).filter(NGO.ngo_code == code).first()
            if not existing:
                return code
            candidate_num += 1

    @staticmethod
    def register_ngo(db: Session, data: NGORegistrationRequest) -> NGO:
        # Check if registration number already registered
        existing = db.query(NGO).filter(
            func.lower(NGO.registration_number) == data.registration_number.strip().lower()
        ).first()
        if existing:
            raise DuplicateEntityException(
                f"An NGO with registration number '{data.registration_number}' already exists."
            )

        ngo_code = NGOServiceLayer.generate_ngo_code(db)
        ngo = NGO(
            ngo_code=ngo_code,
            ngo_name=data.ngo_name.strip(),
            registration_number=data.registration_number.strip(),
            contact_person=data.contact_person.strip(),
            phone=data.phone.strip(),
            state=data.state.strip(),
            district=data.district.strip(),
            address=data.address.strip(),
            description=data.description.strip() if data.description else None,
            registration_status=RegistrationStatus.PENDING,
            active=True,
        )
        db.add(ngo)
        db.commit()
        db.refresh(ngo)
        return ngo

    @staticmethod
    def get_ngo_by_id(db: Session, ngo_id: int) -> NGO:
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException("NGO", ngo_id)
        return ngo

    @staticmethod
    def get_ngo_by_code(db: Session, ngo_code: str) -> NGO:
        ngo = db.query(NGO).filter(NGO.ngo_code == ngo_code.strip().upper()).first()
        if not ngo:
            raise EntityNotFoundException("NGO", ngo_code)
        return ngo

    @staticmethod
    def list_ngos(
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
        return query.order_by(NGO.id.asc()).offset(offset).limit(limit).all()

    @staticmethod
    def update_ngo_status(
        db: Session,
        ngo_id: int,
        status: RegistrationStatus,
        active: Optional[bool] = None,
    ) -> NGO:
        ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)
        ngo.registration_status = status
        if active is not None:
            ngo.active = active
        db.commit()
        db.refresh(ngo)
        return ngo

    @staticmethod
    def add_service(db: Session, ngo_id: int, data: NGOServiceCreate) -> NGOService:
        ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)

        # Validate category and requirement
        category = MasterDataService.get_category_by_code(db, data.service_category)
        requirement = MasterDataService.get_requirement_by_code(
            db, data.service_category, data.requirement
        )

        if requirement.service_category_id != category.id:
            raise BusinessRuleValidationException(
                f"Requirement '{data.requirement}' does not belong to category '{data.service_category}'."
            )

        # Check if service already registered for this NGO
        existing = db.query(NGOService).filter(
            NGOService.ngo_id == ngo.id,
            NGOService.service_category_id == category.id,
            NGOService.requirement_id == requirement.id,
        ).first()

        if existing:
            # Update existing service quantity and duration
            existing.available_quantity = data.available_quantity
            existing.unit = data.unit
            existing.estimated_duration_value = data.estimated_duration_value
            existing.estimated_duration_unit = data.estimated_duration_unit
            existing.active = True
            db.commit()
            db.refresh(existing)
            return existing

        service = NGOService(
            ngo_id=ngo.id,
            service_category_id=category.id,
            requirement_id=requirement.id,
            available_quantity=data.available_quantity,
            unit=data.unit,
            estimated_duration_value=data.estimated_duration_value,
            estimated_duration_unit=data.estimated_duration_unit,
            active=True,
        )
        db.add(service)
        db.commit()
        db.refresh(service)
        return service

    @staticmethod
    def get_services(db: Session, ngo_id: int) -> List[NGOServiceResponse]:
        ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)
        services = db.query(NGOService).filter(
            NGOService.ngo_id == ngo.id,
            NGOService.active == True,
        ).all()

        results = []
        for s in services:
            dur_text = f"{s.estimated_duration_value} {s.estimated_duration_unit.value.lower()}"
            results.append(
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
                    estimated_display=dur_text,
                    active=s.active,
                    created_at=s.created_at,
                    updated_at=s.updated_at,
                )
            )
        return results

    @staticmethod
    def add_coverage(db: Session, ngo_id: int, data: NGOCoverageCreate) -> NGOCoverage:
        ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)

        # Check existing coverage record
        area_clean = data.area.strip() if data.area else None
        existing = db.query(NGOCoverage).filter(
            NGOCoverage.ngo_id == ngo.id,
            func.lower(NGOCoverage.state) == data.state.strip().lower(),
            func.lower(NGOCoverage.district) == data.district.strip().lower(),
            func.lower(func.coalesce(NGOCoverage.area, "")) == (area_clean.lower() if area_clean else ""),
        ).first()

        if existing:
            existing.active = True
            db.commit()
            db.refresh(existing)
            return existing

        cov = NGOCoverage(
            ngo_id=ngo.id,
            state=data.state.strip(),
            district=data.district.strip(),
            area=area_clean,
            active=True,
        )
        db.add(cov)
        db.commit()
        db.refresh(cov)
        return cov

    @staticmethod
    def get_coverage(db: Session, ngo_id: int) -> List[NGOCoverage]:
        ngo = NGOServiceLayer.get_ngo_by_id(db, ngo_id)
        return db.query(NGOCoverage).filter(
            NGOCoverage.ngo_id == ngo.id,
            NGOCoverage.active == True,
        ).all()
