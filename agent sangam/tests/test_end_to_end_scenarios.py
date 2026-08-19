import pytest


def test_section_34_complete_fisheries_e2e_flow(seeded_client):
    """
    End-to-End test for Section 34 specification:
    Exact Fisheries scenario with NGO003 & NGO009, area preference, status progression,
    inventory decrement, contribution recording, and user timeline retrieval.
    """
    # STEP 1: Check initial available nets for NGO003
    ngo3_serv_initial = seeded_client.get("/api/v1/ngos/3/services").json()
    net_service_initial = next(s for s in ngo3_serv_initial if s["requirement_code"] == "FISHING_NET")
    initial_available_qty = net_service_initial["available_quantity"]
    assert initial_available_qty == 50

    # STEP 2: User submits requirement
    req_input = {
        "external_user_id": "USER123",
        "service_category": "FISHERIES",
        "requirement": "FISHING_NET",
        "requirement_details": "Need 2 fishing nets for small-scale fishing.",
        "state": "Tamil Nadu",
        "district": "Nagapattinam",
        "area": "Velankanni",
        "income": 80000.0,
        "quantity": 2,
        "unit": "nets",
    }
    create_resp = seeded_client.post("/api/v1/collaboration/requests", json=req_input)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    request_id = created_data["request_id"]

    # STEP 3 & 4: Matching engine finds NGO003 and NGO009; NGO003 ranks higher (covers exact area)
    candidates = created_data["collaborations"]
    candidate_codes = [c["ngo_code"] for c in candidates]
    assert "NGO003" in candidate_codes
    assert "NGO009" in candidate_codes

    top_candidate = candidates[0]
    assert top_candidate["ngo_code"] == "NGO003"
    assert top_candidate["matched_score"] > candidates[1]["matched_score"]
    collab_id = top_candidate["id"]

    # STEP 5 & 6: NGO003 accepts 2 nets with estimated duration 5 DAYS
    accept_payload = {
        "accepted_quantity": 2,
        "estimated_duration_value": 5,
        "estimated_duration_unit": "DAYS",
        "response_message": "Approved for local fishing cooperative dispatch.",
    }
    accept_resp = seeded_client.post(f"/api/v1/collaborations/{collab_id}/accept", json=accept_payload)
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "ACCEPTED"
    assert accept_resp.json()["estimated_display"] == "5 days"

    # STEP 7: Advance through all statuses
    # ACCEPTED -> PREPARING -> DISPATCHED -> IN_TRANSIT -> DELIVERED -> RECEIVED -> COMPLETED
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "PREPARING", "remarks": "Rigging nets."},
    )
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "DISPATCHED", "remarks": "Vehicle loaded."},
    )
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "IN_TRANSIT", "remarks": "En route to Velankanni."},
    )
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "DELIVERED", "remarks": "Delivered to harbor gate."},
    )
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "RECEIVED", "remarks": "User confirmed receipt in person."},
    )
    comp_resp = seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/status",
        json={"status": "COMPLETED", "remarks": "Handover verified and closed."},
    )
    assert comp_resp.status_code == 200

    # STEP 8, 9, 10: Contribution created, stats updated, ranking recalculated
    contrib_resp = seeded_client.get("/api/v1/ngos/3/contributions")
    assert contrib_resp.status_code == 200
    contribs = contrib_resp.json()["contributions"]
    assert any(c["collaboration_id"] == collab_id for c in contribs)

    rank_resp = seeded_client.get("/api/v1/ngos/3/ranking")
    assert rank_resp.status_code == 200
    assert rank_resp.json()["ranking_score"] > 0

    # STEP 11: Verify NGO003 available nets decreased from 50 to 48
    ngo3_serv_after = seeded_client.get("/api/v1/ngos/3/services").json()
    net_service_after = next(s for s in ngo3_serv_after if s["requirement_code"] == "FISHING_NET")
    assert net_service_after["available_quantity"] == initial_available_qty - 2  # 48

    # STEP 12: Verify user can retrieve complete status timeline
    track_resp = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking")
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["status"] == "CLOSED"
    assert track_data["completed_quantity"] == 2

    # Check that the history contains all transitions
    collab_entry = next(c for c in track_data["collaborations"] if c["id"] == collab_id)
    history = collab_entry["status_history"]
    assert len(history) == 8
    statuses = [h["status"] for h in history]
    assert statuses == [
        "REQUESTED",
        "ACCEPTED",
        "PREPARING",
        "DISPATCHED",
        "IN_TRANSIT",
        "DELIVERED",
        "RECEIVED",
        "COMPLETED",
    ]


