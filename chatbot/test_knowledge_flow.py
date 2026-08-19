import json
import urllib.request

API_URL = "http://127.0.0.1:8000/api/chat"
CHATBOT_API_KEY = "yj_cb_c1c0c3b259fa09e14c5cc18505096425"

def send_chat(message: str, history: list = None, user_state: str = None, preferred_lang: str = None):
    payload = {
        "message": message,
        "history": history or [],
        "userState": user_state,
        "preferredLanguage": preferred_lang
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Chatbot-API-Key": CHATBOT_API_KEY
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_full_flow():
    print("========================================")
    print("TEST 1: Initial Welcome Prompt")
    print("========================================")
    res = send_chat("Hi")
    print("Bot Response:", res.get("response"))
    print("Options:", res.get("options"))
    assert "Yes, share location" in res.get("options", [])
    print(">>> PASS: Initial Welcome Prompt\n")

    print("========================================")
    print("TEST 2: Location Consent -> State Selection")
    print("========================================")
    res = send_chat("Yes, share location")
    print("Bot Response:", res.get("response"))
    print("Options:", res.get("options"))
    assert "Tamil Nadu" in res.get("options", [])
    print(">>> PASS: State Selection Prompt\n")

    print("========================================")
    print("TEST 3: Select State -> Language Selection")
    print("========================================")
    res = send_chat("Tamil Nadu")
    print("Bot Response:", res.get("response"))
    print("Options:", res.get("options"))
    assert res.get("userState") == "Tamil Nadu"
    print(">>> PASS: Language Selection for Tamil Nadu\n")

    print("========================================")
    print("TEST 4: Select Language -> Greeting")
    print("========================================")
    res = send_chat("English", user_state="Tamil Nadu")
    print("Bot Response:", res.get("response"))
    assert res.get("preferredLanguage") == "English"
    print(">>> PASS: Preferred Language confirmed\n")

    print("========================================")
    print("TEST 5: Knowledge Query: Engineering Scholarship")
    print("========================================")
    res = send_chat(
        "What schemes are available for engineering students?",
        user_state="Tamil Nadu",
        preferred_lang="English"
    )
    print("Bot Response:\n", res.get("response"))
    assert res.get("success") is True
    print(">>> PASS: Knowledge-grounded Scheme Query\n")

    print("========================================")
    print("TEST 6: Women Safety Query")
    print("========================================")
    res = send_chat(
        "I need emergency help for women safety",
        user_state="Tamil Nadu",
        preferred_lang="English"
    )
    print("Bot Response:\n", res.get("response"))
    assert "1091" in res.get("response") or "112" in res.get("response") or "Women" in res.get("response")
    print(">>> PASS: Women Safety Agent grounded response\n")

    print("========================================")
    print("TEST 7: Out-of-Scope Filter")
    print("========================================")
    res = send_chat(
        "Who won the cricket match yesterday?",
        user_state="Tamil Nadu",
        preferred_lang="English"
    )
    print("Bot Response:\n", res.get("response"))
    assert res.get("in_scope") is False or "YOJANA" in res.get("response")
    print(">>> PASS: Out-of-scope query handled properly\n")

if __name__ == "__main__":
    test_full_flow()
