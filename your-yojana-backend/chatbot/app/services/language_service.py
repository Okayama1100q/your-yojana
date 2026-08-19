from typing import Dict, List, Optional, Tuple

# Supported Indian languages and their display names (native scripts)
SUPPORTED_LANGUAGES: Dict[str, str] = {
    "English": "English",
    "Tamil": "தமிழ் – Tamil",
    "Hindi": "हिन्दी – Hindi",
    "Telugu": "తెలుగు – Telugu",
    "Kannada": "ಕನ್ನಡ – Kannada",
    "Malayalam": "മലയാളം – Malayalam",
    "Marathi": "मराठी – Marathi",
    "Bengali": "বাংলা – Bengali",
    "Gujarati": "ગુજરાતી – Gujarati",
    "Punjabi": "ਪੰਜਾਬੀ – Punjabi",
    "Odia": "ଓଡ଼ିଆ – Odia",
    "Assamese": "অসমীয়া – Assamese",
    "Urdu": "اردو – Urdu",
    "Other": "Other"
}

# Mapping of English language name to language key
LANGUAGE_KEYS: Dict[str, str] = {
    "english": "English",
    "tamil": "Tamil",
    "தமிழ்": "Tamil",
    "hindi": "Hindi",
    "हिन्दी": "Hindi",
    "telugu": "Telugu",
    "తెలుగు": "Telugu",
    "kannada": "Kannada",
    "ಕನ್ನಡ": "Kannada",
    "malayalam": "Malayalam",
    "മലയാളം": "Malayalam",
    "marathi": "Marathi",
    "मराठी": "Marathi",
    "bengali": "Bengali",
    "বাংলা": "Bengali",
    "gujarati": "Gujarati",
    "ગુજરાતી": "Gujarati",
    "punjabi": "Punjabi",
    "ਪੰਜਾਬੀ": "Punjabi",
    "odia": "Odia",
    "ଓଡ଼ିଆ": "Odia",
    "assamese": "Assamese",
    "অসমীয়া": "Assamese",
    "urdu": "Urdu",
    "اردو": "Urdu",
    "other": "Other"
}

# State to regional languages mapping
STATE_LANGUAGES: Dict[str, List[str]] = {
    "Tamil Nadu": ["English", "Tamil"],
    "Kerala": ["English", "Malayalam"],
    "Karnataka": ["English", "Kannada"],
    "Andhra Pradesh": ["English", "Telugu"],
    "Telangana": ["English", "Telugu"],
    "Maharashtra": ["English", "Marathi"],
    "Gujarat": ["English", "Gujarati"],
    "Punjab": ["English", "Punjabi"],
    "West Bengal": ["English", "Bengali"],
    "Odisha": ["English", "Odia"],
    "Assam": ["English", "Assamese"],
    "Uttar Pradesh": ["English", "Hindi"],
    "Madhya Pradesh": ["English", "Hindi"],
    "Rajasthan": ["English", "Hindi"],
    "Bihar": ["English", "Hindi"],
    "Jharkhand": ["English", "Hindi"],
    "Haryana": ["English", "Hindi"],
    "Uttarakhand": ["English", "Hindi"],
    "Himachal Pradesh": ["English", "Hindi"],
    "Delhi": ["English", "Hindi"],
    "Goa": ["English", "Marathi"],
    "Jammu and Kashmir": ["English", "Urdu", "Hindi"],
    "Ladakh": ["English", "Hindi"],
    "Puducherry": ["English", "Tamil"],
    "Tripura": ["English", "Bengali"],
    "Meghalaya": ["English"],
    "Mizoram": ["English"],
    "Nagaland": ["English"],
    "Manipur": ["English"],
    "Sikkim": ["English"],
    "Chhattisgarh": ["English", "Hindi"],
    "Chandigarh": ["English", "Hindi", "Punjabi"],
    "Dadra and Nagar Haveli and Daman and Diu": ["English", "Gujarati", "Marathi", "Hindi"],
    "Andaman and Nicobar Islands": ["English", "Hindi", "Bengali"]
}

