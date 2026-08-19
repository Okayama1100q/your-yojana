"""
evaluator.py — per-rule and per-scheme evaluation against a CitizenProfile.

Rules:
- FAIL on the first mandatory rule that fails → status = INELIGIBLE
- If a mandatory rule field is NULL in the profile → NEEDS_MORE_INFORMATION
- If a FAIL is found among any checks, INELIGIBLE takes priority over NMI
- Preference rules are NEVER evaluated for eligibility (they are ignored here)

No LLM, no ML, no semantic similarity is used here.
"""

import json
from typing import List, Optional, Tuple

from swasthika.backend.schemas import AuditCheck, CitizenProfile
from swasthika.backend.eligibility.operators import evaluate_operator


def _get_field_value(field: str, profile: CitizenProfile):
    """
    Retrieve a field value from the CitizenProfile.

    Falls back to extra_attributes for fields not declared in the model.
    Returns None if the field is absent or explicitly null.
    """
    if hasattr(profile, field):
        return getattr(profile, field)
    # Extended / follow-up fields stored in extra_attributes
    return profile.extra_attributes.get(field)


def evaluate_rule(rule: dict, profile: CitizenProfile) -> AuditCheck:
    """
    Evaluate a single mandatory rule against the CitizenProfile.

    Returns an AuditCheck with result:
      "PASS"                   — rule satisfied
      "FAIL"                   — rule violated → scheme is INELIGIBLE
      "NEEDS_MORE_INFORMATION" — required field is NULL/absent → cannot evaluate
    """
    field = rule.get("field", "")
    operator = rule.get("operator", "")
    required_value = rule.get("value")

    user_value = _get_field_value(field, profile)

    if user_value is None:
        return AuditCheck(
            field=field,
            result="NEEDS_MORE_INFORMATION",
            user_value=None,
            required=required_value,
        )

    try:
        passed = evaluate_operator(operator, user_value, required_value)
    except ValueError:
        # Unknown operator — treat as unresolvable, do not guess ELIGIBLE.
        return AuditCheck(
            field=field,
            result="NEEDS_MORE_INFORMATION",
            user_value=user_value,
            required=required_value,
        )
    except (TypeError, ValueError):
        # Type coercion failure (e.g. comparing non-numeric to a numeric rule).
        passed = False

    return AuditCheck(
        field=field,
        result="PASS" if passed else "FAIL",
        user_value=user_value,
        required=required_value,
    )


def evaluate_scheme(
    scheme_record: dict, profile: CitizenProfile
) -> Tuple[str, List[AuditCheck], List[str], Optional[str]]:
    """
    Evaluate all mandatory rules for one scheme.

    Preference rules are NEVER evaluated here — they cannot cause
    a citizen to be marked INELIGIBLE.

    Returns:
        status        — "ELIGIBLE" | "INELIGIBLE" | "NEEDS_MORE_INFORMATION"
        checks        — ordered list of AuditCheck for every rule evaluated
        missing_fields — field names that were absent from the profile
        failed_rule   — JSON string of the first failing rule (for audit), or None
    """
    raw = scheme_record.get("mandatory_rules", "[]")
    if isinstance(raw, str):
        try:
            mandatory_rules: list = json.loads(raw)
        except json.JSONDecodeError:
            mandatory_rules = []
    else:
        mandatory_rules = raw if isinstance(raw, list) else []

    checks: List[AuditCheck] = []
    missing_fields: List[str] = []
    failed_rule: Optional[str] = None
    has_fail = False
    has_missing = False

    for rule in mandatory_rules:
        check = evaluate_rule(rule, profile)
        checks.append(check)

        if check.result == "FAIL":
            has_fail = True
            if failed_rule is None:
                failed_rule = json.dumps(rule)
            # Continue evaluating so the audit trail is complete,
            # but we already know the status is INELIGIBLE.
        elif check.result == "NEEDS_MORE_INFORMATION":
            has_missing = True
            if check.field not in missing_fields:
                missing_fields.append(check.field)

    # Determine final status.
    # INELIGIBLE takes priority over NEEDS_MORE_INFORMATION.
    if has_fail:
        status = "INELIGIBLE"
    elif has_missing:
        status = "NEEDS_MORE_INFORMATION"
    else:
        status = "ELIGIBLE"

    return status, checks, missing_fields, failed_rule
