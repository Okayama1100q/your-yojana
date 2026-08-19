import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print("API Key starts with:", api_key[:10] if api_key else "None")

client = genai.Client(api_key=api_key)

models_to_try = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
]

for model in models_to_try:
    try:
        response = client.models.generate_content(
            model=model,
            contents="test"
        )
        print(f"SUCCESS with {model}: {response.text.strip()}")
    except Exception as e:
        # Avoid unicode characters in string
        err_msg = str(e).encode('ascii', errors='replace').decode('ascii')
        print(f"FAILED with {model}: {err_msg}")
