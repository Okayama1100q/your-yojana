"""
Swasthika service configuration.

API keys are loaded from the .env file via pydantic-settings and python-dotenv.
They are NEVER hard-coded, logged, or returned in API responses.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dynamically locate .env across CWD, swasthika package root, and workspace root
_env_candidates = [
    Path.cwd() / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
]
_env_path = next((p for p in _env_candidates if p.is_file()), None)
if _env_path:
    load_dotenv(dotenv_path=str(_env_path), override=False)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_env_path) if _env_path else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    swasthika_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None


settings = Settings()

