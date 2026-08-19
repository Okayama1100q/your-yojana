from datetime import datetime, timezone, timedelta
import random
from sqlalchemy.orm import Session

from app.models.master import ServiceCategory, Requirement
from app.models.ngo import NGO, NGOService, NGOCoverage
from app.models.collaboration import CollaborationRequest, Collaboration, RequestStatusHistory
from app.models.contribution import Contribution
from app.utils.enums import RegistrationStatus, CollaborationStatus, RequestOverallStatus, EstimatedDurationUnit
from app.seed.master_data import MASTER_CATEGORIES, MASTER_REQUIREMENTS
from app.seed.seed_ngos import SEED_NGOS


def seed_master_data(db: Session) -> dict[str, dict[str, Requirement]]:
    """Seed all 18 Master Service Categories and their 108 Master Requirements."""
    category_map: dict[str, ServiceCategory] = {}
    requirement_map: dict[str, dict[str, Requirement]] = {}

    # Seed or fetch categories
    for cat_data in MASTER_CATEGORIES:
        category = db.query(ServiceCategory).filter(ServiceCategory.code == cat_data["code"]).first()
        if not category:
            category = ServiceCategory(
                code=cat_data["code"],
                name=cat_data["name"],
                active=True,
            )
            db.add(category)
            db.flush()
        category_map[cat_data["code"]] = category
        requirement_map[cat_data["code"]] = {}

    # Seed or fetch requirements
    for cat_code, reqs in MASTER_REQUIREMENTS.items():
        cat_obj = category_map[cat_code]
        for req_data in reqs:
            req = db.query(Requirement).filter(
                Requirement.service_category_id == cat_obj.id,
                Requirement.code == req_data["code"],
            ).first()
            if not req:
                req = Requirement(
                    code=req_data["code"],
                    name=req_data["name"],
                    service_category_id=cat_obj.id,
                    active=True,
                )
                db.add(req)
                db.flush()
            requirement_map[cat_code][req_data["code"]] = req

    db.commit()
    return requirement_map


