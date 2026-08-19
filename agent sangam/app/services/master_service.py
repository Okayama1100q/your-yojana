from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.master import ServiceCategory, Requirement
from app.utils.exceptions import EntityNotFoundException


class MasterDataService:
    @staticmethod
    def get_all_categories(db: Session, active_only: bool = True) -> List[ServiceCategory]:
        query = db.query(ServiceCategory)
        if active_only:
            query = query.filter(ServiceCategory.active == True)
        return query.order_by(ServiceCategory.name.asc()).all()

    @staticmethod
    def get_category_by_code(db: Session, code: str) -> ServiceCategory:
        category = db.query(ServiceCategory).filter(
            func.upper(ServiceCategory.code) == code.strip().upper()
        ).first()
        if not category:
            raise EntityNotFoundException("ServiceCategory", code)
        return category

    @staticmethod
    def get_requirements_by_category_code(
        db: Session, category_code: str, active_only: bool = True
    ) -> List[Requirement]:
        category = MasterDataService.get_category_by_code(db, category_code)
        query = db.query(Requirement).filter(Requirement.service_category_id == category.id)
        if active_only:
            query = query.filter(Requirement.active == True)
        return query.order_by(Requirement.name.asc()).all()

    @staticmethod
    def get_requirement_by_code(
        db: Session, category_code: str, requirement_code: str
    ) -> Requirement:
        category = MasterDataService.get_category_by_code(db, category_code)
        requirement = db.query(Requirement).filter(
            Requirement.service_category_id == category.id,
            func.upper(Requirement.code) == requirement_code.strip().upper(),
        ).first()
        if not requirement:
            raise EntityNotFoundException(
                "Requirement", f"{requirement_code} under {category_code}"
            )
        return requirement
