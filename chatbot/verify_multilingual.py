import httpx
import json

BASE_URL = "http://127.0.0.1:8000"
API_KEY = "yj_cb_c1c0c3b259fa09e14c5cc18505096425"

headers = {
    "X-Chatbot-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def print_step(title):
    print("\n" + "=" * 50)
    print(f" STEP: {title}")
    print("=" * 50)

def test_multilingual_flow():
    # Store dynamic conversation state
    history = []
    preferred_language = None
    user_state = None

    client = httpx.Client(timeout=30.0)

    # 1. Initial greeting with unknown state
    print_step("1. User Opens Chat (Unknown State)")
    payload = {
        "message": "Hello",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    res = r.json()
    print("Bot Response:", res["response"])
    print("Returned Options:", res["options"])
    assert "location" in res["response"].lower(), "Should ask for location permission"
    assert "Yes, share location" in res["options"], "Should offer Yes/No location options"
    
    # Update local state
    history.append({"role": "user", "content": "Hello"})
    history.append({"role": "model", "content": res["response"]})

    # 2. User consents and sends state
    print_step("2. User shares location (Tamil Nadu)")
    user_state = "Tamil Nadu"
    payload = {
        "message": "Tamil Nadu",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response:", res["response"])
    print("Returned Options:", res["options"])
    assert "Tamil Nadu" in res["response"], "Bot should recognize Tamil Nadu"
    assert "தமிழ்" in res["options"][1], "Bot should suggest Tamil"
    
    history.append({"role": "user", "content": "Tamil Nadu"})
    history.append({"role": "model", "content": res["response"]})

    # 3. User selects Tamil
    print_step("3. User selects Tamil")
    payload = {
        "message": "தமிழ்",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response:", res["response"])
    print("Returned State Lang:", res["preferredLanguage"])
    assert res["preferredLanguage"] == "Tamil", "Preferred language should now be Tamil"
    
    preferred_language = res["preferredLanguage"]
    history.append({"role": "user", "content": "தமிழ்"})
    history.append({"role": "model", "content": res["response"]})

    # 4. User asks in Tamil script
    print_step("4. User asks about scholarship in Tamil script")
    payload = {
        "message": "எனக்கு மாணவர்களுக்கான scholarship பற்றி தெரிய வேண்டும்.",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response:", res["response"])
    assert res["in_scope"] == True
    
    history.append({"role": "user", "content": "எனக்கு மாணவர்களுக்கான scholarship பற்றி தெரிய வேண்டும்."})
    history.append({"role": "model", "content": res["response"]})

    # 5. User switches language and types Hinglish (Hindi)
    print_step("5. User types in Hinglish (Hindi)")
    payload = {
        "message": "Mujhe scholarship ke bare me batao",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response:", res["response"])
    print("Returned Options:", res["options"])
    assert "Hindi" in res["response"] or "हिन्दी" in res["response"], "Should detect Hindi and ask to switch"
    assert "Yes, continue in Hindi" in res["options"], "Should offer options to confirm switch"
    
    history.append({"role": "user", "content": "Mujhe scholarship ke bare me batao"})
    history.append({"role": "model", "content": res["response"]})

    # 6. User confirms the switch to Hindi
    print_step("6. User confirms language switch")
    payload = {
        "message": "Yes, continue in Hindi",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response (should be in Hindi answering original query):")
    print(res["response"])
    print("Returned State Lang:", res["preferredLanguage"])
    assert res["preferredLanguage"] == "Hindi", "Preferred language should now be Hindi"
    
    preferred_language = res["preferredLanguage"]
    history.append({"role": "user", "content": "Yes, continue in Hindi"})
    history.append({"role": "model", "content": res["response"]})

    # 7. Reset language using Change Language command
    print_step("7. User resets language choice")
    payload = {
        "message": "Change Language",
        "history": history,
        "userState": user_state,
        "preferredLanguage": preferred_language
    }
    
    r = client.post(f"{BASE_URL}/api/chat", json=payload, headers=headers)
    assert r.status_code == 200
    res = r.json()
    print("Bot Response (Language Select Prompt):", res["response"])
    print("Returned State Lang:", res["preferredLanguage"])
    print("Options:", res["options"])
    assert res["preferredLanguage"] is None, "Preferred language should be cleared"
    
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    try:
        test_multilingual_flow()
    except Exception as e:
        print("\n❌ TEST FAILURE:")
        import traceback
        traceback.print_exc()
