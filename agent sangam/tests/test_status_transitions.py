import pytest


def test_status_transitions_and_history_immutability(seeded_client):
    # 1. Create and accept collaboration
    payload = {
        "external_user_id": "CITIZEN_STATUS_TEST",
        "service_category": "FISHERIES",
        "requirement": "FISHING_NET",
        "state": "Tamil Nadu",
        "district": "Nagapattinam",
        "area": "Velankanni",
        "quantity": 2,
        "unit": "nets",
    }
    create_resp = seeded_client.post("/api/v1/collaboration/requests", json=payload)
    collab_id = create_resp.json()["collaborations"][0]["id"]

    accept_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/accept",
        json={"accepted_quantity": 2, "estimated_duration_value": 3, "estimated_duration_unit": "DAYS"},
    )
    assert accept_resp.status_code == 200

    # 2. Advance to PREPARING
    prep_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "PREPARING", "remarks": "Net packaging and quality check in progress."},
    )
    assert prep_resp.status_code == 200
    assert prep_resp.json()["status"] == "PREPARING"

    # 3. Advance to DISPATCHED
    disp_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "DISPATCHED", "remarks": "Dispatched via local coastal transport."},
    )
    assert disp_resp.status_code == 200
    assert disp_resp.json()["status"] == "DISPATCHED"

    # 4. Advance to IN_TRANSIT
    trans_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "IN_TRANSIT", "remarks": "Driver en route to Velankanni harbor."},
    )
    assert trans_resp.status_code == 200

    # 5. Advance to DELIVERED
    deliv_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "DELIVERED", "remarks": "Arrived at Velankanni distribution point."},
    )
    assert deliv_resp.status_code == 200

    # 6. Verify DELIVERED cannot jump straight to COMPLETED (must be RECEIVED first)
    bad_jump_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "COMPLETED", "remarks": "Premature closure attempt."},
    )
    assert bad_jump_resp.status_code == 400

    # 7. Citizen confirms RECEIVED
    rec_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "RECEIVED", "remarks": "Citizen acknowledged receipt of 2 fishing nets."},
    )
    assert rec_resp.status_code == 200

    # 8. Mark COMPLETED
    comp_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "COMPLETED", "remarks": "Collaboration successfully finalized."},
    )
    assert comp_resp.status_code == 200
    final_data = comp_resp.json()
    assert final_data["status"] == "COMPLETED"
    assert final_data["completed_at"] is not None

    # 9. Verify invalid backward transition (COMPLETED -> ACCEPTED)
    invalid_back_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "ACCEPTED", "remarks": "Attempting invalid backward reset."},
    )
    assert invalid_back_resp.status_code == 400

    # 10. Check complete history trail preservation
    hist = final_data["status_history"]
    assert len(hist) >= 7
    hist_names = [h["status"] for h in hist]
    assert hist_names == [
        "REQUESTED",
        "ACCEPTED",
        "PREPARING",
        "DISPATCHED",
        "IN_TRANSIT",
        "DELIVERED",
        "RECEIVED",
        "COMPLETED",
    ]
