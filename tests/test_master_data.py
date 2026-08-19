import pytest
from app.seed.master_data import MASTER_CATEGORIES, MASTER_REQUIREMENTS


def test_get_service_categories_empty(client):
    resp = client.get("/api/v1/service-categories")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_service_categories_seeded(seeded_client):
    resp = seeded_client.get("/api/v1/service-categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) == 18

    # Verify category codes
    category_codes = {c["code"] for c in cats}
    for expected in MASTER_CATEGORIES:
        assert expected["code"] in category_codes


def test_get_category_requirements(seeded_client):
    # Test Fisheries requirements
    resp = seeded_client.get("/api/v1/service-categories/FISHERIES/requirements")
    assert resp.status_code == 200
    reqs = resp.json()
    assert len(reqs) == 6
    req_codes = {r["code"] for r in reqs}
    assert "FISHING_NET" in req_codes
    assert "FISHING_BOAT" in req_codes
    assert "BOAT_ENGINE" in req_codes
    assert "FISHING_GEAR" in req_codes
    assert "SAFETY_EQUIPMENT" in req_codes
    assert "FISH_STORAGE_EQUIPMENT" in req_codes

    # Test Education requirements
    resp = seeded_client.get("/api/v1/service-categories/EDUCATION/requirements")
    assert resp.status_code == 200
    reqs = resp.json()
    assert len(reqs) == 6
    req_codes = {r["code"] for r in reqs}
    assert "LAPTOP_DESKTOP" in req_codes
    assert "TABLET" in req_codes


def test_get_category_requirements_invalid_category(seeded_client):
    resp = seeded_client.get("/api/v1/service-categories/NON_EXISTENT_CATEGORY/requirements")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_all_18_master_categories_have_requirements(seeded_client):
    for cat in MASTER_CATEGORIES:
        cat_code = cat["code"]
        resp = seeded_client.get(f"/api/v1/service-categories/{cat_code}/requirements")
        assert resp.status_code == 200
        reqs = resp.json()
        assert len(reqs) >= 6