def test_section_34_laptop_multi_ngo_full_support_flow(seeded_client):
    """
    Test scenario:
    User requests 100 laptops.
    NGO A provides 60 (or available capacity), NGO B provides 40.
    Together 60 + 40 = 100 -> FULLY_SUPPORTED.
    """
    # 1. Add extra capacity to NGO 1 (Helping Hands) and NGO 8 (Digital Hope) to have 60 and 40 available
    # NGO 1 -> set 60 laptops
    seeded_client.post(
        "/api/v1/ngos/1/services",
        json={
            "service_category": "EDUCATION",
            "requirement": "LAPTOP_DESKTOP",
            "available_quantity": 60,
            "unit": "units",
            "estimated_duration_value": 3,
            "estimated_duration_unit": "DAYS",
        },
    )
    # NGO 8 -> set 40 laptops
    seeded_client.post(
        "/api/v1/ngos/8/services",
        json={
            "service_category": "EDUCATION",
            "requirement": "LAPTOP_DESKTOP",
            "available_quantity": 40,
            "unit": "units",
            "estimated_duration_value": 3,
            "estimated_duration_unit": "DAYS",
        },
    )

    # 2. Citizen requests 100 laptops
    req_resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "STATE_SKILL_MISSION_100",
            "service_category": "EDUCATION",
            "requirement": "LAPTOP_DESKTOP",
            "requirement_details": "Need 100 laptops for district IT training laboratories.",
            "state": "Karnataka",
            "district": "Bengaluru Urban",
            "area": "Indiranagar",
            "income": 0.0,
            "quantity": 100,
            "unit": "units",
        },
    )
    assert req_resp.status_code == 201
    req_data = req_resp.json()
    request_id = req_data["request_id"]
    candidates = req_data["collaborations"]

    # Find NGO001 and NGO008 candidate collaborations
    collab_ngo1 = next(c for c in candidates if c["ngo_code"] == "NGO001")
    collab_ngo8 = next(c for c in candidates if c["ngo_code"] == "NGO008")

    # 3. NGO001 accepts 60 laptops
    acc1 = seeded_client.post(
        f"/api/v1/collaborations/{collab_ngo1['id']}/accept",
        json={
            "accepted_quantity": 60,
            "estimated_duration_value": 3,
            "estimated_duration_unit": "DAYS",
            "response_message": "Accepting 60 laptops from Bengaluru stock.",
        },
    )
    assert acc1.status_code == 200

    # Intermediate verification: 60/100 -> PARTIALLY_SUPPORTED
    track_mid = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking").json()
    assert track_mid["status"] == "PARTIALLY_SUPPORTED"
    assert track_mid["accepted_quantity"] == 60
    assert track_mid["remaining_quantity"] == 40

    # 4. NGO008 accepts remaining 40 laptops
    acc2 = seeded_client.post(
        f"/api/v1/collaborations/{collab_ngo8['id']}/accept",
        json={
            "accepted_quantity": 40,
            "estimated_duration_value": 4,
            "estimated_duration_unit": "DAYS",
            "response_message": "Accepting remaining 40 laptops from Hyderabad stock.",
        },
    )
    assert acc2.status_code == 200

    # Final verification: 60 + 40 = 100 -> FULLY_SUPPORTED
    track_final = seeded_client.get(f"/api/v1/collaboration/requests/{request_id}/tracking").json()
    assert track_final["status"] == "FULLY_SUPPORTED"
    assert track_final["accepted_quantity"] == 100
    assert track_final["remaining_quantity"] == 0
    assert track_final["requested_quantity"] == 100