# Greeting phrases in different languages
GREETINGS: Dict[str, str] = {
    "English": "Welcome! I can assist you in multiple Indian languages.",
    "Tamil": "வணக்கம்! உங்களுக்கு என்ன உதவி வேண்டும்? உங்கள் கேள்வியை தமிழில் கேட்கலாம்.",
    "Hindi": "नमस्ते! मैं आपकी क्या सहायता कर सकता हूँ? आप अपना प्रश्न हिन्दी में पूछ सकते हैं।",
    "Telugu": "నమస్కారం! నేను మీకు ఎలా సహాయపడగలను? మీ ప్రశ్నను తెలుగులో అడగవచ్చు.",
    "Kannada": "ನಮಸ್ಕಾರ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕನ್ನಡದಲ್ಲಿ ಕೇಳಬಹುದು.",
    "Malayalam": "നമസ്കാരം! ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം? നിങ്ങളുടെ ചോദ്യം മലയാളത്തിൽ ചോദിക്കാം.",
    "Marathi": "नमस्कार! मी तुम्हाला कशी मदत करू शकतो? तुम्ही तुमचा प्रश्न मराठीत विचारू शकता.",
    "Bengali": "নমস্কার! আমি আপনাকে কীভাবে সাহায্য করতে পারি? আপনি আপনার প্রশ্ন বাংলায় জিজ্ঞাসা করতে পারেন।",
    "Gujarati": "નમસ્તે! હું તમને કેવી રીતે મદદ કરી શકું? તમે તમારો પ્રશ્ન ગુજરાતીમાં પૂછી શકો છો.",
    "Punjabi": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ? ਤੁਸੀਂ ਆਪਣਾ ਸਵਾਲ ਪੰਜਾਬੀ ਵਿੱਚ ਪੁੱਛ ਸਕਦੇ ਹੋ।",
    "Odia": "ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି? ଆପଣ ନିଜ ପ୍ରଶ୍ନ ଓଡ଼ିଆରେ ପଚାରିପାରିବେ।",
    "Assamese": "নমস্কাৰ! মই আপোনাক কেনেকৈ সহায় কৰিব পাৰোঁ? আপুনি আপোনাৰ প্ৰশ্ন অসমীয়াত সুধিব পাৰে।",
    "Urdu": "السلام علیکم! میں آپ کی کیا مدد کر سکتا ہوں؟ آپ اپنا سوال اردو میں پوچھ سکتے ہیں۔"
}

def get_suggested_languages(state: Optional[str]) -> List[str]:
    """Get suggested languages based on state."""
    if not state:
        return ["English"]
    
    # Normalize state string to match mapping keys
    normalized_state = state.strip().title()
    for key in STATE_LANGUAGES:
        if key.lower() == normalized_state.lower():
            return STATE_LANGUAGES[key]
            
    return ["English"]

def get_native_display_name(lang: str) -> str:
    """Get the native script display name for a language."""
    return SUPPORTED_LANGUAGES.get(lang, lang)

def detect_fast_language(text: str) -> Optional[str]:
    """Fast local detection of language based on Unicode character blocks and Romanized keywords."""
    import re
    if not text:
        return None
    
    # 1. Unicode Script Range Matching (100% accurate for native scripts)
    if re.search(r'[\u0B80-\u0BFF]', text):
        return "Tamil"
    if re.search(r'[\u0C00-\u0C7F]', text):
        return "Telugu"
    if re.search(r'[\u0C80-\u0CFF]', text):
        return "Kannada"
    if re.search(r'[\u0D00-\u0D7F]', text):
        return "Malayalam"
    if re.search(r'[\u0980-\u09FF]', text):
        return "Bengali"
    if re.search(r'[\u0A80-\u0AFF]', text):
        return "Gujarati"
    if re.search(r'[\u0A00-\u0A7F]', text):
        return "Punjabi"
    if re.search(r'[\u0B00-\u0B7F]', text):
        return "Odia"
    if re.search(r'[\u0600-\u06FF]', text):
        return "Urdu"
    if re.search(r'[\u0900-\u097F]', text):
        return "Hindi"

    # 2. Romanized keywords / Hinglish / Tanglish / Kanglish
    words = [w.lower() for w in re.findall(r'\b[a-zA-Z]+\b', text)]
    if not words:
        return None

    tamil_roman = {"enna", "iruku", "irukku", "eppadi", "solunga", "sollunga", "vanakkam", "thevai", "yethavathu", "edhavathu", "romba", "vendum"}
    hindi_roman = {"kya", "kaise", "batao", "bataiye", "chahiye", "hoga", "hota", "hai", "hain", "mujhe", "mera", "meri", "namaste", "madad", "yojanaen"}
    telugu_roman = {"emi", "ela", "unnadi", "cheppandi", "cheppandi", "namaskaram", "kavali", "undi"}
    kannada_roman = {"enu", "hege", "ide", "heli", "namaskara", "beku", "yavudu"}
    malayalam_roman = {"entha", "enganeyanu", "parayamo", "undo", "namaskaram", "sahayam"}

    word_set = set(words)
    if word_set & tamil_roman:
        return "Tamil"
    if word_set & hindi_roman:
        return "Hindi"
    if word_set & telugu_roman:
        return "Telugu"
    if word_set & kannada_roman:
        return "Kannada"
    if word_set & malayalam_roman:
        return "Malayalam"

    return None

def normalize_language_choice(text: str) -> Optional[str]:
    """Check if the text matches a supported language choice and return the standard English name."""
    text_clean = text.strip().lower()
    if not text_clean:
        return None
    
    # 1. Exact match in LANGUAGE_KEYS
    if text_clean in LANGUAGE_KEYS:
        return LANGUAGE_KEYS[text_clean]
        
    # 2. Match dropdown / option strings like "தமிழ் – Tamil" or "English"
    for lang, opt in SUPPORTED_LANGUAGES.items():
        if text_clean == opt.lower() or text_clean == lang.lower():
            return lang

    # 3. Check for exact native script matches in keys
    for key, value in LANGUAGE_KEYS.items():
        if len(key) >= 4 and key in text_clean:
            return value
            
    return None


