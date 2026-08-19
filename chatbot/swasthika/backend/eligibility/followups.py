"""
Follow-up question generator for NEEDS_MORE_INFORMATION cases.

When the deterministic engine cannot evaluate a mandatory rule because
the CitizenProfile field is NULL/missing, the system should surface
a follow-up question to the frontend rather than guessing.

This module maps field names to human-readable follow-up prompts
that the YorYojana frontend can display to the citizen.

IMPORTANT: This module never determines or changes eligibility.
It only identifies what additional information is needed.
"""

from typing import List, Dict


# Map of profile field → human-readable follow-up prompt.
# Only fields that appear in actual mandatory rules are included.
FOLLOW_UP_PROMPTS: Dict[str, str] = {
    "age": "What is your age?",
    "gender": "What is your gender?",
    "state": "Which state do you live in?",
    "residence_area": "Do you live in a rural or urban area?",
    "community": "Which community category do you belong to? (General, OBC, SC, ST, etc.)",
    "has_disability": "Do you have a disability?",
    "disability_percentage": "What is your disability percentage?",
    "is_minority": "Do you belong to a notified minority community?",
    "is_student": "Are you currently a student?",
    "employment_status": "What is your employment status? (Employed, Unemployed, Self-employed, Entrepreneur)",
    "occupation": "What is your occupation?",
    "is_bpl": "Is your household below the poverty line (BPL)?",
    "bpl_condition": "Which of the following best describes your situation? (Destitution, Penury, Extreme hardship, Distress)",
    "family_income": "What is your annual family income?",
    "parent_guardian_income": "What is your parent/guardian's annual income?",
    "marital_status": "What is your marital status?",
    # Extended fields from the dataset
    "education_level": "What is your highest level of education?",
    "land_ownership": "Do you own agricultural land? If so, how many hectares/acres?",
    "is_taxpayer": "Are you a taxpayer?",
}


def get_followup_prompts(missing_fields: List[str]) -> List[Dict[str, str]]:
    """
    Given a list of missing CitizenProfile field names, return a list
    of follow-up question objects for the frontend to display.

    Fields not in FOLLOW_UP_PROMPTS are returned with a generic prompt
    so no information is silently dropped.
    """
    prompts = []
    for field in missing_fields:
        prompt = FOLLOW_UP_PROMPTS.get(
            field,
            f"Please provide information about: {field}",
        )
        prompts.append({"field": field, "question": prompt})
    return prompts


def summarise_needs_more_info(needs_more_info_schemes: List[dict]) -> Dict[str, List[str]]:
    """
    Aggregate all missing fields across NEEDS_MORE_INFORMATION schemes.

    Returns a dict mapping field_name → list of scheme_ids that require it.
    This lets the frontend ask each question once even if multiple schemes
    need the same piece of information.
    """
    field_to_schemes: Dict[str, List[str]] = {}
    for scheme in needs_more_info_schemes:
        scheme_id = scheme.get("slug", "unknown")
        for field in scheme.get("_missing", []):
            if field not in field_to_schemes:
                field_to_schemes[field] = []
            field_to_schemes[field].append(scheme_id)
    return field_to_schemes
