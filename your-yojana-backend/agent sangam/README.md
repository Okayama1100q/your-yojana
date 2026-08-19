# Your Yojana - Cross-Sector NGO Collaboration Agent (Backend)

Deterministic, rule-based, explainable cross-sector collaboration service connecting citizen requirements from the **Your Yojana** platform with verified NGO capacities across India.

---

## 1. Core Principles & Philosophy

- **Zero AI / ML / LLMs / Semantic Vectors**: All matching is 100% deterministic, explainable, database-driven, and reproducible.
- **Master Data Standardization**: 18 Master Service Categories and 108 Standardized Requirements act as the single source of truth for frontend dropdowns. No fuzzy matching or free-text guessing.
- **External Identity Decoupling**: Citizen user identities are owned by the main Your Yojana application (`external_user_id`). This service stores zero citizen credentials.
- **Multi-NGO Collaborative Fulfillment**: Large assistance requests (e.g. 100 laptops) can be fulfilled collaboratively across multiple NGOs (e.g. NGO A delivers 60, NGO B delivers 40).
- **Amazon-Style Tracking Timeline**: Granular lifecycle tracking preserving immutable status histories with distinct `DELIVERED`, `RECEIVED` (citizen acknowledgement), and `COMPLETED` states.
- **Performance-Driven Dynamic Rankings**: NGOs earn rank dynamically based on real completed contributions, beneficiaries helped, quantity provided, and on-time performance (35% / 30% / 20% / 15% normalized formula).

---

## 2. System Architecture

```
                                +-----------------------------+
                                |  Main Your Yojana Platform  |
                                |       (Citizens / Users)    |
                                +--------------+--------------+
                                               |
                     POST /collaboration/requests
                     GET  /collaboration/requests/{id}/tracking
                                               |
                                               v
+-----------------------------------------------------------------------------------+
|                        FASTAPI BACKEND SERVICE (:8000)                            |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | Master Data Router |   | Collaboration Router|   | Dynamic Ranking Engine   |  |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | NGO Management     |   | Deterministic       |   | Verified Contribution    |  |
|  | & Admin Routers    |   | Matching Engine     |   | Service                  |  |
|  +--------------------+   +---------------------+   +--------------------------+  |
+--------------------------------------|--------------------------------------------+
                                       |
                                       v
                     +-----------------------------------+
                     |      SQLite ORM Database Engine   |
                     |  (Foreign Keys Enforced & Pooled) |
                     +-----------------+-----------------+
                                       |
                   +-------------------+-------------------+
                   |                   |                   |
                   v                   v                   v
            +--------------+   +---------------+   +----------------+
            | Master Data  |   | NGO Services  |   | Collaborations |
            | & Categories |   | & Coverage    |   | & Contributions|
            +--------------+   +---------------+   +----------------+
```

---

## 3. Database Schema

The SQLite database is created programmatically using SQLAlchemy ORM:

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| `service_categories` | 18 standardized sector categories | `id`, `code` (Unique), `name`, `active`, `created_at` |
| `requirements` | 108 standardized requirement types | `id`, `code`, `name`, `service_category_id` (FK), `active` |
| `ngos` | NGO registration & profile | `id`, `ngo_code` (Unique), `ngo_name`, `registration_number`, `state`, `district`, `registration_status`, `active` |
| `ngo_services` | Stock & duration per requirement | `id`, `ngo_id` (FK), `service_category_id` (FK), `requirement_id` (FK), `available_quantity`, `unit`, `estimated_duration_value`, `estimated_duration_unit` |
| `ngo_coverage` | Geographic reach | `id`, `ngo_id` (FK), `state`, `district`, `area`, `active` |
| `collaboration_requests`| Citizen assistance request | `id`, `external_user_id`, `service_category_id` (FK), `requirement_id` (FK), `state`, `district`, `area`, `income`, `quantity`, `unit`, `status` |
| `collaborations` | Opportunity matched to an NGO | `id`, `request_id` (FK), `ngo_id` (FK), `status`, `matched_score`, `matched_reasons` (JSON), `requested_quantity`, `accepted_quantity`, `estimated_duration_value`, `estimated_duration_unit` |
| `request_status_history`| Immutable status audit trail | `id`, `collaboration_id` (FK), `status`, `remarks`, `created_at` |
| `contributions` | Verified completed assistance | `id`, `ngo_id` (FK), `collaboration_id` (FK), `requirement_id` (FK), `quantity_provided`, `unit`, `beneficiaries_helped`, `completed_on_time`, `completed_at` |

