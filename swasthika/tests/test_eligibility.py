"""
Comprehensive deterministic eligibility tests.

Tests cover:
  - age (pass, fail, missing)
  - gender
  - state (canonical string arrays, membership, miss)
  - community (canonical string arrays, OR logic)
  - residence_area
  - family_income
  - parent_guardian_income
  - disability / disability_percentage
  - BPL / bpl_condition
  - minority
  - student / non-student
  - employment_status
  - occupation
  - marital_status
  - AND logic (multiple rules)
  - OR logic (in-array)
  - NOT logic (not_in, not_equals)
  - NEEDS_MORE_INFORMATION
  - INELIGIBLE wins over NEEDS_MORE_INFORMATION
  - preference rules NEVER cause rejection
  - exists / not_exists operators
  - determinism (identical inputs → identical results)
  - extra_attributes fallback
"""

import json
import pytest
from swasthika.backend.schemas import CitizenProfile
from swasthika.backend.eligibility.evaluator import evaluate_scheme


# ────────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────────

def scheme(slug: str, rules: list, prefs: list = None) -> dict:
    return {
        "slug": slug,
        "name": f"Test Scheme {slug}",
        "mandatory_rules": json.dumps(rules),
        "preference_rules": json.dumps(prefs or []),
    }


def rule(field, operator, value):
    return {
        "field": field,
        "operator": operator,
        "value": value,
        "requirement_type": "mandatory",
        "source": "test",
        "source_evidence": f"{field} {operator} {value}",
    }


def pref(field, value):
    return {
        "field": field,
        "operator": "equals",
        "value": value,
        "requirement_type": "preference",
        "source": "eligibility_text",
        "source_evidence": "Preference given to …",
    }


# ────────────────────────────────────────────────────────────────────────────────
# Age
# ────────────────────────────────────────────────────────────────────────────────

def test_age_min_pass():
    s = scheme("age-1", [rule("age", "greater_than_or_equal", 18)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=25))
    assert status == "ELIGIBLE"


def test_age_min_fail():
    s = scheme("age-2", [rule("age", "greater_than_or_equal", 18)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=16))
    assert status == "INELIGIBLE"


def test_age_max_pass():
    s = scheme("age-3", [rule("age", "less_than_or_equal", 35)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=30))
    assert status == "ELIGIBLE"


def test_age_max_fail():
    s = scheme("age-4", [rule("age", "less_than_or_equal", 35)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=40))
    assert status == "INELIGIBLE"


def test_age_range_pass():
    s = scheme("age-5", [
        rule("age", "greater_than_or_equal", 18),
        rule("age", "less_than_or_equal", 35),
    ])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=25))
    assert status == "ELIGIBLE"


def test_age_range_fail_below():
    s = scheme("age-6", [
        rule("age", "greater_than_or_equal", 18),
        rule("age", "less_than_or_equal", 35),
    ])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(age=15))
    assert status == "INELIGIBLE"


