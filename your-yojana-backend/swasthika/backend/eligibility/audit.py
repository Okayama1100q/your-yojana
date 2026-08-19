"""
Audit trail builder for the deterministic eligibility engine.

Every scheme evaluation generates a structured audit trail so that
Gemini (and human reviewers) can inspect exactly which rules were
evaluated, what the citizen's value was, what was required, and
whether the check passed, failed, or required more information.

Gemini receives this audit trail as grounding context — it never
participates in producing it.
"""

from typing import List, Optional
from swasthika.backend.schemas import AuditCheck, AuditTrail


def build_audit_trail(
    scheme_id: str,
    status: str,
    checks: List[AuditCheck],
    missing_fields: Optional[List[str]] = None,
    failed_rule: Optional[str] = None,
) -> AuditTrail:
    """
    Build a structured AuditTrail for a single scheme evaluation.

    Args:
        scheme_id:     The scheme slug/id.
        status:        "ELIGIBLE", "INELIGIBLE", or "NEEDS_MORE_INFORMATION".
        checks:        List of per-rule AuditCheck results.
        missing_fields: Fields that were required but not present in CitizenProfile.
        failed_rule:   JSON string of the first failing mandatory rule (for INELIGIBLE).

    Returns:
        AuditTrail with full per-check detail.
    """
    return AuditTrail(
        scheme_id=scheme_id,
        status=status,
        checks=checks,
        missing_fields=missing_fields or [],
        failed_rule=failed_rule,
    )


def format_audit_for_display(audit: AuditTrail) -> dict:
    """
    Serialise an AuditTrail to a plain dict suitable for inclusion in
    the API response and for passing to the Gemini explanation layer.
    """
    return {
        "scheme_id": audit.scheme_id,
        "status": audit.status,
        "missing_fields": audit.missing_fields,
        "failed_rule": audit.failed_rule,
        "checks": [
            {
                "field": c.field,
                "result": c.result,
                "user_value": c.user_value,
                "required": c.required,
            }
            for c in audit.checks
        ],
    }