---

## 4. Master Service Categories & Requirements

The service exposes 18 standardized sectors and 108 standardized requirements:

1. **AGRICULTURE**: `SEEDS`, `FARMING_TOOLS`, `IRRIGATION_EQUIPMENT`, `WATER_PUMP`, `FARM_MACHINERY`, `LIVESTOCK_EQUIPMENT`
2. **FISHERIES**: `FISHING_NET`, `FISHING_BOAT`, `BOAT_ENGINE`, `FISHING_GEAR`, `SAFETY_EQUIPMENT`, `FISH_STORAGE_EQUIPMENT`
3. **EDUCATION**: `LAPTOP_DESKTOP`, `TABLET`, `BOOKS_STUDY_MATERIAL`, `SCHOOL_SUPPLIES`, `EDUCATIONAL_EQUIPMENT`, `EDUCATIONAL_TRAINING`
4. **HEALTHCARE**: `MEDICINES`, `MEDICAL_EQUIPMENT`, `WHEELCHAIR`, `HEARING_AID`, `DIAGNOSTIC_SUPPORT`, `MEDICAL_TREATMENT`
5. **DISABILITY**: `WHEELCHAIR`, `WALKING_AID`, `HEARING_AID`, `PROSTHETIC_ORTHOTIC_DEVICE`, `ASSISTIVE_TECHNOLOGY`, `REHABILITATION_SUPPORT`
6. **LIVELIHOOD**: `SEWING_MACHINE`, `TOOL_KIT`, `BUSINESS_EQUIPMENT`, `BUSINESS_STARTER_KIT`, `SKILL_TRAINING`, `EMPLOYMENT_SUPPORT`
7. **WOMEN_EMPOWERMENT**: `SEWING_MACHINE`, `BUSINESS_EQUIPMENT`, `SKILL_TRAINING`, `ENTREPRENEURSHIP_SUPPORT`, `EMPLOYMENT_SUPPORT`, `DIGITAL_TRAINING`
8. **CHILD_WELFARE**: `SCHOOL_SUPPLIES`, `BOOKS_STUDY_MATERIAL`, `SCHOOL_UNIFORM`, `EDUCATIONAL_EQUIPMENT`, `LEARNING_SUPPORT`, `SPORTS_EQUIPMENT`
9. **ELDERLY_SUPPORT**: `WHEELCHAIR`, `WALKING_AID`, `MEDICAL_EQUIPMENT`, `HEARING_AID`, `HOME_CARE_SUPPORT`, `MOBILITY_EQUIPMENT`
10. **HOUSING**: `ROOFING_MATERIALS`, `CONSTRUCTION_MATERIALS`, `HOME_REPAIR_SUPPORT`, `BEDS_MATTRESSES`, `LIGHTING_EQUIPMENT`, `WATER_STORAGE`
11. **WATER_SANITATION**: `WATER_FILTER`, `WATER_TANK`, `WATER_PUMP`, `TOILET_SUPPORT`, `SANITATION_EQUIPMENT`, `WASTE_MANAGEMENT_EQUIPMENT`
12. **ENERGY**: `SOLAR_PANEL`, `SOLAR_LAMP`, `SOLAR_LANTERN`, `BATTERY_INVERTER`, `LED_LIGHTING`, `ELECTRICAL_EQUIPMENT`
13. **DIGITAL_ACCESS**: `LAPTOP_DESKTOP`, `TABLET`, `SMARTPHONE`, `INTERNET_DEVICE`, `COMPUTER_ACCESSORIES`, `DIGITAL_LITERACY_TRAINING`
14. **DISASTER_RECOVERY**: `TEMPORARY_SHELTER`, `SOLAR_LAMP`, `WATER_PURIFICATION_EQUIPMENT`, `EMERGENCY_EQUIPMENT`, `HOUSE_REPAIR_MATERIALS`, `LIVELIHOOD_RECOVERY_EQUIPMENT`
15. **SKILL_DEVELOPMENT**: `COMPUTER_TRAINING`, `SEWING_TRAINING`, `ELECTRICAL_TRAINING`, `WELDING_TRAINING`, `DRIVING_TRAINING`, `ENTREPRENEURSHIP_TRAINING`
16. **MOBILITY**: `BICYCLE`, `WHEELCHAIR`, `MOBILITY_AID`, `TRICYCLE`, `ACCESSIBLE_TRANSPORTATION`, `VEHICLE_REPAIR_SUPPORT`
17. **ENVIRONMENT**: `SAPLINGS`, `GARDENING_EQUIPMENT`, `WASTE_MANAGEMENT_EQUIPMENT`, `RECYCLING_EQUIPMENT`, `COMPOSTING_EQUIPMENT`, `RAINWATER_HARVESTING_EQUIPMENT`
18. **SPORTS**: `SPORTS_EQUIPMENT`, `SPORTS_SHOES`, `SPORTS_UNIFORM`, `CRICKET_EQUIPMENT`, `FOOTBALL_EQUIPMENT`, `SPORTS_TRAINING`

