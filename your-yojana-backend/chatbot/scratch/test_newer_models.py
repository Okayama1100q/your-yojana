import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

models_to_try = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.6-flash"
]

for model in models_to_try:
    try:
        response = client.models.generate_content(
            model=model,
            contents="test"
        )
        print(f"SUCCESS with {model}: {response.text.strip()}")
    except Exception as e:
        err_msg = str(e).encode('ascii', errors='replace').decode('ascii')
        print(f"FAILED with {model}: {err_msg}")
