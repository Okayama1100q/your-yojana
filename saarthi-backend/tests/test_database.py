from app.core.database import check_database_connection


def test_mongodb_connection():
    assert check_database_connection() is True