---

## 5. Deterministic Matching Algorithm

The matching engine employs a two-stage deterministic pipeline:

### Step 1: Hard Filters
To be considered as a candidate for a collaboration request:
1. NGO must have `registration_status == APPROVED`.
2. NGO must be `active == True`.
3. NGO must have an active `NGOService` matching the requested `service_category_id` and `requirement_id`.
4. NGO service must have `available_quantity > 0`.
*(Note: State mismatch does NOT exclude an NGO; interstate fulfillments are scored transparently).*

### Step 2: 100-Point Scoring Breakdown
Matches are scored using an exact, explainable 100-point formula:

| Component | Max Points | Evaluation Rule |
| :--- | :--- | :--- |
| **Exact Service & Requirement** | **40 pts** | Awarded automatically when hard filters match exact requirement. |
| **State Match** | **20 pts** | Awarded if request state matches NGO registered state or any active coverage record. |
| **District Match** | **20 pts** | Awarded if request district matches NGO registered district or coverage district. |
| **Area Match** | **10 pts** | Awarded if request locality/area matches specific micro-coverage area. |
| **Capacity / Availability** | **5 pts** | If `available_quantity >= requested_quantity`, full 5 pts; else proportional `(available / requested) * 5.0`. |
| **Historical Performance** | **5 pts** | Scaled proportionally from historical on-time delivery rate: `(on_time_rate / 100.0) * 5.0` (base 3.0 pts for newly approved NGOs). |

Every candidate returned includes an explicit list of matching reasons (e.g. `["Exact service and requirement match (40/40 pts)", "State match: Tamil Nadu (20/20 pts)", "District match: Nagapattinam (20/20 pts)", "Area match: Velankanni (10/10 pts)", ...]`).

---

## 6. Collaboration Lifecycle State Machine

Fulfillment tracking follows a strict, non-reversible state machine:

```
[REQUESTED / SENT_TO_NGO]
       |
       +---> [REJECTED] (Terminal)
       |
       +---> [ACCEPTED]
                |
                +---> [PREPARING]
                |        |
                |        +---> [DISPATCHED]
                |                 |
                |                 +---> [IN_TRANSIT]
                |                          |
                +--------------------------+---> [DELIVERED]
                                                    |
                                                    v
                                                [RECEIVED] (Citizen receipt confirmed)
                                                    |
                                                    v
                                                [COMPLETED] ===> [Trigger: Create Contribution Record]
```

- **DELIVERED vs RECEIVED**: Delivering is an NGO milestone. `RECEIVED` is confirmation of physical receipt by the citizen / main app.
- **Contribution Credit**: Contribution records and performance points are minted **ONLY** upon reaching `COMPLETED`.

---

## 7. Dynamic Ranking Formula

NGO rankings are computed on-demand from verified completed contributions across all approved NGOs:

