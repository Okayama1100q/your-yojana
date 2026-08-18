import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_database

client = TestClient(app)

MOCK_USER_ID = "TEST-USR-1001"
MOCK_SCHEME_ID = "TEST-MP-KSK-DISABILITY"

@pytest.fixture(autouse=True)
def cleanup_db():
    yield
    db = get_database()
    db.enrollments.delete_many({"user_id": MOCK_USER_ID})

def get_valid_payload():
    return {
        "user_id": MOCK_USER_ID,
        "profile": {
            "gender": "Male",
            "age": 65,
            "marital_status": "Married",
            "state": "Madhya Pradesh",
            "area_of_residence": "Urban",
            "community": "SC",
            "disability": True,
            "minority_status": False,
            "student_status": False,
            "bpl_category": True,
            "family_annual_income": 60000,
            "parent_guardian_annual_income": None
        },
        "selected_scheme": {
            "scheme_id": MOCK_SCHEME_ID,
            "scheme_name": "Madhya Pradesh Kalakar Evam Sahityakar Kalyan Kosh Niyam - Disability Assistance",
            "relevance_score": 0.7013,
            "official_link": "https://example.gov.in",
            "category": ["Sports & Culture", "Social Welfare & Empowerment"],
            "ai_explanation": "You qualify for this scheme..."
        }
    }

def test_successful_enrollment_creation():
    payload = get_valid_payload()
    response = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "enrollment_id" in data
    assert data["user_id"] == MOCK_USER_ID
    assert data["scheme_id"] == MOCK_SCHEME_ID
    assert data["status"] == "REGISTRATION_PENDING"

def test_missing_user_id():
    payload = get_valid_payload()
    del payload["user_id"]
    response = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response.status_code == 422
    assert "user_id" in str(response.json())

def test_missing_scheme_id():
    payload = get_valid_payload()
    del payload["selected_scheme"]["scheme_id"]
    response = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response.status_code == 422
    assert "scheme_id" in str(response.json())

def test_invalid_relevance_score():
    payload = get_valid_payload()
    payload["selected_scheme"]["relevance_score"] = 1.5 # Should be between 0.0 and 1.0
    response = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response.status_code == 422

def test_invalid_age():
    payload = get_valid_payload()
    payload["profile"]["age"] = -5 # Invalid age
    response = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response.status_code == 422

def test_duplicate_enrollment_prevention():
    payload = get_valid_payload()
    # First enrollment
    response1 = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response1.status_code == 201
    
    # Second enrollment should fail
    response2 = client.post("/api/v1/saarthi/enroll", json=payload)
    assert response2.status_code == 409
    assert "User already has an active or pending enrollment for this scheme" in response2.json()["detail"]
