"""
Swasthika API — Pydantic schemas.

CitizenProfile fields are all Optional because the frontend questionnaire
is conditional. NULL means "not collected / unknown" — it must NOT be
treated as False or as an automatic disqualifier.

The deterministic engine uses NEEDS_MORE_INFORMATION when a mandatory
rule field is NULL.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any, Dict, List, Optional


class CitizenProfile(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "gender": "female",
                "age": 22,
                "marital_status": "never_married",
                "state": "Tamil Nadu",
                "residence_area": "rural",
                "community": "SC",
                "is_minority": False,
                "has_disability": False,
                "disability_percentage": None,
                "is_student": True,
                "employment_status": "unemployed",
                "occupation": "student",
                "is_bpl": True,
                "bpl_condition": "extreme_hardship",
                "family_income": 80000.0,
                "parent_guardian_income": 80000.0,
                "extra_attributes": {},
            }
        }
    )

    # ── Core identity ──────────────────────────────────────────────────────────
    gender: Optional[str] = None            # "male" | "female" | "transgender" | …
    age: Optional[int] = None
    marital_status: Optional[str] = None   # married | never_married | divorced | separated | widowed

    # ── Geography ─────────────────────────────────────────────────────────────
    state: Optional[str] = None            # canonical state name e.g. "Tamil Nadu"
    residence_area: Optional[str] = None   # "rural" | "urban"

    # ── Social category ───────────────────────────────────────────────────────
    community: Optional[str] = None        # general | OBC | SC | ST | PVTG | DNSNT
    is_minority: Optional[bool] = None

    # ── Disability ────────────────────────────────────────────────────────────
    has_disability: Optional[bool] = None
    disability_percentage: Optional[float] = None

    # ── Education / Student ───────────────────────────────────────────────────
    is_student: Optional[bool] = None

    # ── Employment ────────────────────────────────────────────────────────────
    employment_status: Optional[str] = None   # employed | unemployed | self_employed | entrepreneur
    occupation: Optional[str] = None

    # ── Economic status ───────────────────────────────────────────────────────
    is_bpl: Optional[bool] = None
    bpl_condition: Optional[str] = None        # destitution | penury | extreme_hardship | distress
    family_income: Optional[float] = None       # annual, in INR
    parent_guardian_income: Optional[float] = None

    # ── Extended attributes (collected via follow-up questions) ───────────────
    extra_attributes: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("age", "family_income", "parent_guardian_income", "disability_percentage", mode="before")
    @classmethod
    def coerce_numeric(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("is_minority", "has_disability", "is_student", "is_bpl", mode="before")
    @classmethod
    def coerce_bool(cls, v):
        if v == "" or v is None:
            return None
        if isinstance(v, str):
            low = v.strip().lower()
            if low in ("true", "1", "yes"):
                return True
            if low in ("false", "0", "no"):
                return False
        return v


class AuditCheck(BaseModel):
    """Result of evaluating a single mandatory rule against the CitizenProfile."""
    field: str
    result: str          # "PASS" | "FAIL" | "NEEDS_MORE_INFORMATION"
    user_value: Any
    required: Any


class AuditTrail(BaseModel):
    """Full audit record for a single scheme evaluation."""
    scheme_id: str
    status: str          # "ELIGIBLE" | "INELIGIBLE" | "NEEDS_MORE_INFORMATION"
    checks: List[AuditCheck]
    missing_fields: List[str] = Field(default_factory=list)
    failed_rule: Optional[str] = None


class FollowUpQuestion(BaseModel):
    """A follow-up question the frontend should ask to resolve NEEDS_MORE_INFORMATION."""
    field: str
    question: str


class NeedsMoreInfoEntry(BaseModel):
    """A scheme that could not be fully evaluated due to missing profile fields."""
    scheme_id: str
    scheme_name: str
    missing_fields: List[str]
    follow_up_questions: List[FollowUpQuestion]


class Recommendation(BaseModel):
    """A top-10 recommended scheme, with full auditability."""
    scheme_id: str
    scheme_name: str
    eligibility_status: str          # always "ELIGIBLE" for recommendations
    matched_conditions: List[dict]   # serialised AuditCheck list (for display)
    audit_trail: dict                # full audit, proves eligibility was from rule engine
    explanation: str                 # Gemini-generated natural language explanation
    official_url: Optional[str] = None
    application_url: Optional[str] = None
    preference_notes: Optional[str] = None   # preference rules that may be relevant

    @field_validator("official_url", "application_url", "preference_notes", mode="before")
    @classmethod
    def clean_optional_strings(cls, v):
        if v is None:
            return None
        # Check for float nan
        if isinstance(v, float):
            import math
            if math.isnan(v):
                return None
        s = str(v).strip()
        return s if s and s.lower() != "nan" else None



class EvaluationResponse(BaseModel):
    """Full API response from POST /api/swasthika/evaluate."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "total_schemes_evaluated": 4693,
                "eligible_count": 34,
                "needs_more_information_count": 7,
                "ineligible_count": 4652,
                "recommendations": [
                    {
                        "scheme_id": "post-matric-scholarship-for-sc-students",
                        "scheme_name": "Post Matric Scholarship for SC Students",
                        "eligibility_status": "ELIGIBLE",
                        "matched_conditions": [
                            {"field": "community", "result": "PASS", "user_value": "SC", "required": ["SC"]},
                            {"field": "is_student", "result": "PASS", "user_value": True, "required": True},
                            {"field": "family_income", "result": "PASS", "user_value": 80000, "required": 250000}
                        ],
                        "audit_trail": {
                            "scheme_id": "post-matric-scholarship-for-sc-students",
                            "status": "ELIGIBLE",
                            "missing_fields": [],
                            "failed_rule": None,
                            "checks": [
                                {"field": "community", "result": "PASS", "user_value": "SC", "required": ["SC"]}
                            ]
                        },
                        "explanation": "You are eligible because you belong to the SC community, are enrolled as a student, and your family income is within the required limit.",
                        "official_url": "https://scholarships.gov.in",
                        "application_url": "https://scholarships.gov.in/apply",
                        "preference_notes": None
                    }
                ],
                "needs_more_information": [],
                "missing_fields_summary": {}
            }
        }
    )

    status: str                              # "success"
    total_schemes_evaluated: int
    eligible_count: int
    needs_more_information_count: int
    ineligible_count: int
    recommendations: List[Recommendation]
    needs_more_information: List[NeedsMoreInfoEntry]
    missing_fields_summary: Dict[str, List[str]]  # field → [scheme_ids that need it]

