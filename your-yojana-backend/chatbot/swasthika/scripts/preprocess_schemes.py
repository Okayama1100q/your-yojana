import ast
import json
import os
from pathlib import Path
import pandas as pd

# Resolve paths relative to the swasthika package root
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_CSV_PATH = BASE_DIR / "data" / "raw" / "Schemes.csv"
PROCESSED_CSV_PATH = BASE_DIR / "data" / "processed" / "Swasthika_Eligibility_Normalized.csv"
REPORT_JSON_PATH = BASE_DIR / "data" / "reports" / "preprocessing_report.json"
REPORT_TXT_PATH = BASE_DIR / "data" / "reports" / "preprocessing_report.txt"
MANUAL_REVIEW_PATH = BASE_DIR / "data" / "reports" / "manual_review.csv"


def clean_array_string(val):
    if pd.isna(val) or str(val).strip() == "" or str(val).lower() == "nan":
        return []
    val_str = str(val).strip()
    if val_str.startswith("[") and val_str.endswith("]"):
        try:
            parsed = ast.literal_eval(val_str)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if str(v).strip()]
        except Exception:
            pass
    return [v.strip() for v in val_str.split(",") if v.strip()]


def parse_rules(row):
    mandatory_rules = []
    preference_rules = []
    requires_manual_review = False

    # 1. Age (Min and Max)
    if pd.notna(row.get("eligibility_age_min")):
        try:
            val = float(row["eligibility_age_min"])
            mandatory_rules.append({
                "field": "age",
                "operator": "greater_than_or_equal",
                "value": val,
                "requirement_type": "mandatory",
                "source": "eligibility_age_min",
                "source_evidence": str(row["eligibility_age_min"]),
            })
        except (ValueError, TypeError):
            pass

    if pd.notna(row.get("eligibility_age_max")):
        try:
            val = float(row["eligibility_age_max"])
            mandatory_rules.append({
                "field": "age",
                "operator": "less_than_or_equal",
                "value": val,
                "requirement_type": "mandatory",
                "source": "eligibility_age_max",
                "source_evidence": str(row["eligibility_age_max"]),
            })
        except (ValueError, TypeError):
            pass

    # 2. State
    # Requirement:
    # - state == "Central" or eligibility_state == ["All"] means universally applicable across India.
    # - Do NOT create state == "Central" as a citizen eligibility restriction.
    state_arr = []
    elig_state = row.get("eligibility_state")
    raw_state = row.get("state")

    if pd.notna(elig_state) and str(elig_state).strip() not in ["", "nan", '["All"]', "All", "Central"]:
        parsed = clean_array_string(elig_state)
        state_arr = [s for s in parsed if s.lower() not in ["all", "central", "nan", ""]]
    elif pd.notna(raw_state) and str(raw_state).strip() not in ["", "nan", "Central", "All"]:
        parsed = clean_array_string(raw_state)
        state_arr = [s for s in parsed if s.lower() not in ["all", "central", "nan", ""]]

    if state_arr:
        mandatory_rules.append({
            "field": "state",
            "operator": "in",
            "value": state_arr,
            "requirement_type": "mandatory",
            "source": "eligibility_state" if (pd.notna(elig_state) and str(elig_state).strip() not in ["", "nan", '["All"]', "All", "Central"]) else "state",
            "source_evidence": str(elig_state if state_arr else raw_state),
        })

    # 3. Gender
    if pd.notna(row.get("eligibility_gender")):
        g = str(row["eligibility_gender"]).lower().strip()
        if g not in ["all", "both", "any", "transgender, female, male", "none", ""]:
            if "female" in g or "women" in g or g == "girl":
                mandatory_rules.append({
                    "field": "gender",
                    "operator": "equals",
                    "value": "female",
                    "requirement_type": "mandatory",
                    "source": "eligibility_gender",
                    "source_evidence": str(row["eligibility_gender"]),
                })
            elif "male" in g and "female" not in g:
                mandatory_rules.append({
                    "field": "gender",
                    "operator": "equals",
                    "value": "male",
                    "requirement_type": "mandatory",
                    "source": "eligibility_gender",
                    "source_evidence": str(row["eligibility_gender"]),
                })
            elif "transgender" in g:
                mandatory_rules.append({
                    "field": "gender",
                    "operator": "equals",
                    "value": "transgender",
                    "requirement_type": "mandatory",
                    "source": "eligibility_gender",
                    "source_evidence": str(row["eligibility_gender"]),
                })

    # 4. Community / Caste
    if pd.notna(row.get("eligibility_caste")):
        castes = clean_array_string(row["eligibility_caste"])
        castes_clean = [c for c in castes if c.lower() not in ["all", "any", "none", "nan", ""]]
        all_major = {"SC", "ST", "OBC", "General"}
        if castes_clean and not all_major.issubset(set(castes_clean)):
            mandatory_rules.append({
                "field": "community",
                "operator": "in",
                "value": castes_clean,
                "requirement_type": "mandatory",
                "source": "eligibility_caste",
                "source_evidence": str(row["eligibility_caste"]),
            })

    # 5. Income Max
    if pd.notna(row.get("eligibility_income_max")):
        try:
            inc = float(row["eligibility_income_max"])
            if inc > 0:
                mandatory_rules.append({
                    "field": "family_income",
                    "operator": "less_than_or_equal",
                    "value": inc,
                    "requirement_type": "mandatory",
                    "source": "eligibility_income_max",
                    "source_evidence": str(row["eligibility_income_max"]),
                })
        except (ValueError, TypeError):
            pass

    # 6. BPL
    if str(row.get("eligibility_bpl")).lower() == "true":
        mandatory_rules.append({
            "field": "is_bpl",
            "operator": "equals",
            "value": True,
            "requirement_type": "mandatory",
            "source": "eligibility_bpl",
            "source_evidence": "True",
        })

    # 7. Disability
    if str(row.get("eligibility_disability")).lower() == "true":
        mandatory_rules.append({
            "field": "has_disability",
            "operator": "equals",
            "value": True,
            "requirement_type": "mandatory",
            "source": "eligibility_disability",
            "source_evidence": "True",
        })

    # 8. Residence Area
    if pd.notna(row.get("eligibility_residence")):
        res = str(row["eligibility_residence"]).lower().strip()
        if res == "rural":
            mandatory_rules.append({
                "field": "residence_area",
                "operator": "equals",
                "value": "rural",
                "requirement_type": "mandatory",
                "source": "eligibility_residence",
                "source_evidence": "rural",
            })
        elif res == "urban":
            mandatory_rules.append({
                "field": "residence_area",
                "operator": "equals",
                "value": "urban",
                "requirement_type": "mandatory",
                "source": "eligibility_residence",
                "source_evidence": "urban",
            })

    # 9. Preferences and Manual Review Indicators (isolated, never mandatory)
    if pd.notna(row.get("eligibility_text")):
        text = str(row["eligibility_text"]).lower()
        if any(keyword in text for keyword in ["preference", "priority", "tie-breaker", "relaxation", "reservation", "given preference"]):
            requires_manual_review = True
            preference_rules.append({
                "field": "unknown",
                "operator": "unknown",
                "value": "unknown",
                "requirement_type": "preference",
                "source": "eligibility_text",
                "source_evidence": str(row["eligibility_text"])[:200],
            })

    return mandatory_rules, preference_rules, requires_manual_review


