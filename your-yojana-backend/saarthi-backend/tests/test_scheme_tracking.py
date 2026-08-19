import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_database
from app.models.enrollment import EnrollmentStatus
from datetime import datetime, timezone

client = TestClient(app)

MOCK_USER_ID = "TEST-USER-LIFECYCLE-99"
MOCK_SCHEME_ID = "MP-KSK-DISABILITY"
MOCK_ENROLLMENT_ID = "ENR-LIFECYCLE-MOCK-1"

@pytest.fixture(autouse=True)
def setup_and_cleanup():
    db = get_database()
    # clean up before
    db.enrollments.delete_many({"user_id": MOCK_USER_ID})
    db.disbursements.delete_many({"user_id": MOCK_USER_ID})
    
    # insert initial mock enrollment (REGISTRATION_PENDING)
    now = datetime.now(timezone.utc)
    db.enrollments.insert_one({
        "enrollment_id": MOCK_ENROLLMENT_ID,
        "user_id": MOCK_USER_ID,
        "scheme_id": MOCK_SCHEME_ID,
        "scheme_name": "Disability Assistance Scheme",
        "status": EnrollmentStatus.REGISTRATION_PENDING.value,
        "selected_at": now,
        "updated_at": now,
        "created_at": now
    })
    
    yield
    
    # clean up after
    db.enrollments.delete_many({"user_id": MOCK_USER_ID})
    db.disbursements.delete_many({"user_id": MOCK_USER_ID})

def test_dashboard_initial_state():
    response = client.get(f"/api/v1/saarthi/citizen/dashboard?user_id={MOCK_USER_ID}")
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == MOCK_USER_ID
    assert data["active_enrollments_count"] == 0
    assert data["total_benefits_amount"] == 0.0
    assert len(data["enrollments"]) == 1
    assert data["enrollments"][0]["enrollment_id"] == MOCK_ENROLLMENT_ID
    assert data["enrollments"][0]["status"] == EnrollmentStatus.REGISTRATION_PENDING.value
    assert data["enrollments"][0]["total_disbursed"] == 0.0

def test_disburse_fails_on_pending_enrollment():
    payload = {"amount": 2000.0, "remarks": "First installment"}
    response = client.post(
        f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/disbursements", 
        json=payload
    )
    assert response.status_code == 400
    assert "Must be APPROVED or ACTIVE" in response.json()["detail"]

def test_full_workflow():
    # 1. Approve the enrollment using admin verification
    verify_payload = {"document_url": "https://example.com/certificate.pdf"}
    verify_resp = client.post(
        f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/verify", 
        json=verify_payload
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["new_status"] == EnrollmentStatus.APPROVED.value

    # 2. Record disbursement (APPROVED -> ACTIVE)
    disburse_payload = {"amount": 2500.0, "remarks": "Approved disbursement"}
    disb_resp = client.post(
        f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/disbursements",
        json=disburse_payload
    )
    assert disb_resp.status_code == 201
    disb_data = disb_resp.json()
    assert disb_data["amount"] == 2500.0
    assert disb_data["status"] == "PAID"
    
    # 3. Check dashboard (should be ACTIVE, total amount = 2500)
    dash_resp = client.get(f"/api/v1/saarthi/citizen/dashboard?user_id={MOCK_USER_ID}")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["active_enrollments_count"] == 1
    assert dash_data["total_benefits_amount"] == 2500.0
    assert dash_data["enrollments"][0]["status"] == EnrollmentStatus.ACTIVE.value
    assert len(dash_data["enrollments"][0]["disbursements"]) == 1
    assert dash_data["enrollments"][0]["disbursements"][0]["amount"] == 2500.0

    # 4. Record another disbursement
    disb_resp2 = client.post(
        f"/api/v1/saarthi/admin/enrollments/{MOCK_ENROLLMENT_ID}/disbursements",
        json={"amount": 1500.0, "remarks": "Second installment"}
    )
    assert disb_resp2.status_code == 201
    
    # 5. Check dashboard total updated (2500 + 1500 = 4000)
    dash_resp2 = client.get(f"/api/v1/saarthi/citizen/dashboard?user_id={MOCK_USER_ID}")
    assert dash_resp2.json()["total_benefits_amount"] == 4000.0

    # 6. Citizen updates status to DISCONTINUED
    lifecycle_payload = {"user_id": MOCK_USER_ID, "status": "DISCONTINUED"}
    lifecycle_resp = client.patch(
        f"/api/v1/saarthi/enrollments/{MOCK_ENROLLMENT_ID}/lifecycle",
        json=lifecycle_payload
    )
    assert lifecycle_resp.status_code == 200
    assert lifecycle_resp.json()["new_status"] == EnrollmentStatus.DISCONTINUED.value

    # 7. Check dashboard (active count should be 0, total amount still 4000)
    dash_resp3 = client.get(f"/api/v1/saarthi/citizen/dashboard?user_id={MOCK_USER_ID}")
    assert dash_resp3.json()["active_enrollments_count"] == 0
    assert dash_resp3.json()["total_benefits_amount"] == 4000.0
    assert dash_resp3.json()["enrollments"][0]["status"] == EnrollmentStatus.DISCONTINUED.value

def test_lifecycle_forbidden_for_other_user():
    lifecycle_payload = {"user_id": "OTHER-USER-ID", "status": "DISCONTINUED"}
    response = client.patch(
        f"/api/v1/saarthi/enrollments/{MOCK_ENROLLMENT_ID}/lifecycle",
        json=lifecycle_payload
    )
    assert response.status_code == 403
