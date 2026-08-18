from pymongo import MongoClient
from app.core.config import settings


client = MongoClient(
    settings.mongodb_uri,
    serverSelectionTimeoutMS=5000
)

db = client[settings.database_name]


def get_database():
    return db


def check_database_connection():
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False