$$\text{Score} = (0.35 \times \text{NormCompleted}) + (0.30 \times \text{NormBeneficiaries}) + (0.20 \times \text{NormQuantity}) + (0.15 \times \text{OnTimeRate})$$

Where:
- $\text{NormCompleted} = \frac{\text{completed\_requests}}{\max(\text{completed\_requests})} \times 100$
- $\text{NormBeneficiaries} = \frac{\text{beneficiaries\_helped}}{\max(\text{beneficiaries\_helped})} \times 100$
- $\text{NormQuantity} = \frac{\text{total\_quantity\_provided}}{\max(\text{total\_quantity\_provided})} \times 100$
- $\text{OnTimeRate} = \frac{\text{on\_time\_completed\_requests}}{\text{completed\_requests}} \times 100$

Rankings dynamically adjust as soon as an NGO completes a new assistance request.

---

## 8. API Reference

All routes are versioned under `/api/v1`:

### Master Data
- `GET /api/v1/service-categories`: Retrieve all standardized service categories for dropdowns.
- `GET /api/v1/service-categories/{category_code}/requirements`: Retrieve requirements for a category.

### User Collaboration (Main Your Yojana App)
- `POST /api/v1/collaboration/requests`: Submit a citizen requirement and trigger deterministic matching.
- `GET /api/v1/collaboration/requests/{request_id}`: Get request details and matching status.
- `GET /api/v1/collaboration/requests/{request_id}/tracking`: Amazon-style tracking timeline.
- `GET /api/v1/collaboration/users/{external_user_id}/requests`: List all requests submitted by user.

### NGO Portal & Actions
- `POST /api/v1/ngos/register`: Register NGO in `PENDING` status.
- `GET /api/v1/ngos/{ngo_id}`: Comprehensive NGO profile with services, coverage, and rank.
- `GET /api/v1/ngos/{ngo_id}/services`: List NGO services.
- `POST /api/v1/ngos/{ngo_id}/services`: Add/update service with quantity and estimated duration.
- `GET /api/v1/ngos/{ngo_id}/coverage`: List geographic coverage areas.
- `POST /api/v1/ngos/{ngo_id}/coverage`: Add coverage area.
- `GET /api/v1/ngos/{ngo_id}/requests`: All collaboration opportunities for NGO.
- `GET /api/v1/ngos/{ngo_id}/requests/pending`: Pending requests awaiting NGO action.
- `POST /api/v1/collaborations/{id}/accept`: Accept request (full or partial quantity).
- `POST /api/v1/collaborations/{id}/reject`: Reject request with explanation reason.
- `POST /api/v1/collaborations/{id}/status`: Advance status (`PREPARING`, `DELIVERED`, `RECEIVED`, `COMPLETED`).
- `GET /api/v1/ngos/{ngo_id}/contributions`: Verified completed contributions.
- `GET /api/v1/ngos/{ngo_id}/ranking`: Individual NGO rank and score metrics.
- `GET /api/v1/ngos/ranking`: Live overall NGO leaderboard.

### Admin Management
- `GET /api/v1/admin/ngos`: List all NGOs with status and active filters.
- `POST /api/v1/admin/ngos/{ngo_id}/approve`: Approve NGO.
- `POST /api/v1/admin/ngos/{ngo_id}/reject`: Reject NGO.
- `POST /api/v1/admin/ngos/{ngo_id}/suspend`: Suspend NGO.
- `POST /api/v1/admin/ngos/{ngo_id}/reactivate`: Reactivate suspended NGO.

---

## 9. Installation & Running

### Prerequisites
- Python 3.11+
- Git

### Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Seed Database (Creates 18 categories, 108 requirements, 20 demo NGOs, services & contributions)
python run_seed.py

# 3. Start the FastAPI Dev Server
uvicorn app.main:app --reload --port 8000
```

### Interactive API Documentation
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 10. Running Test Suite

Run the full automated pytest suite:
```bash
python -m pytest -v
```
All 31 test suites test matching precision, status state machine rules, multi-NGO fulfillment, contribution recording, dynamic rankings, and end-to-end scenarios.
