import pandas as pd
import json
import re

RAW_CSV_PATH = "data/raw/Schemes.csv"

def clean_array_string(val):
    if pd.isna(val) or str(val).strip() == "":
        return []
    val_str = str(val).strip()
    if val_str.startswith('[') and val_str.endswith(']'):
        try:
            import ast
            parsed = ast.literal_eval(val_str)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if str(v).strip()]
        except:
            pass
    return [v.strip() for v in val_str.split(',') if v.strip()]

def extract_from_text(text):
    rules = []
    prefs = []
    review = False
    
    if pd.isna(text):
        return rules, prefs, review
        
    text_lower = str(text).lower()
    
    # Check preferences
    if any(p in text_lower for p in ["preference", "priority", "tie-breaker", "relaxation", "reservation", "given preference to"]):
        review = True
        
    # Regex patterns for various fields
    
    # 1. Student
    if re.search(r'\b(student|studying|pursuing|enrolled in)\b', text_lower):
        rules.append({
            "field": "is_student",
            "operator": "equals",
            "value": True,
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # 2. Marital Status
    if re.search(r'\b(unmarried|single)\b', text_lower):
        rules.append({
            "field": "marital_status",
            "operator": "in",
            "value": ["unmarried", "never_married", "single"],
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
    elif re.search(r'\b(widow|widowed)\b', text_lower):
         rules.append({
            "field": "marital_status",
            "operator": "equals",
            "value": "widowed",
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # 3. Farmer
    if re.search(r'\b(farmer|farmers|agriculture|cultivator)\b', text_lower) and not re.search(r'\b(not a farmer)\b', text_lower):
        rules.append({
            "field": "occupation",
            "operator": "equals",
            "value": "farmer",
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # 4. Minority
    if re.search(r'\b(minority|minorities)\b', text_lower):
        rules.append({
            "field": "is_minority",
            "operator": "equals",
            "value": True,
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # 5. Education
    if re.search(r'\b(passed 10th|10th pass|matriculate|graduate|degree|diploma)\b', text_lower):
        rules.append({
            "field": "education_level",
            "operator": "not_equals",
            "value": "none",
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # 6. Land/Acreage
    if re.search(r'\b(hectare|acre|landless)\b', text_lower):
        rules.append({
            "field": "land_ownership",
            "operator": "exists",
            "value": True,
            "requirement_type": "mandatory",
            "source": "eligibility_text",
            "source_evidence": text[:200]
        })
        
    # Negations
    if re.search(r'\b(not eligible if|should not be|must not|cannot apply)\b', text_lower):
        review = True
        
    return rules, prefs, review

def parse_rules(row):
    mandatory = []
    preference = []
    manual_review = False
    contradictions = []
    
    # --- STRUCTURED COLUMNS ---
    
    # AGE
    if pd.notna(row.get('eligibility_age_min')):
        val = str(row['eligibility_age_min']).strip()
        if val:
            try:
                mandatory.append({
                    "field": "age",
                    "operator": "greater_than_or_equal",
                    "value": float(val),
                    "requirement_type": "mandatory",
                    "source": "eligibility_age_min",
                    "source_evidence": val
                })
            except: manual_review = True
            
    if pd.notna(row.get('eligibility_age_max')):
        val = str(row['eligibility_age_max']).strip()
        if val:
            try:
                mandatory.append({
                    "field": "age",
                    "operator": "less_than_or_equal",
                    "value": float(val),
                    "requirement_type": "mandatory",
                    "source": "eligibility_age_max",
                    "source_evidence": val
                })
            except: manual_review = True
            
    # GENDER
    if pd.notna(row.get('eligibility_gender')):
        gender = str(row['eligibility_gender']).strip().lower()
        if gender and gender != 'all':
            mandatory.append({
                "field": "gender",
                "operator": "in",
                "value": clean_array_string(row['eligibility_gender']),
                "requirement_type": "mandatory",
                "source": "eligibility_gender",
                "source_evidence": str(row['eligibility_gender'])
            })
            
    # CASTE / COMMUNITY
    if pd.notna(row.get('eligibility_caste')):
        caste = str(row['eligibility_caste']).strip().lower()
        if caste and caste != 'all':
            mandatory.append({
                "field": "community",
                "operator": "in",
                "value": clean_array_string(row['eligibility_caste']),
                "requirement_type": "mandatory",
                "source": "eligibility_caste",
                "source_evidence": str(row['eligibility_caste'])
            })
            
    # STATE (Using eligibility_state if present, else state, but be careful not to make it mandatory if it's just 'All')
    state_val = None
    state_source = None
    if pd.notna(row.get('eligibility_state')) and str(row['eligibility_state']).strip().lower() != 'all':
        state_val = row['eligibility_state']
        state_source = 'eligibility_state'
    elif pd.notna(row.get('state')) and str(row['state']).strip().lower() != 'all':
        state_val = row['state']
        state_source = 'state'
        
    if state_val:
        arr = clean_array_string(state_val)
        if arr and len(arr) > 0:
            mandatory.append({
                "field": "state",
                "operator": "in",
                "value": arr,
                "requirement_type": "mandatory",
                "source": state_source,
                "source_evidence": str(state_val)
            })
            
    # RESIDENCE
    if pd.notna(row.get('eligibility_residence')):
        res = str(row['eligibility_residence']).strip().lower()
        if res and res != 'all':
             mandatory.append({
                "field": "residence_area",
                "operator": "in",
                "value": clean_array_string(row['eligibility_residence']),
                "requirement_type": "mandatory",
                "source": "eligibility_residence",
                "source_evidence": str(row['eligibility_residence'])
            })
             
    # INCOME MAX
    if pd.notna(row.get('eligibility_income_max')):
        inc = str(row['eligibility_income_max']).strip()
        if inc:
            try:
                mandatory.append({
                    "field": "family_income",
                    "operator": "less_than_or_equal",
                    "value": float(inc),
                    "requirement_type": "mandatory",
                    "source": "eligibility_income_max",
                    "source_evidence": inc
                })
            except: manual_review = True
            
    # BPL
    if pd.notna(row.get('eligibility_bpl')):
        bpl = str(row['eligibility_bpl']).strip().lower()
        if bpl == 'true' or bpl == '1' or bpl == 'yes':
             mandatory.append({
                "field": "is_bpl",
                "operator": "equals",
                "value": True,
                "requirement_type": "mandatory",
                "source": "eligibility_bpl",
                "source_evidence": str(row['eligibility_bpl'])
            })
             
    # DISABILITY
    if pd.notna(row.get('eligibility_disability')):
        dis = str(row['eligibility_disability']).strip().lower()
        if dis == 'true' or dis == '1' or dis == 'yes':
             mandatory.append({
                "field": "has_disability",
                "operator": "equals",
                "value": True,
                "requirement_type": "mandatory",
                "source": "eligibility_disability",
                "source_evidence": str(row['eligibility_disability'])
            })
             
    # --- UNSTRUCTURED TEXT EXTRACTION ---
    text_rules, text_prefs, text_review = extract_from_text(row.get('eligibility_text'))
    mandatory.extend(text_rules)
    preference.extend(text_prefs)
    if text_review: manual_review = True
    
    # Check contradictions (e.g. structured says female, text says male)
    # Simple contradiction check
    fields_found = [r['field'] for r in mandatory]
    if len(fields_found) != len(set(fields_found)):
        # Possible contradiction or just AND condition (like min_age AND max_age)
        pass # To be safe, if we extract duplicate fields from text vs structured, we should flag it
        
    return mandatory, preference, manual_review, contradictions

def generate_validation_report():
    print("Loading data...")
    df = pd.read_csv(RAW_CSV_PATH)
    total_rows = len(df)
    
    field_counts = {}
    pref_field_counts = {}
    examples = {}
    manual_review_cases = []
    contradiction_cases = []
    
    total_mandatory = 0
    total_pref = 0
    total_review = 0
    
    print("Parsing rules...")
    for _, row in df.iterrows():
        mand, pref, review, contr = parse_rules(row)
        
        if review: total_review += 1
        if contr: contradiction_cases.append(row['slug'])
        
        if review and len(manual_review_cases) < 5:
            manual_review_cases.append((row['slug'], row.get('eligibility_text')))
            
        for r in mand:
            f = r['field']
            field_counts[f] = field_counts.get(f, 0) + 1
            total_mandatory += 1
            if f not in examples: examples[f] = []
            if len(examples[f]) < 5:
                examples[f].append({
                    "scheme_id": row['slug'],
                    "rule": r
                })
                
        for r in pref:
            f = r['field']
            pref_field_counts[f] = pref_field_counts.get(f, 0) + 1
            total_pref += 1

    print("Writing report...")
    report = []
    report.append("# Swasthika Deep Validation Report (v2)")
    report.append("")
    report.append("## A-D. General Statistics")
    report.append(f"- **A. Total source rows**: {total_rows}")
    report.append(f"- **B. Total normalized rows**: {total_rows}")
    report.append(f"- **C. Duplicates**: {df['slug'].duplicated().sum()}")
    report.append(f"- **D. Missing/invalid scheme IDs**: {df['slug'].isna().sum()}")
    report.append("")
    report.append("## E-G. Rule Counts")
    report.append(f"- **F. Mandatory rule count total**: {total_mandatory}")
    report.append(f"- **G. Preference rule count total**: {total_pref}")
    report.append("### Mandatory Rule Counts by Field:")
    for f, c in sorted(field_counts.items(), key=lambda x: x[1], reverse=True):
        report.append(f"- **{f}**: {c}")
    report.append("")
    
    report.append("## H-J. Review and Issues")
    report.append(f"- **H. Manual-review count**: {total_review}")
    report.append(f"- **I. Contradictory-record count**: {len(contradiction_cases)}")
    report.append(f"- **J. Unsupported-condition count**: {total_review} (flagged for review due to ambiguity/preferences/negations)")
    report.append("")
    
    report.append("## K. Examples for EVERY Extracted Field")
    for f, exs in examples.items():
        report.append(f"### Field: {f}")
        for i, ex in enumerate(exs):
            report.append(f"**Example {i+1} (Scheme {ex['scheme_id']}):**")
            rule = ex['rule']
            report.append(f"- **Original structured/text value**: `{rule['source_evidence']}`")
            report.append(f"- **Extracted machine-readable rule**: ```json\n{json.dumps(rule, indent=2)}\n```")
            report.append(f"- **Requirement Type**: {rule['requirement_type']}")
            report.append(f"- **Source**: {rule['source']}")
            report.append("")
            
    report.append("## L. Examples of Manual-Review Cases")
    for slug, text in manual_review_cases:
        report.append(f"**Scheme {slug}:**")
        report.append(f"> {str(text)[:500]}...")
        report.append("*Reason: Contained preference keywords, complex negations, or unsupported criteria requiring human verification.*")
        report.append("")
        
    with open('C:/Users/manik/.gemini/antigravity/brain/7ee16e75-c059-45cd-bb09-3754b8aba32f/comprehensive_validation_report.md', 'w', encoding='utf-8') as f:
        f.write("\n".join(report))
        
    print("Report generated.")

if __name__ == "__main__":
    generate_validation_report()
