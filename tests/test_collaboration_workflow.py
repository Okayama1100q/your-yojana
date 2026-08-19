import pytest


def test_user_request_creation_and_ngo_accept_flow(seeded_client):
    # 1. Citizen creates collaboration request for 2 fishing nets
    request_payload = {
        "external_user_id": "CITIZEN_TN_001",
        "service_category": "FISHERIES",
        "requirement": "FISHING_NET",
        "requirement_details": "Need two nets suitable for small-scale coastal fishing.",
        "state": "Tamil Nadu",
        "district": "Nagapattinam",
        "area": "Velankanni",
        "income": 80000.0,
        "quantity": 2,
        "unit": "nets",
    }
    create_resp = seeded_client.post("/api/v1/collaboration/requests", json=request_payload)
    assert create_resp.status_code == 201
    req_data = create_resp.json()
    assert req_data["request_id"] > 0
    assert req_data["status"] == "OPEN"
    assert len(req_data["collaborations"]) >= 2
    assert req_data["remaining_quantity"] == 2
    assert req_data["accepted_quantity"] == 0

    request_id = req_data["request_id"]
    # Check top candidate is NGO003
    top_collab = req_data["collaborations"][0]
    assert top_collab["ngo_code"] == "NGO003"
    collab_id = top_collab["id"]

    # 2. NGO003 views pending requests
    pending_resp = seeded_client.get("/api/v1/ngos/3/requests/pending")
    assert pending_resp.status_code == 200
    pending_list = pending_resp.json()
    assert any(c["id"] == collab_id for c in pending_list)

    # 3. NGO003 accepts the 2 nets
    accept_payload = {
        "accepted_quantity": 2,
        "estimated_duration_value": 5,
        "estimated_duration_unit": "DAYS",
        "response_message": "We have high quality coastal nylon nets ready for dispatch.",
    }
    accept_resp = seeded_client.post(f"/api/v1/collaborations/{collab_id}/accept", json=accept_payload)
    assert accept_resp.status_code == 200
    acc_data = accept_resp.json()
    assert acc_data["status"] == "ACCEPTED"
    assert acc_data["accepted_quantity"] == 2
    assert acc_data["estimated_display"] == "5 days"

    # 4. Check user tracking timeline
    tracking_resp = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking")
    assert tracking_resp.status_code == 200
    track_data = tracking_resp.json()
    assert track_data["status"] == "FULLY_SUPPORTED"
    assert track_data["accepted_quantity"] == 2
    assert track_data["remaining_quantity"] == 0

    # Verify history is present in collaboration details
    collab_entry = next(c for c in track_data["collaborations"] if c["id"] == collab_id)
    assert len(collab_entry["status_history"]) >= 2
    history_statuses = [h["status"] for h in collab_entry["status_history"]]
    assert "REQUESTED" in history_statuses
    assert "ACCEPTED" in history_statuses


def test_ngo_reject_flow(seeded_client):
    request_payload = {
        "external_user_id": "CITIZEN_TN_002",
        "service_category": "FISHERIES",
        "requirement": "FISHING_NET",
        "state": "Tamil Nadu",
        "district": "Nagapattinam",
        "area": "Velankanni",
        "quantity": 5,
        "unit": "nets",
    }
    create_resp = seeded_client.post("/api/v1/collaboration/requests", json=request_payload)
    assert create_resp.status_code == 201
    collab_id = create_resp.json()["collaborations"][0]["id"]

    # Reject
    reject_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/reject",
        json={"rejection_reason": "Stock committed to another emergency relief program."},
    )
    assert reject_resp.status_code == 200
    data = reject_resp.json()
    assert data["status"] == "REJECTED"
    assert data["rejection_reason"] == "Stock committed to another emergency relief program."
