"""
operators.py — deterministic rule operators for the eligibility engine.

All operators are pure Python functions. No LLM, no ML, no similarity.

Supported operators:
    equals, not_equals
    greater_than, greater_than_or_equal
    less_than, less_than_or_equal
    in, not_in
    exists        (field must be truthy)
    not_exists    (field must be falsy/None)
"""


def evaluate_operator(operator: str, user_value, rule_value) -> bool:
    """
    Evaluate a single comparison between the citizen's value and the rule's value.

    Raises ValueError for unknown operators — the caller (evaluator.py)
    catches this and marks the check as FAIL rather than silently passing.
    """
    if user_value is None:
        # Handled upstream in evaluate_rule; this path should not be reached
        # for any operator that requires a value.
        return False

    op = operator.lower()

    if op == "equals":
        return str(user_value).lower() == str(rule_value).lower()

    elif op == "not_equals":
        return str(user_value).lower() != str(rule_value).lower()

    elif op == "greater_than":
        return float(user_value) > float(rule_value)

    elif op == "greater_than_or_equal":
        return float(user_value) >= float(rule_value)

    elif op == "less_than":
        return float(user_value) < float(rule_value)

    elif op == "less_than_or_equal":
        return float(user_value) <= float(rule_value)

    elif op == "in":
        # Canonical string array membership — case-insensitive.
        if isinstance(rule_value, list):
            return str(user_value).lower() in [str(r).lower() for r in rule_value]
        # Fallback: treat rule_value as a comma-separated string
        return str(user_value).lower() in [v.strip().lower() for v in str(rule_value).split(",")]

    elif op == "not_in":
        if isinstance(rule_value, list):
            return str(user_value).lower() not in [str(r).lower() for r in rule_value]
        return str(user_value).lower() not in [v.strip().lower() for v in str(rule_value).split(",")]

    elif op == "exists":
        # The field must be truthy (non-None, non-empty, non-False).
        return bool(user_value)

    elif op == "not_exists":
        return not bool(user_value)

    else:
        raise ValueError(f"Unknown operator: {operator!r}")
