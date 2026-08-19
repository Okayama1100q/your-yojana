# Cross-Sector NGO Collaboration Agent Backend - Implementation Plan

Building a complete, production-grade, deterministic, backend-only Cross-Sector NGO Collaboration Agent for the **Your Yojana** platform using **FastAPI**, **SQLAlchemy ORM**, **SQLite**, and **Pydantic**.

## User Review Required

> [!IMPORTANT]
> - **Zero AI / ML / LLMs**: Matching is strictly rule-based, deterministic, explainable, and reproducible.
> - **No Citizen Authentication**: The citizen identity is represented solely as `external_user_id` provided by the calling Your Yojana application.
> - **No Frontend / No Email**: Pure RESTful API service exposing OpenAPI documentation at `/docs`.
> - **Seed Data**: 20 fictional NGOs and realistic service/coverage/contribution records clearly marked as DEMO/SEED DATA.

## Proposed Architecture & Directory Structure

```
c:\Users\manik\Documents\SANGAM\
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application setup, lifecycle, router inclusion
│   ├── config.py                # Pydantic Settings and environment config
│   ├── database.py              # SQLAlchemy engine, sessionmaker, Base model, DB init helper
│   ├── models/
│   │   ├── __init__.py
│   │   ├── master.py            # ServiceCategory, Requirement
│   │   ├── ngo.py               # NGO, NGOService, NGOCoverage
│   │   ├── collaboration.py     # CollaborationRequest, Collaboration, RequestStatusHistory
│   │   └── contribution.py      # Contribution
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── master.py            # Pydantic schemas for Categories & Requirements
│   │   ├── ngo.py               # Registration, Profile, Admin schemas
│   │   ├── service_coverage.py  # NGOService and NGOCoverage schemas
│   │   ├── collaboration.py     # User Request, Match, Accept, Reject, Status tracking
│   │   ├── contribution.py      # Contribution stats and item schemas
│   │   └── ranking.py           # Ranking summary and Leaderboard schemas
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── master.py            # GET /api/v1/service-categories, GET .../requirements
│   │   ├── ngos.py              # POST /api/v1/ngos/register, GET /api/v1/ngos/{id}
│   │   ├── services.py          # GET/POST /api/v1/ngos/{id}/services
│   │   ├── coverage.py          # GET/POST /api/v1/ngos/{id}/coverage
│   │   ├── collaboration.py     # POST /api/v1/collaboration/requests, GET tracking, accept, reject, status
│   │   ├── contributions.py     # GET /api/v1/ngos/{id}/contributions
│   │   ├── ranking.py           # GET /api/v1/ngos/ranking, GET /api/v1/ngos/{id}/ranking
│   │   └── admin.py             # Admin endpoints: list, approve, reject, suspend, reactivate NGOs
│   ├── services/
│   │   ├── __init__.py
│   │   ├── master_service.py    # Master data queries
│   │   ├── ngo_service.py       # NGO registration, approval, updates
│   │   ├── matching_engine.py   # Deterministic 100-point matching & scoring engine
│   │   ├── collaboration_service.py # Request creation, accept/reject, state machine transitions
│   │   ├── contribution_service.py  # Contribution creation on COMPLETED
│   │   └── ranking_service.py   # Dynamic normalized ranking calculation
│   ├── seed/
│   │   ├── __init__.py
│   │   ├── master_data.py       # 18 Categories & 108 Requirements definitions
│   │   ├── seed_ngos.py         # 20 Fictional NGOs, services, coverage, contributions
│   │   └── seed_runner.py       # Database seeding utility
│   └── utils/
│       ├── __init__.py
│       ├── enums.py             # RegistrationStatus, CollaborationStatus, RequestOverallStatus, DurationUnit
│       └── exceptions.py        # Custom HTTP & business exceptions
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Pytest fixtures, test database setup, test client
│   ├── test_master_data.py      # Master categories & requirements tests
│   ├── test_ngo_registration_admin.py # NGO register, admin approve/reject/suspend tests
│   ├── test_ngo_services_coverage.py  # Services & coverage validation tests
│   ├── test_matching_engine.py  # Deterministic matching & explainability tests
│   ├── test_collaboration_workflow.py # Request creation, accept/reject, tracking tests
│   ├── test_multi_ngo_support.py# Partial support & multi-NGO fulfillment tests
│   ├── test_status_transitions.py # State machine rules & history preservation
│   ├── test_contributions_ranking.py # Contribution generation & dynamic ranking tests
│   └── test_end_to_end_scenarios.py  # Full Fisheries & Laptop workflow tests
├── requirements.txt
├── README.md
├── run_seed.py
└── .env.example
```

---

## Proposed Changes

