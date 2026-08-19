"""Standalone database initialization and seeding script."""
import sys
from app.core.database import init_db, SessionLocal
from app.core.seed.seed_runner import run_seed_all
from app.core.models.master import ServiceCategory, Requirement
from app.core.models.ngo import NGO


def main():
    print("==================================================")
    print("Initializing Database and Seeding Master & Demo Data")
    print("==================================================")

    init_db()
    db = SessionLocal()
    try:
        run_seed_all(db)
        cat_count = db.query(ServiceCategory).count()
        req_count = db.query(Requirement).count()
        ngo_count = db.query(NGO).count()
        print(f"Successfully seeded {cat_count} master categories.")
        print(f"Successfully seeded {req_count} master requirements.")
        print(f"Successfully seeded {ngo_count} fictional demo NGOs with services, coverage & contributions.")
        print("Database is ready.")
    except Exception as e:
        print(f"Error during seeding: {e}", file=sys.stderr)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
