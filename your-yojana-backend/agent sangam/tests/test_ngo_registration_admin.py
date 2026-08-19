import pytest


def test_ngo_registration_lifecycle(client):
    # 1. Register NGO
    payload = {
        "ngo_name": "Hope Uplift Foundation",
        "registration_number": "REG-TEST-999",
        "contact_person": "Pooja Verma",
        "phone": "+91-9876500000",
        "state": "Maharashtra",
        "district": "Nagpur",
        "address": "12 Civil Lines, Nagpur",
        "description": "Educational and livelihood support.",
    }
    resp = client.post("/api/v1/ngos/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ngo_code"].startswith("NGO")
    assert data["registration_status"] == "PENDING"
    assert data["active"] is True
    ngo_id = data["id"]

    # 2. Duplicate registration number check
    dup_resp = client.post("/api/v1/ngos/register", json=payload)
    assert dup_resp.status_code == 409

    # 3. Admin list NGOs in PENDING status
    list_resp = client.get("/api/v1/admin/ngos?status=PENDING")
    assert list_resp.status_code == 200
    pending_ngos = list_resp.json()
    assert any(n["id"] == ngo_id for n in pending_ngos)

    # 4. Admin approves NGO
    appr_resp = client.post(f"/api/v1/admin/ngos/{ngo_id}/approve")
    assert appr_resp.status_code == 200
    assert appr_resp.json()["registration_status"] == "APPROVED"

    # 5. Admin suspends NGO
    susp_resp = client.post(f"/api/v1/admin/ngos/{ngo_id}/suspend")
    assert susp_resp.status_code == 200
    assert susp_resp.json()["registration_status"] == "SUSPENDED"

    # 6. Admin reactivates NGO
    react_resp = client.post(f"/api/v1/admin/ngos/{ngo_id}/reactivate")
    assert react_resp.status_code == 200
    assert react_resp.json()["registration_status"] == "APPROVED"

    # 7. Admin rejects NGO
    rej_resp = client.post(f"/api/v1/admin/ngos/{ngo_id}/reject")
    assert rej_resp.status_code == 200
    assert rej_resp.json()["registration_status"] == "REJECTED"


def test_get_ngo_profile(seeded_client):
    # Retrieve NGO 3 (Fisher Welfare Foundation)
    resp = seeded_client.get("/api/v1/ngos/3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["basic_details"]["ngo_code"] == "NGO003"
    assert "Fisher Welfare Foundation" in data["basic_details"]["ngo_name"]
    assert len(data["services"]) > 0
    assert len(data["coverage"]) > 0
    assert data["performance"]["completed_requests"] > 0
    assert data["performance"]["current_rank"] is not None