### 1. Core Configuration & Database Layer
#### [NEW] [config.py](file:///c:/Users/manik/Documents/SANGAM/app/config.py)
- Configuration using `pydantic-settings` (`Settings` class) with `DATABASE_URL` (defaults to `sqlite:///./your_yojana_agent.db`), `API_V1_PREFIX`, `APP_NAME`, `DEBUG`.
#### [NEW] [database.py](file:///c:/Users/manik/Documents/SANGAM/app/database.py)
- SQLAlchemy `create_engine`, `sessionmaker`, declarative `Base`, and `get_db` dependency generator.
- `init_db()` to programmatically create all database tables.

### 2. Database Models
#### [NEW] [models/master.py](file:///c:/Users/manik/Documents/SANGAM/app/models/master.py)
- `ServiceCategory`: `id`, `code` (unique, uppercase index), `name`, `active`, `created_at`.
- `Requirement`: `id`, `code` (uppercase index), `name`, `service_category_id` (FK), `active`, `created_at`. Unique constraint on `(service_category_id, code)`.
#### [NEW] [models/ngo.py](file:///c:/Users/manik/Documents/SANGAM/app/models/ngo.py)
- `NGO`: `id`, `ngo_code` (unique index), `ngo_name`, `registration_number`, `contact_person`, `phone`, `state`, `district`, `address`, `description`, `registration_status` (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`), `active`, `created_at`, `updated_at`.
- `NGOService`: `id`, `ngo_id` (FK), `service_category_id` (FK), `requirement_id` (FK), `available_quantity`, `unit`, `estimated_duration_value`, `estimated_duration_unit` (`HOURS`, `DAYS`, `WEEKS`, `MONTHS`), `active`, `created_at`, `updated_at`.
- `NGOCoverage`: `id`, `ngo_id` (FK), `state`, `district`, `area`, `active`.
#### [NEW] [models/collaboration.py](file:///c:/Users/manik/Documents/SANGAM/app/models/collaboration.py)
- `CollaborationRequest`: `id`, `external_user_id`, `service_category_id` (FK), `requirement_id` (FK), `requirement_details`, `state`, `district`, `area`, `income`, `quantity`, `unit`, `status` (`OPEN`, `PARTIALLY_SUPPORTED`, `FULLY_SUPPORTED`, `CLOSED`, `CANCELLED`), `created_at`, `updated_at`.
- `Collaboration`: `id`, `request_id` (FK), `ngo_id` (FK), `status` (`REQUESTED`, `SENT_TO_NGO`, `ACCEPTED`, `REJECTED`, `PREPARING`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `RECEIVED`, `COMPLETED`), `matched_score`, `matched_reasons` (JSON text), `requested_quantity`, `accepted_quantity`, `estimated_duration_value`, `estimated_duration_unit`, `response_message`, `rejection_reason`, `accepted_at`, `completed_at`, `created_at`, `updated_at`.
- `RequestStatusHistory`: `id`, `collaboration_id` (FK), `status`, `remarks`, `created_at`.
#### [NEW] [models/contribution.py](file:///c:/Users/manik/Documents/SANGAM/app/models/contribution.py)
- `Contribution`: `id`, `ngo_id` (FK), `collaboration_id` (FK), `requirement_id` (FK), `quantity_provided`, `unit`, `beneficiaries_helped`, `completed_on_time`, `completed_at`, `created_at`.

### 3. Business Services Layer
#### [NEW] [services/matching_engine.py](file:///c:/Users/manik/Documents/SANGAM/app/services/matching_engine.py)
- Rule-based deterministic matching:
  1. **Hard Filtering**:
     - `ngo.registration_status == APPROVED` & `ngo.active == True`
     - Exact match on `service_category_id` and `requirement_id` in active `NGOService`
     - `available_quantity > 0`
     - Active `NGOCoverage` matching request `state` (case-insensitive)
  2. **Deterministic 100-Point Scoring**:
     - Exact Service & Requirement Match: **40 pts**
     - Exact State Match: **20 pts**
     - Exact District Match: **20 pts**
     - Exact Area Match: **10 pts**
     - Capacity/Availability: **5 pts** (full 5 if `available_quantity >= requested_quantity`, proportional otherwise)
     - Historical Performance: **5 pts** (derived from historical on-time completion rate: `(on_time_rate / 100.0) * 5.0`)
  3. Returns ranked matches with explainability reasons list.
#### [NEW] [services/collaboration_service.py](file:///c:/Users/manik/Documents/SANGAM/app/services/collaboration_service.py)
- Creating user requests, triggering deterministic matching, creating initial candidate collaboration entries.
- Handling NGO accept:
  - Validates `0 < accepted_quantity <= remaining_quantity` and `<= available_quantity`.
  - Reserves/decrements `available_quantity`.
  - Updates overall request status (`PARTIALLY_SUPPORTED` or `FULLY_SUPPORTED`).
  - Appends to `RequestStatusHistory`.
- Handling NGO reject:
  - Records `rejection_reason`, updates status to `REJECTED`, appends history.
- Handling status transitions:
  - Validates allowed state transitions:
    `REQUESTED / SENT_TO_NGO -> ACCEPTED / REJECTED`
    `ACCEPTED -> PREPARING / DISPATCHED / DELIVERED / RECEIVED`
    `DELIVERED -> RECEIVED`
    `RECEIVED -> COMPLETED`
  - Blocks invalid transitions (e.g. `COMPLETED -> ACCEPTED` or skipping `RECEIVED` to `COMPLETED` from `DELIVERED`).
  - On `COMPLETED`: Automatically calls `ContributionService` to create a `Contribution` record.
#### [NEW] [services/ranking_service.py](file:///c:/Users/manik/Documents/SANGAM/app/services/ranking_service.py)
- Calculate on-demand metrics across all approved NGOs:
  - `completed_requests`
  - `beneficiaries_helped`
  - `total_quantity_provided`
  - `on_time_completion_rate`
- Dynamic weighted normalization:
  - 35% Completed Requests + 30% Beneficiaries Helped + 20% Total Quantity + 15% On-Time Completion Rate.
  - Sorts descending and assigns `current_rank`.

### 4. Seed Data & Runner
#### [NEW] [seed/master_data.py](file:///c:/Users/manik/Documents/SANGAM/app/seed/master_data.py)
- All 18 Service Categories and 108 Standardized Requirements.
#### [NEW] [seed/seed_ngos.py](file:///c:/Users/manik/Documents/SANGAM/app/seed/seed_ngos.py)
- 20 Demo NGOs (all names from prompt spec: Helping Hands Foundation, Rural Development Trust, Fisher Welfare Foundation, etc.).
- Complete service catalogues with quantities, units, and durations.
- Multi-tier geographic coverage across Indian districts & areas.
- Realistic historical completed contributions for ranking demonstration.
#### [NEW] [seed/seed_runner.py](file:///c:/Users/manik/Documents/SANGAM/app/seed/seed_runner.py) & [run_seed.py](file:///c:/Users/manik/Documents/SANGAM/run_seed.py)
- Programmatic database seed runner.

### 5. API Routers
- `/api/v1/service-categories` (and `/{category_code}/requirements`)
- `/api/v1/ngos/register` and `/api/v1/ngos/{ngo_id}`
- `/api/v1/ngos/{ngo_id}/services` (GET, POST)
- `/api/v1/ngos/{ngo_id}/coverage` (GET, POST)
- `/api/v1/collaboration/requests` (POST, GET by ID, GET tracking, GET by user)
- `/api/v1/ngos/{ngo_id}/requests` (GET all, GET pending)
- `/api/v1/collaborations/{id}/accept`, `reject`, `status`
- `/api/v1/ngos/{ngo_id}/contributions`
- `/api/v1/ngos/ranking`, `/api/v1/ngos/{ngo_id}/ranking`
- `/api/v1/admin/ngos` (list, approve, reject, suspend, reactivate)

---

## Verification Plan

### Automated Tests (pytest)
We will create a comprehensive test suite covering all 30 minimum test points:
1. `tests/test_master_data.py`: Verify 18 categories, 108 requirements, dropdown source of truth, 404s for invalid category codes.
2. `tests/test_ngo_registration_admin.py`: Registration, PENDING status, admin approval/rejection/suspension, duplicate code handling.
3. `tests/test_ngo_services_coverage.py`: Adding valid services, rejecting invalid requirements or mismatched category-requirement combos, multi-coverage areas.
4. `tests/test_matching_engine.py`: Exact service/requirement matching, state/district/area scoring breakdown, exclusion of unapproved/inactive NGOs, exclusion of zero-quantity NGOs, score explainability.
5. `tests/test_collaboration_workflow.py`: User request submission, candidate matching, NGO accept/reject, timeline tracking retrieval.
6. `tests/test_multi_ngo_support.py`: Multiple NGOs fulfilling 100 laptops (NGO A: 60 + NGO B: 40), partial vs full support status tracking.
7. `tests/test_status_transitions.py`: State machine rules (DELIVERED -> RECEIVED -> COMPLETED), forbidding invalid transitions (COMPLETED -> ACCEPTED), immutable status history log.
8. `tests/test_contributions_ranking.py`: Contribution creation ONLY on COMPLETED, dynamic ranking score calculation, on-time rate impact, ranking reorder when an NGO completes new work.
9. `tests/test_end_to_end_scenarios.py`: Full fisheries workflow (User request -> Match NGO003/NGO009 -> Accept -> Preparing -> Dispatched -> In Transit -> Delivered -> Received -> Completed -> Contribution & Rank update).

### Manual / Integration Verification
- Run database seeding script `python run_seed.py`.
- Run pytest suite: `pytest -v`.
- Test FastAPI app launch with `uvicorn app.main:app --port 8000` and verify OpenAPI docs accessibility.
