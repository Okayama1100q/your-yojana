# Swasthika — Agent 1 of YorYojana

Swasthika is the deterministic government-scheme eligibility agent in the YorYojana multi-agent system.

## Architecture

```
CitizenProfile (from YorYojana backend)
    ↓
POST /api/swasthika/evaluate  [authenticated via X-SWASTHIKA-API-KEY]
    ↓
DeterministicEngine (pure Python, NO ML, NO LLM, NO embeddings)
    evaluates ALL ~4,693 schemes
    produces: ELIGIBLE / INELIGIBLE / NEEDS_MORE_INFORMATION
    ↓
Eligible schemes only → BM25Retriever → Top 10
    ↓
Gemini (explanation ONLY — never determines eligibility)
    ↓
EvaluationResponse (JSON)
```

## Project Structure

```
swasthika/
├── data/
│   ├── raw/Schemes.csv                         # original dataset — never modified
│   ├── processed/Swasthika_Eligibility_Normalized.csv
│   └── reports/
│       ├── preprocessing_report.json
│       ├── preprocessing_report.txt
│       └── manual_review.csv
├── scripts/
│   └── preprocess_schemes.py                   # reproducible preprocessing pipeline
├── backend/
│   ├── main.py                                 # FastAPI application
│   ├── schemas.py                              # Pydantic models
│   ├── config.py                               # settings loaded from .env only
│   ├── eligibility/
│   │   ├── engine.py                           # evaluates all schemes
│   │   ├── evaluator.py                        # per-rule / per-scheme evaluation
│   │   ├── operators.py                        # equals, in, gt, lt, exists, ...
│   │   ├── audit.py                            # builds structured audit trails
│   │   └── followups.py                        # generates follow-up questions
│   ├── rag/
│   │   ├── indexer.py                          # offline pre-warm loader
│   │   └── retriever.py                        # BM25 ranking over eligible pool
│   └── llm/
│       └── explainer.py                        # Gemini explanation (post-eligibility only)
└── tests/
    ├── test_eligibility.py                     # 80 deterministic rule engine tests
    ├── test_rag.py                             # 7 BM25 retriever tests
    └── test_api.py                             # 11 API integration tests
```

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment (in swasthika/)
cp .env.example .env
# Edit .env and fill in:
#   SWASTHIKA_API_KEY=<your secret>
#   GEMINI_API_KEY=<your Gemini key>

# 3. Run preprocessing (from swasthika/)
python scripts/preprocess_schemes.py

# 4. Start the API (from swasthika/)
uvicorn swasthika.backend.main:app --reload --host 0.0.0.0 --port 8001
```

## Running Tests

```bash
# From the project root (AGENT 1(swasthika)/)
python -m pytest swasthika/tests/ -v
```

## API Usage

### Evaluate a Citizen

```
POST /api/swasthika/evaluate
X-SWASTHIKA-API-KEY: <your key>
Content-Type: application/json
```

**Request body** (all fields optional — NULL = not collected):

```json
{
  "gender": "female",
  "age": 22,
  "marital_status": "never_married",
  "state": "Tamil Nadu",
  "residence_area": "rural",
  "community": "SC",
  "has_disability": false,
  "is_minority": false,
  "is_student": true,
  "is_bpl": true,
  "family_income": 80000
}
```

**Response:**

```json
{
  "status": "success",
  "total_schemes_evaluated": 4693,
  "eligible_count": 34,
  "needs_more_information_count": 7,
  "ineligible_count": 4652,
  "recommendations": [
    {
      "scheme_id": "...",
      "scheme_name": "...",
      "eligibility_status": "ELIGIBLE",
      "matched_conditions": [...],
      "audit_trail": {
        "scheme_id": "...",
        "status": "ELIGIBLE",
        "checks": [
          {"field": "state", "result": "PASS", "user_value": "Tamil Nadu", "required": ["Tamil Nadu"]}
        ]
      },
      "explanation": "This scheme is recommended because...",
      "official_url": "https://...",
      "application_url": "https://...",
      "preference_notes": null
    }
  ],
  "needs_more_information": [...],
  "missing_fields_summary": {"occupation": ["scheme-abc", "scheme-xyz"]}
}
```

## Security

- `SWASTHIKA_API_KEY` — service-to-service auth. Never exposed to the frontend.
- `GEMINI_API_KEY` — used only in `backend/llm/explainer.py`. Never returned in responses or logged.
- Both keys are loaded exclusively from `.env`. `.env` is in `.gitignore`.

## Key Design Guarantees

| Guarantee | How it is enforced |
|-----------|-------------------|
| Eligibility is deterministic | Pure Python rule evaluation, no randomness |
| No ML/LLM for eligibility | `engine.py` and `evaluator.py` contain zero AI calls |
| Gemini only for explanation | `explainer.py` called only after eligibility is finalised |
| RAG only over eligible pool | `retriever.index()` called with `eligible_schemes` list only |
| Preference ≠ mandatory | `preference_rules` column never evaluated in `evaluator.py` |
| NULL ≠ False | `evaluate_rule()` returns `NEEDS_MORE_INFORMATION` for `None` fields |
| INELIGIBLE > NMI | Final status logic in `evaluate_scheme()` |
| State/community as strings | Arrays of canonical strings, `in` operator for membership |
| Full audit trail | Every recommendation includes `audit_trail` with per-rule results |
