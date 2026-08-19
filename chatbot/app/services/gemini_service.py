import os
import json
from typing import Optional, List, Dict
from google import genai
from google.genai import types
from dotenv import load_dotenv

from app.prompts.yojana_system_prompt import YOJANA_SYSTEM_PROMPT
from app.services.rag_service import SchemeRetriever
from app.services.language_service import (
    SUPPORTED_LANGUAGES,
    GREETINGS,
    get_suggested_languages,
    get_native_display_name,
    normalize_language_choice,
    STATE_LANGUAGES
)

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

SCOPE_GUARD_PROMPT = """You are a strict domain classifier for the YOUR-YOJANA platform.
Your ONLY job is to determine if the user's message is related to YOUR-YOJANA based on the conversation history and current message.
The YOUR-YOJANA platform covers: welfare schemes, civic services, the six AI agents (Swasthika, Saarthi, Nyaya, Drishti, Setu, Darshan), eligibility, application tracking, governance, transparency, responsible AI, and platform usage.

Classify as IN_SCOPE if the user asks about the platform, its features, workflows, or directly related civic/welfare topics.
Classify as OUT_OF_SCOPE if the user asks about general knowledge, politics, programming, math, sports, weather, entertainment, or anything unrelated to YOUR-YOJANA.
Reply EXACTLY with "IN_SCOPE" or "OUT_OF_SCOPE" only."""

DETECT_LANGUAGE_PROMPT = """You are an AI language detector.
Identify the primary language of the user's input text.
Supported Indian languages: English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese, Urdu.
Also support Romanized script / English letter representations of these languages (e.g., Hinglish, Tanglish, Kanglish, etc.).
Reply with EXACTLY one of the language names: English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese, Urdu.
If the text is in English, or if it is ambiguous, reply with "English".
Do not include any other words or punctuation in your reply."""

from app.services.language_service import (
    SUPPORTED_LANGUAGES,
    GREETINGS,
    get_suggested_languages,
    get_native_display_name,
    normalize_language_choice,
    detect_fast_language,
    STATE_LANGUAGES
)

def detect_message_language(message: str, client: genai.Client) -> str:
    """Detect the language of the user message using fast heuristics, falling back to English."""
    fast_lang = detect_fast_language(message)
    if fast_lang:
        return fast_lang
    return "English"

def get_translated_rejection(preferred_language: str, client: genai.Client) -> str:
    """Generate the out-of-scope rejection message in the preferred language."""
    if preferred_language == "English":
        return "I'm the YOJANA AI Assistant. I can help only with questions related to the YOUR-YOJANA platform, including scheme discovery, eligibility workflow, applications, benefits, civic services and our AI agents."
    
    prompt = f"Translate the following out-of-scope rejection message into {preferred_language}. Respond ONLY with the translation, and do not add any quotes or prefixes:\n\nI'm the YOJANA AI Assistant. I can help only with questions related to the YOUR-YOJANA platform, including scheme discovery, eligibility workflow, applications, benefits, civic services and our AI agents."
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
            ),
        )
        return response.text.strip()
    except Exception:
        return f"I'm the YOJANA AI Assistant. I can help only with questions related to the YOUR-YOJANA platform. (Response in {preferred_language})"

def is_in_scope(message: str, history: list, client: genai.Client) -> bool:
    try:
        context = "Conversation History:\n"
        for h in history[-3:]: # Keep context brief for validator
            context += f"{h.role}: {h.content}\n"
        
        prompt = f"{context}\nCurrent User Message: {message}"
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SCOPE_GUARD_PROMPT,
                temperature=0.0,
            ),
        )
        return "IN_SCOPE" in response.text.upper()
    except Exception as e:
        print(f"Scope validation failed: {e}")
        return True # Default to True, layer 2 handles it