def seed_all_ngos(db: Session, requirement_map: dict[str, dict[str, Requirement]]) -> list[NGO]:
    """Seed 20 demo NGOs with services, coverage, and historical completed contributions."""
    now = datetime.now(timezone.utc)
    seeded_ngos = []

    for ngo_data in SEED_NGOS:
        ngo = db.query(NGO).filter(NGO.ngo_code == ngo_data["ngo_code"]).first()
        if not ngo:
            ngo = NGO(
                ngo_code=ngo_data["ngo_code"],
                ngo_name=ngo_data["ngo_name"],
                registration_number=ngo_data["registration_number"],
                contact_person=ngo_data["contact_person"],
                phone=ngo_data["phone"],
                state=ngo_data["state"],
                district=ngo_data["district"],
                address=ngo_data["address"],
                description=ngo_data["description"],
                registration_status=RegistrationStatus(ngo_data["registration_status"]),
                active=True,
            )
            db.add(ngo)
            db.flush()

            # Seed Services
            for s_data in ngo_data.get("services", []):
                cat_code = s_data["category"]
                req_code = s_data["requirement"]
                req_obj = requirement_map[cat_code][req_code]
                cat_id = req_obj.service_category_id

                service = NGOService(
                    ngo_id=ngo.id,
                    service_category_id=cat_id,
                    requirement_id=req_obj.id,
                    available_quantity=s_data["quantity"],
                    unit=s_data["unit"],
                    estimated_duration_value=s_data.get("duration_val", 2),
                    estimated_duration_unit=EstimatedDurationUnit(s_data.get("duration_unit", "DAYS")),
                    active=True,
                )
                db.add(service)

            # Seed Coverage
            for cov in ngo_data.get("coverage", []):
                coverage = NGOCoverage(
                    ngo_id=ngo.id,
                    state=cov["state"],
                    district=cov["district"],
                    area=cov.get("area"),
                    active=True,
                )
                db.add(coverage)

            # Seed Historical Completed Contributions
            history = ngo_data.get("history_profile", {})
            completed_count = history.get("completed_count", 20)
            total_ben = history.get("beneficiaries_base", 100)
            total_qty = history.get("quantity_base", 150)
            on_time_pct = history.get("on_time_pct", 95.0)
            req_code = history.get("req_code", "LAPTOP_DESKTOP")

            # Find requirement object for history
            target_req = None
            for cat_code, reqs in requirement_map.items():
                if req_code in reqs:
                    target_req = reqs[req_code]
                    break
            if not target_req:
                first_cat = list(requirement_map.keys())[0]
                target_req = list(requirement_map[first_cat].values())[0]

            on_time_count = int(round(completed_count * (on_time_pct / 100.0)))
            avg_ben = max(1, total_ben // completed_count)
            avg_qty = max(1, total_qty // completed_count)

            for i in range(completed_count):
                is_on_time = i < on_time_count
                days_ago = (completed_count - i) * 2 + 5
                comp_date = now - timedelta(days=days_ago)
                req_date = comp_date - timedelta(days=5)

                # Seed mock historical request
                hist_req = CollaborationRequest(
                    external_user_id=f"HIST_USER_{ngo.ngo_code}_{i+1:03d}",
                    service_category_id=target_req.service_category_id,
                    requirement_id=target_req.id,
                    requirement_details="Historical fulfilled requirement record.",
                    state=ngo.state,
                    district=ngo.district,
                    area=ngo.district,
                    income=50000.0,
                    quantity=avg_qty,
                    unit="units",
                    status=RequestOverallStatus.FULLY_SUPPORTED,
                    created_at=req_date,
                    updated_at=comp_date,
                )
                db.add(hist_req)
                db.flush()

                # Seed collaboration
                collab = Collaboration(
                    request_id=hist_req.id,
                    ngo_id=ngo.id,
                    status=CollaborationStatus.COMPLETED,
                    matched_score=95.0,
                    matched_reasons='["Exact service and requirement match", "Exact state match", "Exact district match"]',
                    requested_quantity=avg_qty,
                    accepted_quantity=avg_qty,
                    estimated_duration_value=3,
                    estimated_duration_unit=EstimatedDurationUnit.DAYS,
                    response_message="Historical collaboration completed successfully.",
                    accepted_at=req_date + timedelta(hours=2),
                    completed_at=comp_date,
                    created_at=req_date,
                    updated_at=comp_date,
                )
                db.add(collab)
                db.flush()

                # Seed status history
                history_steps = [
                    (CollaborationStatus.REQUESTED, req_date, "Matched and sent to NGO"),
                    (CollaborationStatus.ACCEPTED, req_date + timedelta(hours=2), "Accepted by NGO"),
                    (CollaborationStatus.PREPARING, req_date + timedelta(days=1), "In preparation"),
                    (CollaborationStatus.DELIVERED, comp_date - timedelta(hours=4), "Delivered to user locality"),
                    (CollaborationStatus.RECEIVED, comp_date - timedelta(hours=1), "User confirmed receipt"),
                    (CollaborationStatus.COMPLETED, comp_date, "Finalized and verified"),
                ]
                for st, dt, rem in history_steps:
                    hist_entry = RequestStatusHistory(
                        collaboration_id=collab.id,
                        status=st,
                        remarks=rem,
                        created_at=dt,
                    )
                    db.add(hist_entry)

                # Seed Contribution
                contrib = Contribution(
                    ngo_id=ngo.id,
                    collaboration_id=collab.id,
                    requirement_id=target_req.id,
                    quantity_provided=avg_qty,
                    unit="units",
                    beneficiaries_helped=avg_ben,
                    completed_on_time=is_on_time,
                    completed_at=comp_date,
                    created_at=comp_date,
                )
                db.add(contrib)

            db.commit()
        seeded_ngos.append(ngo)

    return seeded_ngos


def run_seed_all(db: Session) -> dict:
    """Executes full database seed."""
    req_map = seed_master_data(db)
    ngos = seed_all_ngos(db, req_map)
    return {
        "categories_count": len(MASTER_CATEGORIES),
        "requirements_count": sum(len(r) for r in MASTER_REQUIREMENTS.values()),
        "ngos_count": len(ngos),
    }
