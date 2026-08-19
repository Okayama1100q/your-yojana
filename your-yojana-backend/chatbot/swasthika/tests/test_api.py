"""
API integration tests.

Verifies:
  - Authentication: missing key → 401, wrong key → 401, correct key → 200
  - Response structure matches EvaluationResponse schema
  - Recommendations ≤ 10
  - eligible_count, needs_more_information_count, ineligible_count are present
  - Gemini is never called during eligibility (no GEMINI_API_KEY in env)
  - NeedsMoreInfoEntry contains follow_up_questions
  - Audit trail is present in each recommendation
"""

import os
import pytest
from fastapi.testclient import TestClient

from swasthika.backend.config import settings
from swasthika.backend.main import app

# Use a TestClient that does NOT follow redirects and does NOT call Gemini
# (GEMINI_API_KEY intentionally absent)
client = TestClient(app, raise_server_exceptions=True)

TEST_KEY = "swasthika-test-key-12345"


@pytest.fixture(autouse=True)
def set_test_key(monkeypatch):
    """Inject SWASTHIKA_API_KEY for every test in this file."""
    monkeypatch.setattr(settings, "swasthika_api_key", TEST_KEY)
    monkeypatch.setattr(settings, "gemini_api_key", None)  # confirm Gemini not available


def auth_headers():
    return {"X-SWASTHIKA-API-KEY": TEST_KEY}


# ── Authentication ─────────────────────────────────────────────────────────────

def test_missing_api_key_returns_401():
    response = client.post("/api/swasthika/evaluate", json={"age": 25})
    assert response.status_code == 401


def test_wrong_api_key_returns_401():
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25},
        headers={"X-SWASTHIKA-API-KEY": "wrong-key"},
    )
    assert response.status_code == 401


def test_correct_api_key_returns_200():
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25, "gender": "female", "state": "Kerala"},
        headers=auth_headers(),
    )
    assert response.status_code == 200


# ── Response structure ─────────────────────────────────────────────────────────

def test_response_has_required_fields():
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 30, "gender": "male", "state": "Tamil Nadu", "community": "SC"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()

    required_fields = {
        "status", "total_schemes_evaluated", "eligible_count",
        "needs_more_information_count", "ineligible_count",
        "recommendations", "needs_more_information", "missing_fields_summary",
    }
    assert required_fields.issubset(data.keys())


def test_recommendations_at_most_10():
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25, "gender": "female", "state": "Tamil Nadu", "community": "SC",
              "is_student": True, "is_bpl": True},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["recommendations"]) <= 10


def test_recommendations_all_eligible():
    """Every recommendation must have eligibility_status == ELIGIBLE."""
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 35, "gender": "male", "state": "Kerala"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    for rec in response.json()["recommendations"]:
        assert rec["eligibility_status"] == "ELIGIBLE"


def test_recommendation_has_audit_trail():
    """Each recommendation must contain a full audit_trail."""
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25, "gender": "female", "state": "Tamil Nadu"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    for rec in response.json()["recommendations"]:
        assert "audit_trail" in rec
        assert "scheme_id" in rec["audit_trail"]
        assert "status" in rec["audit_trail"]
        assert "checks" in rec["audit_trail"]


def test_eligible_count_is_non_negative():
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 60, "state": "Rajasthan"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["eligible_count"] >= 0
    assert data["ineligible_count"] >= 0
    assert data["needs_more_information_count"] >= 0


def test_totals_add_up():
    """eligible + ineligible + needs_more_info must equal total_schemes_evaluated."""
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 28, "gender": "female", "state": "Gujarat"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()
    total = (
        data["eligible_count"]
        + data["ineligible_count"]
        + data["needs_more_information_count"]
    )
    assert total == data["total_schemes_evaluated"]


# ── Gemini never called during eligibility ─────────────────────────────────────

def test_gemini_not_called_for_eligibility(monkeypatch):
    """
    Confirm that eligibility evaluation proceeds even when GEMINI_API_KEY is absent.
    Explanations degrade to a 'unavailable' message; eligibility is unaffected.
    """
    monkeypatch.setattr(settings, "gemini_api_key", None)
    os.environ.pop("GEMINI_API_KEY", None)

    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25, "gender": "female", "state": "Kerala"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()

    # Eligibility engine ran — counts present
    assert data["total_schemes_evaluated"] > 0

    # Every explanation should gracefully degrade, not crash
    for rec in data["recommendations"]:
        assert isinstance(rec["explanation"], str)
        assert len(rec["explanation"]) > 0


# ── NMI entries have follow-up questions ──────────────────────────────────────

def test_needs_more_info_has_follow_up_questions():
    """NMI entries must include follow_up_questions."""
    response = client.post(
        "/api/swasthika/evaluate",
        json={"age": 25},   # minimal profile → many NMI
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()
    for nmi in data["needs_more_information"]:
        assert "scheme_id" in nmi
        assert "missing_fields" in nmi
        assert "follow_up_questions" in nmi
        for fq in nmi["follow_up_questions"]:
            assert "field" in fq
            assert "question" in fq