async def process_chat(
    message: str, 
    history: list, 
    user_state: Optional[str] = None, 
    preferred_language: Optional[str] = None
) -> dict:
    if not API_KEY or not API_KEY.strip() or API_KEY == "your_gemini_api_key_here":
        return {
            "success": False,
            "response": "YOJANA AI is temporarily unavailable. Please try again shortly."
        }
        
    try:
        client = genai.Client(api_key=API_KEY)
        msg_lower = message.strip().lower()

        # 1. Handle "Change Language" command
        if msg_lower in ["🌐 change language", "change language", "/change_language"]:
            if user_state:
                sug_langs = get_suggested_languages(user_state)
                options = ["English"]
                for lang in sug_langs:
                    if lang != "English" and lang in SUPPORTED_LANGUAGES:
                        options.append(SUPPORTED_LANGUAGES[lang])
                options.append("Show All Languages")
                
                # Format welcome greeting state recommendation
                reg_names = " or ".join([SUPPORTED_LANGUAGES.get(l, l).split(" – ")[0] for l in sug_langs if l != "English"])
                resp_msg = f"Welcome! Would you like to continue in English or {reg_names}?"
                if "Tamil" in sug_langs:
                    resp_msg = "வணக்கம்! Welcome!\nWould you like to continue in English or தமிழ் (Tamil)?"
                elif "Kannada" in sug_langs:
                    resp_msg = "నమస్కారం! Welcome!\nWould you like to continue in English or ಕನ್ನಡ (Kannada)?"
                elif "Marathi" in sug_langs:
                    resp_msg = "नमस्कार! Welcome!\nWould you like to continue in English or मराठी (Marathi)?"
                
                return {
                    "success": True,
                    "response": resp_msg,
                    "preferredLanguage": None,
                    "userState": user_state,
                    "suggestedLanguages": sug_langs,
                    "options": options
                }
            else:
                # Ask location permission first
                return {
                    "success": True,
                    "response": "Welcome! I can assist you in multiple Indian languages. May I use your state/location to suggest the most suitable language and relevant services?",
                    "preferredLanguage": None,
                    "userState": None,
                    "options": ["Yes, share location", "No, choose language manually"]
                }

        # 2. Handle Location Consent Response
        if preferred_language is None and msg_lower in ["yes, share location", "yes", "share location", "location consent"]:
            # Ask the user for their state manually (since we don't silently grab location)
            popular_states = ["Tamil Nadu", "Kerala", "Karnataka", "Maharashtra", "Gujarat", "Punjab", "West Bengal", "Odisha", "Uttar Pradesh", "Bihar", "Other State"]
            return {
                "success": True,
                "response": "Please select or type your state to help us suggest the regional language:",
                "preferredLanguage": None,
                "userState": None,
                "options": popular_states
            }
            
        if preferred_language is None and msg_lower in ["no, choose language manually", "no", "manually", "choose manually", "show all languages"]:
            # Present the complete language selector
            langs_list = [SUPPORTED_LANGUAGES[l] for l in SUPPORTED_LANGUAGES if l != "Other"]
            return {
                "success": True,
                "response": "Welcome! I can assist you in multiple Indian languages. Please select your preferred language:",
                "preferredLanguage": None,
                "userState": user_state,
                "options": langs_list
            }

        # 3. Handle State Selection Response
        # Check if the user entered/selected a state
        matched_state = None
        for state in STATE_LANGUAGES:
            if msg_lower == state.lower() or msg_lower.replace(" state", "") == state.lower():
                matched_state = state
                break
                
        if preferred_language is None and matched_state:
            sug_langs = get_suggested_languages(matched_state)
            options = ["English"]
            for lang in sug_langs:
                if lang != "English" and lang in SUPPORTED_LANGUAGES:
                    options.append(SUPPORTED_LANGUAGES[lang])
            options.append("Show All Languages")
            
            reg_names = " or ".join([SUPPORTED_LANGUAGES.get(l, l).split(" – ")[0] for l in sug_langs if l != "English"])
            resp_msg = f"It looks like you are accessing the service from {matched_state}.\nWhich language would you prefer?"
            if "Tamil" in sug_langs:
                resp_msg = f"வணக்கம்! Welcome!\nIt looks like you are accessing the service from {matched_state}.\nWhich language would you prefer?"
            
            return {
                "success": True,
                "response": resp_msg,
                "preferredLanguage": None,
                "userState": matched_state,
                "suggestedLanguages": sug_langs,
                "options": options
            }

        # 4. Handle Language Selection Response
        normalized_choice = normalize_language_choice(message)
        if preferred_language is None and normalized_choice:
            preferred_language = normalized_choice
            greeting = GREETINGS.get(preferred_language, f"Welcome! How can I help you today?")
            return {
                "success": True,
                "response": greeting,
                "preferredLanguage": preferred_language,
                "userState": user_state,
                "options": ["🌐 Change Language"]
            }

        # 5. Onboarding Fallback (if preferred_language is still None)
        if preferred_language is None:
            if user_state:
                sug_langs = get_suggested_languages(user_state)
                options = ["English"]
                for lang in sug_langs:
                    if lang != "English" and lang in SUPPORTED_LANGUAGES:
                        options.append(SUPPORTED_LANGUAGES[lang])
                options.append("Show All Languages")
                
                reg_names = " or ".join([SUPPORTED_LANGUAGES.get(l, l).split(" – ")[0] for l in sug_langs if l != "English"])
                resp_msg = f"It looks like you are accessing the service from {user_state}.\nWhich language would you prefer?"
                if "Tamil" in sug_langs:
                    resp_msg = f"வணக்கம்! Welcome!\nIt looks like you are accessing the service from {user_state}.\nWhich language would you prefer?"
                elif "Kannada" in sug_langs:
                    resp_msg = f"నమస్కారం! Welcome!\nIt looks like you are accessing the service from {user_state}.\nWhich language would you prefer?"
                
                return {
                    "success": True,
                    "response": resp_msg,
                    "preferredLanguage": None,
                    "userState": user_state,
                    "suggestedLanguages": sug_langs,
                    "options": options
                }
            else:
                return {
                    "success": True,
                    "response": "Welcome! I can assist you in multiple Indian languages. May I use your state/location to suggest the most suitable language and relevant services?",
                    "preferredLanguage": None,
                    "userState": None,
                    "options": ["Yes, share location", "No, choose language manually"]
                }

        # 6. Handle Confirm Language Switch Response
        # If user clicked "Yes, continue in Hindi" or "No, keep English"
        if msg_lower.startswith("yes, continue in ") or msg_lower.startswith("yes, continue in"):
            # Extract target language
            target_lang = "English"
            for lang in SUPPORTED_LANGUAGES:
                if lang.lower() in msg_lower:
                    target_lang = lang
                    break
            
            # Switch language
            preferred_language = target_lang
            
            # Find original user query (second-to-last user message in history)
            original_query = None
            if len(history) >= 2:
                # Iterate backwards to find user's message before the switch prompt
                for i in range(len(history) - 1, -1, -1):
                    h = history[i]
                    # The message containing "Would you like me to continue in" is the bot switch prompt
                    # The message BEFORE that is the user's original query
                    if h.role == "model" and "would you like me to continue in" in h.content.lower():
                        if i - 1 >= 0 and history[i-1].role == "user":
                            original_query = history[i-1].content
                            break
            
            if original_query:
                # Re-evaluate the original query in the new language!
                message = original_query
            else:
                # Just say welcome in the new language
                return {
                    "success": True,
                    "response": GREETINGS.get(preferred_language, "Welcome! How can I help you?"),
                    "preferredLanguage": preferred_language,
                    "userState": user_state,
                    "options": ["🌐 Change Language"]
                }
                
        elif msg_lower.startswith("no, keep ") or msg_lower.startswith("no, keep"):
            # Extract target language
            target_lang = preferred_language or "English"
            for lang in SUPPORTED_LANGUAGES:
                if lang.lower() in msg_lower:
                    target_lang = lang
                    break
            preferred_language = target_lang
            return {
                "success": True,
                "response": "Understood. Let's continue in our current language. How can I help you?",
                "preferredLanguage": preferred_language,
                "userState": user_state,
                "options": ["🌐 Change Language"]
            }

        # 7. Language Switch Detection (when preferred language is set)
        else:
            detected_lang = detect_message_language(message, client)
            # Only trigger switch prompt if the language clearly changed and is not English code-switching
            if detected_lang != preferred_language and len(message.strip().split()) > 2:
                # We ask: Would you like me to continue in [detected_lang]?
                native_detected = get_native_display_name(detected_lang).split(" – ")[0]
                
                # Polite switch question in both English and detected language if possible
                switch_prompt = f"Would you like me to continue in {native_detected} ({detected_lang})?"
                if detected_lang == "Hindi":
                    switch_prompt = "Would you like me to continue in हिन्दी (Hindi)? क्या आप हिन्दी में बातचीत जारी रखना चाहते हैं?"
                elif detected_lang == "Tamil":
                    switch_prompt = "Would you like me to continue in தமிழ் (Tamil)? தமிழில் உரையாடலைத் தொடர விரும்புகிறீர்களா?"
                elif detected_lang == "Telugu":
                    switch_prompt = "Would you like me to continue in తెలుగు (Telugu)? మీరు తెలుగులో కొనసాగించాలనుకుంటున్నారా?"
                elif detected_lang == "Kannada":
                    switch_prompt = "Would you like me to continue in ಕನ್ನಡ (Kannada)? ನೀವು ಕನ್ನಡದಲ್ಲಿ முந்துವರියಲು ಬಯಸುವಿರಾ?"
                elif detected_lang == "Malayalam":
                    switch_prompt = "Would you like me to continue in മലയാളം (Malayalam)? നിങ്ങൾക്ക് മലയാളത്തിൽ തുടരണമെന്നുണ്ടോ?"
                elif detected_lang == "Marathi":
                    switch_prompt = "Would you like me to continue in मराठी (Marathi)? तुम्हाला मराठीत सुरू ठेवायला आवडेल का?"
                
                return {
                    "success": True,
                    "response": switch_prompt,
                    "preferredLanguage": preferred_language,  # Keep current language in state
                    "userState": user_state,
                    "options": [f"Yes, continue in {detected_lang}", f"No, keep {preferred_language}"]
                }

        # 8. Main Chat flow - Single grounded Gemini generation
        # Retrieve relevant schemes from the database via BM25 + Fuzzy matching
        retriever = SchemeRetriever.get_instance()
        retrieved_schemes = retriever.retrieve(message, user_state=user_state, top_n=5)
        schemes_context = retriever.format_for_context(retrieved_schemes)

        # Load Platform Knowledge Base
        kb_path = os.path.join(os.path.dirname(__file__), "..", "knowledge", "your_yojana_knowledge.md")
        platform_knowledge = ""
        try:
            with open(kb_path, "r", encoding="utf-8") as f:
                platform_knowledge = f.read()
        except Exception:
            pass
            
        full_system_instruction = (
            f"{YOJANA_SYSTEM_PROMPT}\n\n"
            f"=== RETRIEVED YOUR-YOJANA SCHEMES (GROUND TRUTH DATABASE) ===\n"
            f"{schemes_context}\n\n"
            f"=== YOUR-YOJANA PLATFORM KNOWLEDGE ===\n"
            f"{platform_knowledge}\n\n"
            f"=== CITIZEN CONTEXT & LANGUAGE REQUIREMENTS ===\n"
            f"User State: {user_state or 'Not specified'}\n"
            f"Preferred Language: {preferred_language or 'English'}\n\n"
            f"STRICT SCOPE & DOMAIN RESTRICTION:\n"
            f"- If the user's message is NOT related to YOUR-YOJANA, government schemes, civic issues, citizen welfare, or the 6 platform agents (e.g. asking general trivia, coding, sports, weather, politics), politely decline and state that you only answer questions about the YOUR-YOJANA platform and government schemes.\n\n"
            f"CRITICAL GROUNDING RULES:\n"
            f"- Ground your answers strictly on the RETRIEVED SCHEMES and PLATFORM KNOWLEDGE above.\n"
            f"- If the user asks about something not present in the retrieved schemes or platform knowledge, explicitly state: 'This information is not currently available in the YOJANA knowledge base.'\n"
            f"- Respond in the user's preferred language ('{preferred_language}').\n"
            f"- If preferred language is not English, provide the comprehensive response in {preferred_language} followed by a concise English summary at the bottom."
        )
        
        # Layer 2 - Generate Response with robust history formatting & retries
        formatted_history = []
        last_role = None
        for h in history:
            role = "user" if h.role == "user" else "model"
            content_text = (h.content or "").strip()
            if not content_text:
                continue
            # History must start with a user message
            if not formatted_history and role != "user":
                continue
            # Prevent consecutive turns of the same role
            if role == last_role:
                continue
            formatted_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=content_text)])
            )
            last_role = role

        # If the last item in history is a user message, remove it (since current user message is sent via send_message)
        if formatted_history and formatted_history[-1].role == "user":
            formatted_history.pop()

        response_text = None
        models_to_try = [MODEL_NAME, "gemini-3.5-flash-lite", "gemini-3.6-flash"]
        # Remove duplicates while preserving order
        unique_models = []
        for m in models_to_try:
            if m not in unique_models:
                unique_models.append(m)

        last_err = None
        for attempt_model in unique_models:
            for retry in range(2):
                try:
                    chat = client.chats.create(
                        model=attempt_model,
                        history=formatted_history,
                        config=types.GenerateContentConfig(
                            system_instruction=full_system_instruction,
                            temperature=0.2,
                        )
                    )
                    resp = chat.send_message(message)
                    if resp and resp.text:
                        response_text = resp.text
                        break
                except Exception as ex:
                    last_err = ex
                    import time
                    time.sleep(0.5)
            if response_text:
                break

        if not response_text:
            raise last_err or Exception("All model attempts failed")

        return {
            "success": True,
            "in_scope": True,
            "response": response_text,
            "preferredLanguage": preferred_language,
            "userState": user_state,
            "options": ["🌐 Change Language"]
        }
    except Exception as e:
        print(f"Gemini API error: {e}")
        return {
            "success": False,
            "response": "YOJANA AI is temporarily unavailable. Please try again shortly."
        }
