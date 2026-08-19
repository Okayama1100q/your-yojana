from app.routers.master import router as master_router
from app.routers.ngos import router as ngos_router
from app.routers.services import router as services_router
from app.routers.coverage import router as coverage_router
from app.routers.collaboration import router as collaboration_router
from app.routers.contributions import router as contributions_router
from app.routers.ranking import router as ranking_router
from app.routers.admin import router as admin_router

__all__ = [
    "master_router",
    "ngos_router",
    "services_router",
    "coverage_router",
    "collaboration_router",
    "contributions_router",
    "ranking_router",
    "admin_router",
]