def test_age_missing():
    s = scheme("age-7", [rule("age", "greater_than_or_equal", 18)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "age" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Gender
# ────────────────────────────────────────────────────────────────────────────────

def test_gender_female_pass():
    s = scheme("gen-1", [rule("gender", "equals", "female")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="female"))
    assert status == "ELIGIBLE"


def test_gender_female_fail():
    s = scheme("gen-2", [rule("gender", "equals", "female")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="male"))
    assert status == "INELIGIBLE"


def test_gender_missing():
    s = scheme("gen-3", [rule("gender", "equals", "female")])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "gender" in missing


# ────────────────────────────────────────────────────────────────────────────────
# State — canonical string arrays
# ────────────────────────────────────────────────────────────────────────────────

def test_state_in_array_pass():
    s = scheme("st-1", [rule("state", "in", ["Tamil Nadu", "Kerala"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(state="Tamil Nadu"))
    assert status == "ELIGIBLE"


def test_state_in_array_case_insensitive():
    s = scheme("st-2", [rule("state", "in", ["Tamil Nadu", "Kerala"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(state="tamil nadu"))
    assert status == "ELIGIBLE"


def test_state_not_in_array_fail():
    s = scheme("st-3", [rule("state", "in", ["Tamil Nadu", "Kerala"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(state="Gujarat"))
    assert status == "INELIGIBLE"


def test_state_missing():
    s = scheme("st-4", [rule("state", "in", ["Tamil Nadu"])])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "state" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Community — canonical string arrays, OR logic via `in`
# ────────────────────────────────────────────────────────────────────────────────

def test_community_sc_pass():
    s = scheme("com-1", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="SC"))
    assert status == "ELIGIBLE"


def test_community_st_pass():
    s = scheme("com-2", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="ST"))
    assert status == "ELIGIBLE"


def test_community_obc_fail_sc_st_scheme():
    s = scheme("com-3", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="OBC"))
    assert status == "INELIGIBLE"


def test_community_general_in_general_scheme():
    s = scheme("com-4", [rule("community", "in", ["General", "OBC"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="General"))
    assert status == "ELIGIBLE"


def test_community_missing():
    s = scheme("com-5", [rule("community", "in", ["SC", "ST"])])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "community" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Residence
# ────────────────────────────────────────────────────────────────────────────────

def test_residence_rural_pass():
    s = scheme("res-1", [rule("residence_area", "equals", "rural")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(residence_area="rural"))
    assert status == "ELIGIBLE"


def test_residence_urban_fail_rural_scheme():
    s = scheme("res-2", [rule("residence_area", "equals", "rural")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(residence_area="urban"))
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# Family income
# ────────────────────────────────────────────────────────────────────────────────

def test_family_income_pass():
    s = scheme("inc-1", [rule("family_income", "less_than_or_equal", 250000)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(family_income=150000))
    assert status == "ELIGIBLE"


def test_family_income_fail():
    s = scheme("inc-2", [rule("family_income", "less_than_or_equal", 250000)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(family_income=500000))
    assert status == "INELIGIBLE"


def test_family_income_missing():
    s = scheme("inc-3", [rule("family_income", "less_than_or_equal", 250000)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "family_income" in missing


def test_parent_guardian_income_pass():
    s = scheme("inc-4", [rule("parent_guardian_income", "less_than_or_equal", 100000)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(parent_guardian_income=80000))
    assert status == "ELIGIBLE"


def test_parent_guardian_income_fail():
    s = scheme("inc-5", [rule("parent_guardian_income", "less_than_or_equal", 100000)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(parent_guardian_income=200000))
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# Disability
# ────────────────────────────────────────────────────────────────────────────────

def test_disability_required_pass():
    s = scheme("dis-1", [rule("has_disability", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(has_disability=True))
    assert status == "ELIGIBLE"


def test_disability_required_fail_no_disability():
    s = scheme("dis-2", [rule("has_disability", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(has_disability=False))
    assert status == "INELIGIBLE"


def test_disability_required_missing():
    s = scheme("dis-3", [rule("has_disability", "equals", True)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "has_disability" in missing


def test_disability_percentage_pass():
    s = scheme("dis-4", [rule("disability_percentage", "greater_than_or_equal", 40)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(has_disability=True, disability_percentage=60))
    assert status == "ELIGIBLE"


def test_disability_percentage_fail():
    s = scheme("dis-5", [rule("disability_percentage", "greater_than_or_equal", 40)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(has_disability=True, disability_percentage=30))
    assert status == "INELIGIBLE"


def test_disability_percentage_missing():
    s = scheme("dis-6", [rule("disability_percentage", "greater_than_or_equal", 40)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile(has_disability=True))
    assert status == "NEEDS_MORE_INFORMATION"
    assert "disability_percentage" in missing


# ────────────────────────────────────────────────────────────────────────────────
# BPL
# ────────────────────────────────────────────────────────────────────────────────

def test_bpl_pass():
    s = scheme("bpl-1", [rule("is_bpl", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_bpl=True))
    assert status == "ELIGIBLE"


def test_bpl_fail():
    s = scheme("bpl-2", [rule("is_bpl", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_bpl=False))
    assert status == "INELIGIBLE"


def test_bpl_missing():
    s = scheme("bpl-3", [rule("is_bpl", "equals", True)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "is_bpl" in missing


def test_bpl_condition_pass():
    s = scheme("bpl-4", [rule("bpl_condition", "in", ["destitution", "penury"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_bpl=True, bpl_condition="penury"))
    assert status == "ELIGIBLE"


def test_bpl_condition_fail():
    s = scheme("bpl-5", [rule("bpl_condition", "in", ["destitution", "penury"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_bpl=True, bpl_condition="distress"))
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# Minority
# ────────────────────────────────────────────────────────────────────────────────

def test_minority_pass():
    s = scheme("min-1", [rule("is_minority", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_minority=True))
    assert status == "ELIGIBLE"


def test_minority_fail():
    s = scheme("min-2", [rule("is_minority", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_minority=False))
    assert status == "INELIGIBLE"


def test_minority_missing():
    s = scheme("min-3", [rule("is_minority", "equals", True)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "is_minority" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Student
# ────────────────────────────────────────────────────────────────────────────────

def test_student_pass():
    s = scheme("stu-1", [rule("is_student", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_student=True))
    assert status == "ELIGIBLE"


def test_non_student_fails_student_scheme():
    s = scheme("stu-2", [rule("is_student", "equals", True)])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(is_student=False))
    assert status == "INELIGIBLE"


def test_student_missing():
    s = scheme("stu-3", [rule("is_student", "equals", True)])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "is_student" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Employment status & occupation
# ────────────────────────────────────────────────────────────────────────────────

def test_employment_status_pass():
    s = scheme("emp-1", [rule("employment_status", "equals", "unemployed")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(employment_status="unemployed"))
    assert status == "ELIGIBLE"


def test_employment_status_fail():
    s = scheme("emp-2", [rule("employment_status", "equals", "unemployed")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(employment_status="employed"))
    assert status == "INELIGIBLE"


def test_occupation_farmer_pass():
    s = scheme("occ-1", [rule("occupation", "equals", "farmer")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(occupation="farmer"))
    assert status == "ELIGIBLE"


def test_occupation_farmer_fail():
    s = scheme("occ-2", [rule("occupation", "equals", "farmer")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(occupation="artisan"))
    assert status == "INELIGIBLE"


def test_occupation_missing():
    s = scheme("occ-3", [rule("occupation", "equals", "farmer")])
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile())
    assert status == "NEEDS_MORE_INFORMATION"
    assert "occupation" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Marital status
# ────────────────────────────────────────────────────────────────────────────────

def test_marital_status_widowed_pass():
    s = scheme("mar-1", [rule("marital_status", "equals", "widowed")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(marital_status="widowed"))
    assert status == "ELIGIBLE"


def test_marital_status_widowed_fail():
    s = scheme("mar-2", [rule("marital_status", "equals", "widowed")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(marital_status="married"))
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# AND logic — multiple mandatory rules
# ────────────────────────────────────────────────────────────────────────────────

def test_and_all_pass():
    s = scheme("and-1", [
        rule("gender", "equals", "female"),
        rule("community", "in", ["SC", "ST"]),
        rule("age", "greater_than_or_equal", 18),
    ])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="female", community="SC", age=22))
    assert status == "ELIGIBLE"


def test_and_one_fails():
    s = scheme("and-2", [
        rule("gender", "equals", "female"),
        rule("community", "in", ["SC", "ST"]),
        rule("age", "greater_than_or_equal", 18),
    ])
    # community fails
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="female", community="General", age=22))
    assert status == "INELIGIBLE"


def test_and_one_missing():
    s = scheme("and-3", [
        rule("gender", "equals", "female"),
        rule("community", "in", ["SC", "ST"]),
        rule("age", "greater_than_or_equal", 18),
    ])
    # age is missing → NMI; gender & community pass
    status, _, missing, _ = evaluate_scheme(s, CitizenProfile(gender="female", community="SC"))
    assert status == "NEEDS_MORE_INFORMATION"
    assert "age" in missing


def test_and_fail_beats_missing():
    """INELIGIBLE must take priority over NEEDS_MORE_INFORMATION."""
    s = scheme("and-4", [
        rule("gender", "equals", "female"),    # FAIL
        rule("age", "greater_than_or_equal", 18),  # MISSING
    ])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="male"))
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# OR logic — implemented via `in` operator on array values
# ────────────────────────────────────────────────────────────────────────────────

def test_or_sc_or_st_sc_passes():
    """'SC or ST' expressed as community in ["SC", "ST"]."""
    s = scheme("or-1", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="SC"))
    assert status == "ELIGIBLE"


def test_or_sc_or_st_st_passes():
    s = scheme("or-2", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="ST"))
    assert status == "ELIGIBLE"


def test_or_sc_or_st_general_fails():
    s = scheme("or-3", [rule("community", "in", ["SC", "ST"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(community="General"))
    assert status == "INELIGIBLE"


def test_or_states():
    """State must be one of several — OR via `in`."""
    s = scheme("or-4", [rule("state", "in", ["Tamil Nadu", "Puducherry", "Kerala"])])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(state="Puducherry"))
    assert status == "ELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# NOT / negation
# ────────────────────────────────────────────────────────────────────────────────

def test_not_equals_pass():
    """Scheme open to any gender except male."""
    s = scheme("not-1", [rule("gender", "not_equals", "male")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="female"))
    assert status == "ELIGIBLE"


def test_not_equals_fail():
    s = scheme("not-2", [rule("gender", "not_equals", "male")])
    status, _, _, _ = evaluate_scheme(s, CitizenProfile(gender="male"))
    assert status == "INELIGIBLE"


def test_not_in_pass():
    """Scheme excludes taxpayers via not_equals on is_taxpayer."""
    s = scheme("not-3", [rule("is_taxpayer", "equals", False)])
    status, _, _, _ = evaluate_scheme(
        s, CitizenProfile(extra_attributes={"is_taxpayer": False})
    )
    assert status == "ELIGIBLE"


def test_not_in_fail():
    s = scheme("not-4", [rule("is_taxpayer", "equals", False)])
    status, _, _, _ = evaluate_scheme(
        s, CitizenProfile(extra_attributes={"is_taxpayer": True})
    )
    assert status == "INELIGIBLE"


# ────────────────────────────────────────────────────────────────────────────────
# Preference rules NEVER cause rejection
# ────────────────────────────────────────────────────────────────────────────────

def test_preference_rules_never_reject():
    """
    A scheme with no mandatory rules and only a preference rule should return
    ELIGIBLE for any complete-enough profile, because preference rules are
    never evaluated by the eligibility engine.
    """
    s = {
        "slug": "pref-1",
        "name": "Preference Test Scheme",
        "mandatory_rules": "[]",
        "preference_rules": json.dumps([pref("community", "SC")]),
    }
    # OBC citizen — preference is for SC, but that must not cause INELIGIBLE.
    status, checks, _, _ = evaluate_scheme(s, CitizenProfile(community="OBC"))
    assert status == "ELIGIBLE"
    assert len(checks) == 0   # no mandatory rules evaluated


def test_preference_rule_not_in_mandatory_checks():
    """Preference rules must produce zero AuditChecks."""
    s = {
        "slug": "pref-2",
        "name": "Pref Test 2",
        "mandatory_rules": json.dumps([rule("age", "greater_than_or_equal", 18)]),
        "preference_rules": json.dumps([pref("gender", "female")]),
    }
    profile = CitizenProfile(age=25, gender="male")
    status, checks, _, _ = evaluate_scheme(s, profile)
    assert status == "ELIGIBLE"
    # Only one mandatory check (age) — preference check must NOT appear.
    assert len(checks) == 1
    assert checks[0].field == "age"


# ────────────────────────────────────────────────────────────────────────────────
# Determinism — same input always produces same output
# ────────────────────────────────────────────────────────────────────────────────

def test_determinism():
    """Two calls with identical inputs must produce identical outputs."""
    s = scheme("det-1", [
        rule("gender", "equals", "female"),
        rule("state", "in", ["Tamil Nadu"]),
        rule("age", "greater_than_or_equal", 18),
        rule("community", "in", ["SC", "ST"]),
    ])
    profile = CitizenProfile(gender="female", state="Tamil Nadu", age=22, community="SC")
    result1 = evaluate_scheme(s, profile)
    result2 = evaluate_scheme(s, profile)
    assert result1[0] == result2[0]
    assert [c.result for c in result1[1]] == [c.result for c in result2[1]]


# ────────────────────────────────────────────────────────────────────────────────
# extra_attributes fallback (for extended follow-up fields)
# ────────────────────────────────────────────────────────────────────────────────

def test_extra_attributes_field_pass():
    s = scheme("ext-1", [rule("land_ownership", "exists", True)])
    profile = CitizenProfile(extra_attributes={"land_ownership": "2 hectares"})
    status, _, _, _ = evaluate_scheme(s, profile)
    assert status == "ELIGIBLE"


def test_extra_attributes_field_missing():
    s = scheme("ext-2", [rule("land_ownership", "exists", True)])
    profile = CitizenProfile()  # land_ownership absent
    status, _, missing, _ = evaluate_scheme(s, profile)
    assert status == "NEEDS_MORE_INFORMATION"
    assert "land_ownership" in missing


# ────────────────────────────────────────────────────────────────────────────────
# Complete synthetic citizen profiles
# ────────────────────────────────────────────────────────────────────────────────

STUDENT_PROFILE = CitizenProfile(
    gender="female",
    age=20,
    state="Tamil Nadu",
    community="SC",
    is_student=True,
    is_bpl=True,
    family_income=80000,
)

DISABLED_PROFILE = CitizenProfile(
    gender="male",
    age=35,
    state="Kerala",
    community="OBC",
    has_disability=True,
    disability_percentage=50,
    employment_status="unemployed",
)

NON_STUDENT_EMPLOYED_PROFILE = CitizenProfile(
    gender="male",
    age=30,
    state="Gujarat",
    community="General",
    is_student=False,
    employment_status="employed",
    occupation="farmer",
    family_income=200000,
    is_bpl=False,
)

MINORITY_WIDOW_PROFILE = CitizenProfile(
    gender="female",
    age=45,
    state="Rajasthan",
    community="OBC",
    is_minority=True,
    marital_status="widowed",
    residence_area="rural",
    is_bpl=True,
)


def test_student_profile_student_scheme():
    s = scheme("sp-1", [
        rule("is_student", "equals", True),
        rule("community", "in", ["SC", "ST"]),
        rule("gender", "equals", "female"),
    ])
    status, _, _, _ = evaluate_scheme(s, STUDENT_PROFILE)
    assert status == "ELIGIBLE"


def test_student_profile_employment_scheme():
    """A scheme requiring employment should fail for a student profile."""
    s = scheme("sp-2", [rule("employment_status", "equals", "employed")])
    status, _, _, _ = evaluate_scheme(s, STUDENT_PROFILE)
    assert status == "NEEDS_MORE_INFORMATION"  # employment_status not collected for students


def test_disabled_profile_disability_scheme():
    s = scheme("dp-1", [
        rule("has_disability", "equals", True),
        rule("disability_percentage", "greater_than_or_equal", 40),
    ])
    status, _, _, _ = evaluate_scheme(s, DISABLED_PROFILE)
    assert status == "ELIGIBLE"


def test_non_disabled_fails_disability_scheme():
    s = scheme("dp-2", [rule("has_disability", "equals", True)])
    status, _, _, _ = evaluate_scheme(
        s, CitizenProfile(has_disability=False, age=30, state="Kerala")
    )
    assert status == "INELIGIBLE"


def test_farmer_profile_agriculture_scheme():
    s = scheme("fp-1", [
        rule("occupation", "equals", "farmer"),
        rule("state", "in", ["Gujarat", "Maharashtra"]),
    ])
    status, _, _, _ = evaluate_scheme(s, NON_STUDENT_EMPLOYED_PROFILE)
    assert status == "ELIGIBLE"


def test_minority_widow_rural_scheme():
    s = scheme("mw-1", [
        rule("is_minority", "equals", True),
        rule("marital_status", "equals", "widowed"),
        rule("residence_area", "equals", "rural"),
    ])
    status, _, _, _ = evaluate_scheme(s, MINORITY_WIDOW_PROFILE)
    assert status == "ELIGIBLE"
