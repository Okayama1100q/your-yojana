"""Top-level admin actor package."""
from app.admin.router import admin_router
from app.admin.service import AdminNGOService

__all__ = ["admin_router", "AdminNGOService"]
