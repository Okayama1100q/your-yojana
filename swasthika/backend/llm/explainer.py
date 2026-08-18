import os
from google import genai
from swasthika.backend.config import settings
from swasthika.backend.schemas import CitizenProfile

def generate_explanation(scheme_record: dict, profile: CitizenProfile, audit_checks: list) -> str:
    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
    
    # Grounded fallback explanation from verified deterministic checks
    passed_items = [f"{c.field} ({c.user_value})" for c in audit_checks if c.result == "PASS"]
    scheme_name = scheme_record.get("name", "this scheme")
    base_explanation = (
        f"You are eligible for {scheme_name} based on verified matching criteria: {', '.join(passed_items)}."
        if passed_items
        else f"You are eligible for {scheme_name} as a universally applicable scheme."
    )

    if not api_key:
        return base_explanation

    try:
        client = genai.Client(api_key=api_key)
        
        # Format the audit checks
        checks_str = "\n".join([f"- {c.field}: {c.result} (Required: {c.required}, User had: {c.user_value})" for c in audit_checks])
        
        prompt = f"""
        You are an explanation engine for government scheme eligibility.
        Your ONLY job is to explain WHY this citizen is recommended for this scheme based strictly on the provided verified audit trail.
        
        DO NOT invent new eligibility conditions. DO NOT evaluate eligibility.
        
        Scheme Name: {scheme_record.get('name', 'Unknown Scheme')}
        Scheme Description: {scheme_record.get('description', 'N/A')}
        Official URL: {scheme_record.get('official_url', 'N/A')}
        
        Citizen Profile:
        {profile.model_dump_json(indent=2, exclude_none=True)}
        
        Deterministic Audit Checks (These are the rules the citizen passed):
        {checks_str}
        
        Provide a concise 1-2 sentence explanation stating why the scheme matched the citizen's profile.
        """
        
        model_name = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        return response.text.strip()
        
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "QuotaFailure" in err_str:
            notice = "AI service quota/rate limit reached; deterministic explanation provided."
        else:
            notice = f"AI service note: {err_str[:120]}"
        return f"{base_explanation} ({notice})"




