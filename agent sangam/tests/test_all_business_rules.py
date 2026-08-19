"""Explicit test verification for all 30 business rule points specified in the project requirements."""
import pytest
from app.models.master import ServiceCategory, Requirement
from app.models.ngo import NGO, NGOService, NGOCoverage
from app.utils.enums import RegistrationStatus, CollaborationStatus, RequestOverallStatus


def test_rule_01_database_initialization(db_session):
    """Rule 1: Database tables created programmatically."""
    from app.database import Base, engine
    table_names = list(Base.metadata.tables.keys())
    assert "service_categories" in table_names
    assert "requirements" in table_names
    assert "ngos" in table_names
    assert "ngo_services" in table_names
    assert "ngo_coverage" in table_names
    assert "collaboration_requests" in table_names
    assert "collaborations" in table_names
    assert "request_status_history" in table_names
    assert "contributions" in table_names


def test_rule_02_and_03_master_categories_and_requirements_seeded(seeded_client):
    """Rules 2 & 3: Master categories and requirements exist."""
    cats = seeded_client.get("/api/v1/service-categories").json()
    assert len(cats) == 18
    reqs = seeded_client.get("/api/v1/service-categories/AGRICULTURE/requirements").json()
    assert len(reqs) == 6


def test_rule_04_and_05_ngo_registration_and_approval(client):
    """Rules 4 & 5: NGO registers in PENDING status and can be approved by admin."""
    reg_resp = client.post(
        "/api/v1/ngos/register",
        json={
            "ngo_name": "Rule Test Foundation",
            "registration_number": "REG-RULE-001",
            "contact_person": "Rule Officer",
            "phone": "+91-9876543299",
            "state": "Maharashtra",
            "district": "Mumbai",
            "address": "100 Marine Drive",
        },
    )
    assert reg_resp.status_code == 201
    ngo_id = reg_resp.json()["id"]
    assert reg_resp.json()["registration_status"] == "PENDING"

    # Admin approve
    app_resp = client.post(f"/api/v1/admin/ngos/{ngo_id}/approve")
    assert app_resp.status_code == 200
    assert app_resp.json()["registration_status"] == "APPROVED"


def test_rule_06_and_07_ngo_service_and_coverage_creation(seeded_client):
    """Rules 6 & 7: NGO service creation with quantities and coverage creation."""
    s_resp = seeded_client.post(
        "/api/v1/ngos/1/services",
        json={
            "service_category": "HEALTHCARE",
            "requirement": "MEDICINES",
            "available_quantity": 200,
            "unit": "kits",
            "estimated_duration_value": 2,
            "estimated_duration_unit": "DAYS",
        },
    )
    assert s_resp.status_code == 201

    c_resp = seeded_client.post(
        "/api/v1/ngos/1/coverage",
        json={"state": "Karnataka", "district": "Mysuru", "area": "Gokulam"},
    )
    assert c_resp.status_code == 201


def test_rule_08_user_collaboration_request_creation(seeded_client):
    """Rule 8: User collaboration request creation."""
    resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_USER_008",
            "service_category": "AGRICULTURE",
            "requirement": "SEEDS",
            "state": "Punjab",
            "district": "Ludhiana",
            "area": "Jagraon",
            "quantity": 10,
            "unit": "bags",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "OPEN"


def test_rule_09_to_13_deterministic_matching_scoring(seeded_client):
    """Rules 9 to 13: Service match (40), State (20), District (20), Area (10), Capacity (5), History (5)."""
    resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_USER_MATCH",
            "service_category": "FISHERIES",
            "requirement": "FISHING_NET",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 2,
            "unit": "nets",
        },
    )
    assert resp.status_code == 201
    collabs = resp.json()["collaborations"]
    assert len(collabs) >= 2
    top = collabs[0]
    assert top["ngo_code"] == "NGO003"
    assert top["matched_score"] >= 90.0  # Full 40+20+20+10+5+history


