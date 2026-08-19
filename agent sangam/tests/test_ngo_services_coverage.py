import pytest


def test_ngo_service_validation_seeded(seeded_client):
    # NGO 1
    # 1. Add valid service
    payload = {
        "service_category": "EDUCATION",
        "requirement": "TABLET",
        "available_quantity": 50,
        "unit": "tablets",
        "estimated_duration_value": 2,
        "estimated_duration_unit": "DAYS",
    }
    resp = seeded_client.post("/api/v1/ngos/1/services", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["available_quantity"] == 50
    assert data["requirement_code"] == "TABLET"

    # 2. Invalid category
    bad_cat_payload = {
        "service_category": "INVALID_CATEGORY",
        "requirement": "TABLET",
        "available_quantity": 10,
        "unit": "tablets",
    }
    resp_bad_cat = seeded_client.post("/api/v1/ngos/1/services", json=bad_cat_payload)
    assert resp_bad_cat.status_code == 404

    # 3. Requirement not belonging to category (e.g. FISHING_NET under EDUCATION)
    mismatch_payload = {
        "service_category": "EDUCATION",
        "requirement": "FISHING_NET",
        "available_quantity": 10,
        "unit": "nets",
    }
    resp_mismatch = seeded_client.post("/api/v1/ngos/1/services", json=mismatch_payload)
    assert resp_mismatch.status_code in (400, 404)

    # 4. Add and fetch coverage
    cov_payload = {
        "state": "Karnataka",
        "district": "Bengaluru Rural",
        "area": "Devanahalli",
    }
    cov_resp = seeded_client.post("/api/v1/ngos/1/coverage", json=cov_payload)
    assert cov_resp.status_code == 201

    cov_list_resp = seeded_client.get("/api/v1/ngos/1/coverage")
    assert cov_list_resp.status_code == 200
    assert any(c["district"] == "Bengaluru Rural" for c in cov_list_resp.json())
