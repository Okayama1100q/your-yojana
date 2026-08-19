import pytest


def test_multi_ngo_partial_and_full_fulfillment(seeded_client):
    # Multiple NGOs support Education + LAPTOP_DESKTOP:
    # NGO001, NGO005, NGO008, NGO020
    # Let's request 60 laptops in Karnataka
    payload = {
        "external_user_id": "COMMUNITY_COLLEGE_01",
        "service_category": "EDUCATION",
        "requirement": "LAPTOP_DESKTOP",
        "requirement_details": "Need 60 laptops for tribal youth computer center.",
        "state": "Karnataka",
        "district": "Bengaluru Urban",
        "area": "Indiranagar",
        "income": 0.0,
        "quantity": 60,
        "unit": "units",
    }
    create_resp = seeded_client.post("/api/v1/collaboration/requests", json=payload)
    assert create_resp.status_code == 201
    req_data = create_resp.json()
    request_id = req_data["request_id"]
    collaborations = req_data["collaborations"]
    assert len(collaborations) >= 2

    # Identify candidate collaborations
    collab_1 = collaborations[0]
    collab_2 = collaborations[1]

    # 1. First NGO accepts 35 units
    acc1_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_1['id']}/accept",
        json={
            "accepted_quantity": 25,
            "estimated_duration_value": 3,
            "estimated_duration_unit": "DAYS",
            "response_message": "Accepting 25 laptops.",
        },
    )
    assert acc1_resp.status_code == 200

    # Verify status is PARTIALLY_SUPPORTED
    track_resp1 = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking")
    assert track_resp1.status_code == 200
    t1 = track_resp1.json()
    assert t1["status"] == "PARTIALLY_SUPPORTED"
    assert t1["accepted_quantity"] == 25
    assert t1["remaining_quantity"] == 35

    # 2. Second NGO attempts to accept 40 units (more than 35 remaining) -> should be rejected
    acc_exceed = seeded_client.post(
        f"/api/v1/collaborations/{collab_2['id']}/accept",
        json={
            "accepted_quantity": 40,
            "estimated_duration_value": 4,
            "estimated_duration_unit": "DAYS",
        },
    )
    # If 40 > 35 remaining needed or exceeds NGO capacity, should fail with 400
    assert acc_exceed.status_code == 400

    # 3. Second NGO accepts remaining 35 units (if capacity permits) or partial
    # Let's see how much collab_2 NGO can provide
    acc2_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_2['id']}/accept",
        json={
            "accepted_quantity": min(35, collab_2["requested_quantity"]),
            "estimated_duration_value": 4,
            "estimated_duration_unit": "DAYS",
            "response_message": "Accepting portion.",
        },
    )
    assert acc2_resp.status_code == 200

    # Verify tracking status
    track_resp2 = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking")
    assert track_resp2.status_code == 200
    t2 = track_resp2.json()
    assert t2["accepted_quantity"] > 25
    assert t2["remaining_quantity"] < 35
