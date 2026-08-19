from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.core.models.master import ServiceCategory, Requirement
from app.core.models.ngo import NGO, NGOService, NGOCoverage
from app.core.models.collaboration import CollaborationRequest, Collaboration, RequestStatusHistory
from app.core.models.contribution import Contribution
from app.core.enums import RegistrationStatus, EstimatedDurationUnit, CollaborationStatus, RequestOverallStatus
from app.core.seed.master_data import MASTER_CATEGORIES, MASTER_REQUIREMENTS
from app.core.seed.seed_ngos import SEED_NGOS


def seed_master_data(db: Session):
    for cat_data in MASTER_CATEGORIES:
        cat = db.query(ServiceCategory).filter(ServiceCategory.code == cat_data["code"]).first()
        if not cat:
            cat = ServiceCategory(
                code=cat_data["code"],
                name=cat_data["name"],
                active=True,
            )
            db.add(cat)
            db.flush()

        # Seed requirements for this category
        reqs_list = MASTER_REQUIREMENTS.get(cat_data["code"], [])
        for req_data in reqs_list:
            req = (
                db.query(Requirement)
                .filter(Requirement.service_category_id == cat.id, Requirement.code == req_data["code"])
                .first()
            )
            if not req:
                req = Requirement(
                    service_category_id=cat.id,
                    code=req_data["code"],
                    name=req_data["name"],
                    active=True,
                )
                db.add(req)

    db.commit()


def seed_demo_ngos(db: Session):
    for ngo_data in SEED_NGOS:
        existing_ngo = db.query(NGO).filter(NGO.ngo_code == ngo_data["ngo_code"]).first()
        if existing_ngo:
            continue

        ngo = NGO(
            ngo_code=ngo_data["ngo_code"],
            ngo_name=ngo_data["ngo_name"],
            registration_number=ngo_data["registration_number"],
            contact_person=ngo_data["contact_person"],
            phone=ngo_data["phone"],
            state=ngo_data["state"],
            district=ngo_data["district"],
            address=ngo_data["address"],
            description=ngo_data.get("description"),
            registration_status=RegistrationStatus(ngo_data["registration_status"]),
            active=True,
        )
        db.add(ngo)
        db.flush()

        # Seed NGO Services
        for s_data in ngo_data.get("services", []):
            cat = db.query(ServiceCategory).filter(ServiceCategory.code == s_data["category"]).first()
            if not cat:
                continue
            req = (
                db.query(Requirement)
                .filter(Requirement.service_category_id == cat.id, Requirement.code == s_data["req"])
                .first()
            )
            if not req:
                continue

            ngo_service = NGOService(
                ngo_id=ngo.id,
                service_category_id=cat.id,
                requirement_id=req.id,
                available_quantity=s_data["qty"],
                unit=s_data["unit"],
                estimated_duration_value=s_data["dur_val"],
                estimated_duration_unit=EstimatedDurationUnit(s_data["dur_unit"]),
                active=True,
            )
            db.add(ngo_service)

        # Seed NGO Coverage
        for cov_data in ngo_data.get("coverage", []):
            ngo_cov = NGOCoverage(
                ngo_id=ngo.id,
                state=cov_data["state"],
                district=cov_data["district"],
                area=cov_data.get("area"),
                active=True,
            )
            db.add(ngo_cov)

        db.flush()

        # Seed Historical Completed Contributions
        for hist in ngo_data.get("historical_contributions", []):
            cat = db.query(ServiceCategory).filter(ServiceCategory.code == hist["category"]).first()
            if not cat:
                continue
            req = (
                db.query(Requirement)
                .filter(Requirement.service_category_id == cat.id, Requirement.code == hist["req"])
                .first()
            )
            if not req:
                continue

            # Create a mock completed collaboration request
            collab_req = CollaborationRequest(
                external_user_id=f"SEED_USER_{ngo.ngo_code}_{req.code}",
                service_category_id=cat.id,
                requirement_id=req.id,
                state=ngo.state,
                district=ngo.district,
                area="Main Area",
                quantity=hist["qty"],
                unit=hist["unit"],
                status=RequestOverallStatus.CLOSED,
            )
            db.add(collab_req)
            db.flush()

            days_ago = hist.get("days_ago", 10)
            completed_time = datetime.now(timezone.utc) - timedelta(days=days_ago)

            collab = Collaboration(
                request_id=collab_req.id,
                ngo_id=ngo.id,
                status=CollaborationStatus.COMPLETED,
                matched_score=95.0,
                matched_reasons='["Seed historical completed assistance"]',
                requested_quantity=hist["qty"],
                accepted_quantity=hist["qty"],
                estimated_duration_value=3,
                estimated_duration_unit=EstimatedDurationUnit.DAYS,
                accepted_at=completed_time - timedelta(days=2),
                completed_at=completed_time,
            )
            db.add(collab)
            db.flush()

            # Status history
            history_entry = RequestStatusHistory(
                collaboration_id=collab.id,
                status=CollaborationStatus.COMPLETED,
                remarks="Successfully fulfilled historical assistance request.",
                created_at=completed_time,
            )
            db.add(history_entry)

            # Verified contribution
            contrib = Contribution(
                ngo_id=ngo.id,
                collaboration_id=collab.id,
                requirement_id=req.id,
                quantity_provided=hist["qty"],
                unit=hist["unit"],
                beneficiaries_helped=hist["beneficiaries"],
                completed_on_time=hist["on_time"],
                completed_at=completed_time,
            )
            db.add(contrib)

    db.commit()


def run_seed_all(db: Session):
    seed_master_data(db)
    seed_demo_ngos(db)
