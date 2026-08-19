import pytest


def test_contributions_and_dynamic_ranking(seeded_client):
    # 1. Check leaderboard
    lead_resp = seeded_client.get("/api/v1/ngos/ranking")
    assert lead_resp.status_code == 200
    leaderboard = lead_resp.json()["leaderboard"]
    assert len(leaderboard) == 20

    # Ensure leaderboard is strictly sorted by ranking_score descending
    scores = [item["ranking_score"] for item in leaderboard]
    assert scores == sorted(scores, reverse=True)

    # Initial rank of NGO003
    ngo3_initial = next(item for item in leaderboard if item["ngo_code"] == "NGO003")
    assert ngo3_initial["completed_requests"] > 0

    # 2. Check initial contributions of NGO 3
    contrib_resp = seeded_client.get("/api/v1/ngos/3/contributions")
    assert contrib_resp.status_code == 200
    initial_contrib_data = contrib_resp.json()
    initial_count = initial_contrib_data["completed_requests"]
    initial_beneficiaries = initial_contrib_data["beneficiaries_helped"]

    # 3. Create a new request and complete it through full lifecycle
    req_resp = seeded_client.post(
        "/api/v1/collaboration/requests",
        json={
            "external_user_id": "RANKING_TEST_USER",
            "service_category": "FISHERIES",
            "requirement": "FISHING_NET",
            "state": "Tamil Nadu",
            "district": "Nagapattinam",
            "area": "Velankanni",
            "quantity": 10,
            "unit": "nets",
        },
    )
    collab_id = req_resp.json()["collaborations"][0]["id"]

    # Accept
    seeded_client.post(
        f"/api/v1/collaborations/{collab_id}/accept",
        json={"accepted_quantity": 10, "estimated_duration_value": 2, "estimated_duration_unit": "DAYS"},
    )

    # Ensure NO contribution was created on ACCEPTED
    check_mid = seeded_client.get("/api/v1/ngos/3/contributions").json()
    assert check_mid["completed_requests"] == initial_count

    # Advance status through to RECEIVED
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "PREPARING"})
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "DELIVERED"})
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "RECEIVED"})

    # Still no contribution until COMPLETED
    check_rec = seeded_client.get("/api/v1/ngos/3/contributions").json()
    assert check_rec["completed_requests"] == initial_count

    # Mark COMPLETED
    seeded_client.post(f"/api/v1/collaborations/{collab_id}/status", json={"status": "COMPLETED"})

    # 4. Verify Contribution created now
    updated_contrib_data = seeded_client.get("/api/v1/ngos/3/contributions").json()
    assert updated_contrib_data["completed_requests"] == initial_count + 1
    assert updated_contrib_data["beneficiaries_helped"] == initial_beneficiaries + 10

    # 5. Verify individual NGO ranking endpoint
    ngo3_rank_resp = seeded_client.get("/api/v1/ngos/3/ranking")
    assert ngo3_rank_resp.status_code == 200
    assert ngo3_rank_resp.json()["completed_requests"] == initial_count + 1
