"""
Swasthika FastAPI application.

Pipeline (enforced by code order — Gemini is unreachable from the eligibility path):

  CitizenProfile (from YorYojana backend)
      ↓
  Authenticate X-SWASTHIKA-API-KEY
      ↓
  DeterministicEngine.evaluate_all()        ← pure Python, NO LLM, NO ML
      ↓
  ELIGIBLE / INELIGIBLE / NEEDS_MORE_INFORMATION
      ↓
  eligible_schemes only → BM25Retriever.index() → retrieve() → top 10
      ↓
  generate_explanation() for each of top 10  ← Gemini, explanation ONLY
      ↓
  EvaluationResponse (JSON)
"""

import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Header

from swasthika.backend.config import settings
from swasthika.backend.eligibility.audit import build_audit_trail, format_audit_for_display
from swasthika.backend.eligibility.engine import DeterministicEngine
from swasthika.backend.eligibility.followups import get_followup_prompts, summarise_needs_more_info
from swasthika.backend.llm.explainer import generate_explanation
from swasthika.backend.rag.retriever import BM25Retriever
from swasthika.backend.schemas import (
    CitizenProfile,
    EvaluationResponse,
    FollowUpQuestion,
    NeedsMoreInfoEntry,
    Recommendation,
)

# ── Singleton instances ────────────────────────────────────────────────────────
engine = DeterministicEngine()
retriever = BM25Retriever()


# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load the normalised scheme data once
    engine.load()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Swasthika API",
    description=(
        "Agent 1 of YorYojana — deterministic government-scheme eligibility engine. "
        "Eligibility is determined exclusively by a Python rule engine. "
        "Gemini is used only for explanation generation after eligibility is determined."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, float):
        import math
        if math.isnan(val):
            return None
    s = str(val).strip()
    return s if s and s.lower() != "nan" else None


# ── Authentication ─────────────────────────────────────────────────────────────
def verify_api_key(x_swasthika_api_key: Optional[str] = Header(None)) -> None:
    """
    Validate the service-to-service API key.

    The key is loaded from SWASTHIKA_API_KEY in .env.
    It is never logged, returned in responses, or exposed to the frontend.
    """
    configured_key = settings.swasthika_api_key
    if not configured_key:
        raise HTTPException(
            status_code=500,
            detail="Swasthika is not configured with an API key. Set SWASTHIKA_API_KEY in .env.",
        )
    if x_swasthika_api_key != configured_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-SWASTHIKA-API-KEY header.")


# ── Main evaluation endpoint ───────────────────────────────────────────────────
@app.post("/api/swasthika/evaluate", response_model=EvaluationResponse)
def evaluate_schemes(
    profile: CitizenProfile,
    _auth: None = Depends(verify_api_key),
) -> EvaluationResponse:
    """
    Evaluate all schemes against the CitizenProfile.

    Execution order:
      1. Deterministic rule engine → ELIGIBLE / INELIGIBLE / NEEDS_MORE_INFORMATION
      2. BM25 ranking over ELIGIBLE pool only → top 10
      3. Gemini explanation for each of the top 10 (never affects eligibility)
    """

    # ── Step 1: Deterministic eligibility evaluation ───────────────────────────
    # No LLM, no ML, no embeddings, no semantic similarity.
    total_candidates = len(engine._records) if engine._records else 0
    eligible_schemes, needs_more_info_schemes, ineligible_count = engine.evaluate_all(profile)
    total_evaluated = len(engine._records)

    print(
        f"[evaluate] Total schemes in engine: {total_candidates} | "
        f"Evaluated: {total_evaluated} | "
        f"Eligible: {len(eligible_schemes)} | "
        f"Needs More Info: {len(needs_more_info_schemes)} | "
        f"Ineligible: {ineligible_count}"
    )

    # ── Step 2: BM25 ranking — ONLY over already-ELIGIBLE schemes ─────────────
    retriever.index(eligible_schemes)

    # Build a relevance query from profile fields for BM25 ranking.
    # This affects ordering only — eligibility has already been determined.
    query_parts = [
        profile.state or "",
        profile.community or "",
        profile.occupation or "",
        profile.gender or "",
        profile.employment_status or "",
    ]
    query = " ".join(p for p in query_parts if p).strip()

    if query:
        top_10 = retriever.retrieve(query, top_n=10)
    else:
        # No discriminating profile terms — return first 10 by dataset order.
        top_10 = eligible_schemes[:10]

    # ── Step 3: Build recommendations with Gemini explanations ────────────────
    # Gemini receives only already-determined ELIGIBLE schemes and their audit trails.
    # It cannot change eligibility status.
    recommendations: list[Recommendation] = []
    for scheme in top_10:
        audit_checks = scheme.get("_audit_checks", [])
        preference_rules_str = scheme.get("preference_rules", "[]")

        audit = build_audit_trail(
            scheme_id=str(scheme.get("slug", "")),
            status="ELIGIBLE",
            checks=audit_checks,
        )
        audit_dict = format_audit_for_display(audit)

        matched_conditions = [
            {
                "field": c.field,
                "result": c.result,
                "user_value": c.user_value,
                "required": c.required,
            }
            for c in audit_checks
            if c.result == "PASS"
        ]

        # Gemini explanation — grounded entirely in the audit trail above.
        explanation = generate_explanation(scheme, profile, audit_checks)

        recommendations.append(
            Recommendation(
                scheme_id=str(scheme.get("slug", "")),
                scheme_name=_clean_str(scheme.get("name")) or "Scheme",
                eligibility_status="ELIGIBLE",
                matched_conditions=matched_conditions,
                audit_trail=audit_dict,
                explanation=explanation,
                official_url=_clean_str(scheme.get("official_url")),
                application_url=_clean_str(scheme.get("apply_url")),
                preference_notes=(
                    preference_rules_str
                    if preference_rules_str and preference_rules_str != "[]" and preference_rules_str != "nan"
                    else None
                ),
            )
        )


    # ── Step 4: Build NEEDS_MORE_INFORMATION entries ───────────────────────────
    needs_more_info_entries: list[NeedsMoreInfoEntry] = []
    for scheme in needs_more_info_schemes:
        missing = scheme.get("_missing", [])
        follow_ups = [
            FollowUpQuestion(field=fq["field"], question=fq["question"])
            for fq in get_followup_prompts(missing)
        ]
        needs_more_info_entries.append(
            NeedsMoreInfoEntry(
                scheme_id=scheme["slug"],
                scheme_name=scheme.get("name", ""),
                missing_fields=missing,
                follow_up_questions=follow_ups,
            )
        )

    missing_fields_summary = summarise_needs_more_info(needs_more_info_schemes)

    return EvaluationResponse(
        status="success",
        total_schemes_evaluated=total_evaluated,
        eligible_count=len(eligible_schemes),
        needs_more_information_count=len(needs_more_info_schemes),
        ineligible_count=ineligible_count,
        recommendations=recommendations,
        needs_more_information=needs_more_info_entries,
        missing_fields_summary=missing_fields_summary,
    )
