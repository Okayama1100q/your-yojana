import pytest
from app.services.matching_engine import DeterministicMatchingEngine
from app.models.master import ServiceCategory, Requirement
from app.models.ngo import NGO, NGOService
from app.utils.enums import RegistrationStatus


def test_fisheries_matching_area_discrimination(seeded_db_session):
    db = seeded_db_session
    cat = db.query(ServiceCategory).filter(ServiceCategory.code == "FISHERIES").first()
    req = db.query(Requirement).filter(
        Requirement.service_category_id == cat.id, Requirement.code == "FISHING_NET"
    ).first()

    # Request located in Velankanni, Nagapattinam, Tamil Nadu
    matches = DeterministicMatchingEngine.match_ngos_for_request(
        db=db,
        service_category_id=cat.id,
        requirement_id=req.id,
        requested_quantity=2,
        state="Tamil Nadu",
        district="Nagapattinam",
        area="Velankanni",
    )

    assert len(matches) >= 2
    # NGO003 (Fisher Welfare Foundation) covers Velankanni area specifically
    # NGO009 (Coastal Livelihood Trust) covers Nagapattinam district but not Velankanni area specifically
    ngo003_match = next((m for m in matches if m.ngo_code == "NGO003"), None)
    ngo009_match = next((m for m in matches if m.ngo_code == "NGO009"), None)

    assert ngo003_match is not None
    assert ngo009_match is not None
    assert ngo003_match.score > ngo009_match.score
    assert matches[0].ngo_code == "NGO003"  # Ranks highest

    # Verify explainable reasons
    reasons_text = " ".join(ngo003_match.reasons)
    assert "Exact service and requirement match" in reasons_text
    assert "State match" in reasons_text
    assert "District match" in reasons_text
    assert "Area match" in reasons_text


def test_unapproved_and_inactive_ngos_excluded(seeded_db_session):
    db = seeded_db_session
    cat = db.query(ServiceCategory).filter(ServiceCategory.code == "FISHERIES").first()
    req = db.query(Requirement).filter(
        Requirement.service_category_id == cat.id, Requirement.code == "FISHING_NET"
    ).first()

    # Mark NGO003 as SUSPENDED
    ngo003 = db.query(NGO).filter(NGO.ngo_code == "NGO003").first()
    ngo003.registration_status = RegistrationStatus.SUSPENDED
    db.commit()

    matches = DeterministicMatchingEngine.match_ngos_for_request(
        db=db,
        service_category_id=cat.id,
        requirement_id=req.id,
        requested_quantity=2,
        state="Tamil Nadu",
        district="Nagapattinam",
        area="Velankanni",
    )

    ngo_codes = [m.ngo_code for m in matches]
    assert "NGO003" not in ngo_codes


def test_zero_capacity_ngo_excluded(seeded_db_session):
    db = seeded_db_session
    cat = db.query(ServiceCategory).filter(ServiceCategory.code == "FISHERIES").first()
    req = db.query(Requirement).filter(
        Requirement.service_category_id == cat.id, Requirement.code == "FISHING_NET"
    ).first()

    # Set NGO009 available quantity to 0
    ngo009 = db.query(NGO).filter(NGO.ngo_code == "NGO009").first()
    serv = db.query(NGOService).filter(
        NGOService.ngo_id == ngo009.id,
        NGOService.requirement_id == req.id,
    ).first()
    serv.available_quantity = 0
    db.commit()

    matches = DeterministicMatchingEngine.match_ngos_for_request(
        db=db,
        service_category_id=cat.id,
        requirement_id=req.id,
        requested_quantity=2,
        state="Tamil Nadu",
        district="Nagapattinam",
        area="Velankanni",
    )

    ngo_codes = [m.ngo_code for m in matches]
    assert "NGO009" not in ngo_codes


def test_interstate_ngo_not_excluded_by_default(seeded_db_session):
    db = seeded_db_session
    # Request in a state with no local NGO for fishing nets (e.g. Goa)
    cat = db.query(ServiceCategory).filter(ServiceCategory.code == "FISHERIES").first()
    req = db.query(Requirement).filter(
        Requirement.service_category_id == cat.id, Requirement.code == "FISHING_NET"
    ).first()

    matches = DeterministicMatchingEngine.match_ngos_for_request(
        db=db,
        service_category_id=cat.id,
        requirement_id=req.id,
        requested_quantity=2,
        state="Goa",
        district="South Goa",
        area="Margao",
    )

    # Interstate NGOs with fishing nets (NGO003, NGO009) should still match as candidates
    assert len(matches) >= 2
    for m in matches:
        assert m.score >= 40.0  # Base service match 40 pts + capacity + history
