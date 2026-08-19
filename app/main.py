from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.core.seed.seed_runner import run_seed_all
from app.user.router import user_router
from app.admin.router import admin_router
from app.ngo.router import ngo_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize database tables programmatically
    init_db()

    # 2. Seed master data & 20 demo NGOs automatically if database is fresh
    db = SessionLocal()
    try:
        from app.core.models.master import ServiceCategory
        cat_count = db.query(ServiceCategory).count()
        if cat_count == 0:
            run_seed_all(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# SANGAM - Cross-Sector NGO Collaboration Agent for Your Yojana

Deterministic, rule-based backend service coordinating citizen assistance requirements with verified NGO capacities across India.

### Architecture Actors:
- **USER (Citizen / Calling App)**: Master categories & requirements, collaboration request creation, deterministic matching results, Amazon-style tracking timeline.
- **NGO (Self-Service NGO Portal)**: NGO registration in `PENDING` status, service inventory & delivery duration, geographic coverage, accepting/rejecting requests, status lifecycle tracking (`ACCEPTED` → `PREPARING` → `DISPATCHED` → `IN_TRANSIT` → `DELIVERED` → `RECEIVED` → `COMPLETED`), verified contributions and individual ranking.
- **ADMIN (Platform Oversight)**: Reviewing pending NGO registrations, approving/rejecting/suspending NGOs, and monitoring the live dynamic leaderboard.
- **CORE / SHARED**: Programmatic database engine, 100-point deterministic matching engine, dynamic performance ranking calculation, and standardized master data.
""",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health & Info"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "redoc": "/redoc",
        "api_v1_prefix": settings.API_V1_PREFIX,
        "architecture": "Role-Based Modular Backend (USER, NGO, ADMIN, CORE)",
    }


# Include Routers: User, Admin (with static /ngos/ranking), NGO (with /ngos/register & /ngos/{ngo_id})
app.include_router(user_router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)
app.include_router(ngo_router, prefix=settings.API_V1_PREFIX)
