import httpx
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_test_flow():
    print("--- 1. Creating Enrollment ---")
    enroll_payload = {
        "user_id": "USR-TEST-FLOW-01",
        "profile": {
            "gender": "Male",
            "age": 45,
            "marital_status": "Married",
            "state": "Madhya Pradesh",
            "area_of_residence": "Rural",
            "community": "OBC",
            "disability": False,
            "minority_status": False,
            "student_status": False,
            "bpl_category": True,
            "family_annual_income": 40000
        },
        "selected_scheme": {
            "scheme_id": "MP-FARMER-01",
            "scheme_name": "MP Mukhyamantri Kisan Kalyan Yojana",
            "relevance_score": 0.95,
            "official_link": "https://example.gov.in",
            "category": ["Agriculture", "Financial Assistance"],
            "ai_explanation": "You are eligible as a farmer."
        }
    }
    
    response = client.post("/api/v1/saarthi/enroll", json=enroll_payload)
    if response.status_code != 201:
        print(f"Error creating enrollment: {response.status_code} - {response.text}")
        return
        
    enrollment_data = response.json()
    enrollment_id = enrollment_data["enrollment_id"]
    print(f"Enrollment Created Successfully! ID: {enrollment_id}")
    print(f"Initial Status: {enrollment_data['status']}")
    
    print("\n--- 2. Fetching Pending Enrollments (Admin) ---")
    response = client.get("/api/v1/saarthi/admin/enrollments/pending")
    if response.status_code != 200:
        print(f"Error fetching pending: {response.status_code} - {response.text}")
        return
        
    pending_data = response.json()
    print(f"Found {len(pending_data)} pending enrollments.")
    found = False
    for e in pending_data:
        if e["enrollment_id"] == enrollment_id:
            found = True
            print(f"Found our enrollment: {e['enrollment_id']} with status {e['status']}")
            
    if not found:
        print("Our enrollment was not found in pending list!")
        return
        
    print("\n--- 3. Verifying Enrollment (Admin) ---")
    verify_payload = {
        "document_url": "https://example.com/valid-certificate.pdf"
    }
    response = client.post(f"/api/v1/saarthi/admin/enrollments/{enrollment_id}/verify", json=verify_payload)
    if response.status_code != 200:
        print(f"Error verifying: {response.status_code} - {response.text}")
        return
        
    verify_data = response.json()
    print(f"Verification Successful!")
    print(f"Previous Status: {verify_data['previous_status']}")
    print(f"New Status: {verify_data['new_status']}")
    print(f"Agent Reason: {verify_data['agent_reason']}")
    print(f"Is Valid: {verify_data['is_valid']}")
    print(f"Confidence: {verify_data['confidence_score']}")
    print("\nFlow Test Completed Successfully!")

if __name__ == "__main__":
    run_test_flow()