def main():
    print(f"Loading raw schemes from: {RAW_CSV_PATH}...")
    df = pd.read_csv(RAW_CSV_PATH)
    initial_count = len(df)
    print(f"Loaded {initial_count} raw rows.")

    normalized_records = []
    manual_review_records = []

    total_mandatory = 0
    total_preference = 0
    schemes_with_rules = 0
    schemes_without_rules = 0
    field_counts = {}

    for _, row in df.iterrows():
        mandatory_rules, preference_rules, manual_review = parse_rules(row)

        record = row.to_dict()
        record["mandatory_rules"] = json.dumps(mandatory_rules)
        record["preference_rules"] = json.dumps(preference_rules)
        record["requires_manual_review"] = manual_review

        total_mandatory += len(mandatory_rules)
        total_preference += len(preference_rules)

        if len(mandatory_rules) > 0 or len(preference_rules) > 0:
            schemes_with_rules += 1
        else:
            schemes_without_rules += 1

        for rule in mandatory_rules:
            fld = rule["field"]
            field_counts[fld] = field_counts.get(fld, 0) + 1

        normalized_records.append(record)

        if manual_review:
            manual_review_records.append(record)

    norm_df = pd.DataFrame(normalized_records)
    norm_df.to_csv(PROCESSED_CSV_PATH, index=False)

    if manual_review_records:
        pd.DataFrame(manual_review_records).to_csv(MANUAL_REVIEW_PATH, index=False)
    else:
        pd.DataFrame(columns=norm_df.columns).to_csv(MANUAL_REVIEW_PATH, index=False)

    report = {
        "input_row_count": initial_count,
        "output_row_count": len(norm_df),
        "schemes_with_extracted_rules": schemes_with_rules,
        "schemes_without_extracted_rules": schemes_without_rules,
        "duplicate_scheme_ids": int(df["slug"].duplicated().sum()),
        "missing_scheme_ids": int(df["slug"].isna().sum()),
        "manual_review_count": len(manual_review_records),
        "mandatory_rule_count": total_mandatory,
        "preference_rule_count": total_preference,
        "mandatory_rules_by_field": field_counts,
    }

    with open(REPORT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=4)

    with open(REPORT_TXT_PATH, "w", encoding="utf-8") as f:
        for k, v in report.items():
            f.write(f"{k}: {v}\n")

    print(f"Preprocessing complete. Saved {len(norm_df)} schemes to {PROCESSED_CSV_PATH}")
    print(f"Report: {report}")


if __name__ == "__main__":
    PROCESSED_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    main()

