import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_database
from app.models.enrollment import EnrollmentStatus
from datetime import datetime, timezone

client = TestClient(app)

MOCK_USER_ID = "TEST-ADMIN-USR-1002"
MOCK_SCHEME_ID = "TEST-MP-KSK-DISABILITY"
MOCK_ENROLLMENT_ID = "ENR-TEST-VERIFY-123"

@pytest.fixture(autouse=True)
def setup_and_cleanup_db():
    db = get_database()
    # Ensure clean state before
    db.enrollments.delete_many({"user_id": MOCK_USER_ID})
    
    # Insert a mock pending enrollment for verification testing
    now = datetime.now(timezone.utc)
    db.enrollments.insert_one({
        "enrollment_id": MOCK_ENROLLMENT_ID,
        "user_id": MOCK_USER_ID,
        "scheme_id": MOCK_SCHEME_ID,
        "status": EnrollmentStatus.REGISTRATION_PENDING.value,
        "selected_at": now,
        "updated_at": now,
        "created_at": now
    })
    
    yield
    
    # Clean up after
    db.enrollments.delete_many({"user_id": MOCK_USER_ID})

def test_get_pending_enrollments():
    response = client.get("/api/v1/saarthi/admin/enrollments/pending")
    assert response.status_code == 200
    data = response.json()
    
    # We should at least find our mock enrollment
    found = any(e["enrollment_id"] == MOCK_ENROLLMENT_ID for e in data)
    assert found is True
    
    # Ensure they are all pending
    for e in data:
        assert e["status"] == EnrollmentStatus.REGISTRATION_PENDING.value

def test_verify_enrollment_valid():
    payload = {
        "document_url": "https://example.com/certificate.pdf"
    }
    response = client.post(f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/verify", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["enrollment_id"] == MOCK_ENROLLMENT_ID
    assert data["previous_status"] == EnrollmentStatus.REGISTRATION_PENDING.value
    assert data["new_status"] == EnrollmentStatus.APPROVED.value
    assert data["is_valid"] is True

def test_verify_enrollment_invalid():
    payload = {
        "document_url": "https://example.com/invalid-certificate.pdf"
    }
    response = client.post(f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/verify", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["enrollment_id"] == MOCK_ENROLLMENT_ID
    assert data["previous_status"] == EnrollmentStatus.REGISTRATION_PENDING.value
    assert data["new_status"] == EnrollmentStatus.DOCUMENT_CORRECTION_REQUIRED.value
    assert data["is_valid"] is False
    assert "blurry or tampered" in data["agent_reason"]
