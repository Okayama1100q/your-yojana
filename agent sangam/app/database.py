"""Backward-compatibility re-export from app.core.database."""
from app.core.database import engine, SessionLocal, Base, get_db, init_db, set_sqlite_pragma

__all__ = ["engine", "SessionLocal", "Base", "get_db", "init_db", "set_sqlite_pragma"]