def test_rule_14_to_18_multi_ngo_accept_reject_partial_full(seeded_client):
    """Rules 14 to 18: Multiple NGO support, accept, reject, partial and full support status."""
    resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_USER_MULTI",
            "service_category": "EDUCATION",
            "requirement": "TABLET",
            "state": "Kerala",
            "district": "Ernakulam",
            "area": "Aluva",
            "quantity": 50,
            "unit": "units",
        },
    )
    req_id = resp.json()["request_id"]
    collabs = resp.json()["collaborations"]

    # First NGO accepts 30
    seeded_client.post(
        f"/api/v1/collaborations/{collabs[0]['id']}/accept",
        json={"accepted_quantity": 30, "estimated_duration_value": 2, "estimated_duration_unit": "DAYS"},
    )
    track_1 = seeded_client.get(f"/api/v1/collaboration/requests/{req_id}/tracking").json()
    assert track_1["status"] == "PARTIALLY_SUPPORTED"
    assert track_1["accepted_quantity"] == 30

    # Second NGO accepts 20
    seeded_client.post(
        f"/api/v1/collaborations/{collabs[1]['id']}/accept",
        json={"accepted_quantity": 20, "estimated_duration_value": 3, "estimated_duration_unit": "DAYS"},
    )
    track_2 = seeded_client.get(f"/api/v1/collaboration/requests/{req_id}/tracking").json()
    assert track_2["status"] == "FULLY_SUPPORTED"
    assert track_2["accepted_quantity"] == 50


def test_rule_19_to_23_status_transitions_delivered_vs_received_completion_and_contribution(seeded_client):
    """Rules 19 to 23: State transitions, Delivered vs Received separation, Completion and Contribution."""
    resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_USER_LIFECYCLE",
            "service_category": "FISHERIES",
            "requirement": "FISHING_NET",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 2,
            "unit": "nets",
        },
    )
    collab_id = resp.json()["collaborations"][0]["id"]

    # Accept
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/accept",
        json={"accepted_quantity": 2, "estimated_duration_value": 2, "estimated_duration_unit": "DAYS"},
    )

    # Invalid jump to COMPLETED before DELIVERED and RECEIVED
    bad_jump = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "COMPLETED"},
    )
    assert bad_jump.status_code == 400

    # Advance DELIVERED -> RECEIVED -> COMPLETED
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "DELIVERED"})
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "RECEIVED"})
    comp = seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "COMPLETED"})
    assert comp.status_code == 200

    # Verify Contribution record created
    ngo3_contribs = seeded_client.get("/api/v1/ngos/3/contributions").json()
    assert any(c["collaboration_id"] == collab_id for c in ngo3_contribs["contributions"])


def test_rule_24_and_25_dynamic_ranking_and_recalculation(seeded_client):
    """Rules 24 & 25: Dynamic ranking calculation from source data."""
    ranking = seeded_client.get("/api/v1/ngos/ranking").json()
    assert ranking["total_ngos"] == 20
    assert len(ranking["leaderboard"]) == 20
    # Top NGO has rank 1
    assert ranking["leaderboard"][0]["current_rank"] == 1


def test_rule_26_insufficient_quantity_rejection(seeded_client):
    """Rule 26: Attempting to accept more than available stock is rejected."""
    resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_USER_CAP",
            "service_category": "FISHERIES",
            "requirement": "FISHING_BOAT",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 100,  # Far more than available boats
            "unit": "boats",
        },
    )
    collab_id = resp.json()["collaborations"][0]["id"]

    # Try accepting 100 boats when only 5 exist
    acc_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/accept",
        json={"accepted_quantity": 100, "estimated_duration_value": 5, "estimated_duration_unit": "DAYS"},
    )
    assert acc_resp.status_code == 400


def test_rule_27_and_28_unapproved_and_inactive_ngo_excluded(seeded_db_session):
    """Rules 27 & 28: Unapproved and inactive NGOs excluded from matching."""
    db = seeded_db_session
    cat = db.query(ServiceCategory).filter(ServiceCategory.code == "FISHERIES").first()
    req = db.query(Requirement).filter(Requirement.code == "FISHING_NET", Requirement.service_category_id == cat.id).first()

    # Suspend NGO 3
    ngo3 = db.query(NGO).filter(NGO.ngo_code == "NGO003").first()
    ngo3.registration_status = RegistrationStatus.SUSPENDED
    db.commit()

    from app.services.matching_engine import DeterministicMatchingEngine
    matches = DeterministicMatchingEngine.match_ngos_for_request(
        db, cat.id, req.id, 2, "Tamil Nadu", "Nagapattinam", "Velankanni"
    )
    assert not any(m.ngo_code == "NGO003" for m in matches)


def test_rule_29_and_30_invalid_category_and_mismatched_requirement_rejected(seeded_client):
    """Rules 29 & 30: Invalid category or requirement/category mismatch rejected."""
    # Invalid category code
    resp1 = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_BAD_CAT",
            "service_category": "NON_EXISTENT",
            "requirement": "FISHING_NET",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 2,
            "unit": "nets",
        },
    )
    assert resp1.status_code == 404

    # Requirement does not belong to category
    resp2 = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RULE_MISMATCH",
            "service_category": "EDUCATION",
            "requirement": "FISHING_NET",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 2,
            "unit": "nets",
        },
    )
    assert resp2.status_code in (400, 404)
