from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Your Yojana - Cross-Sector NGO Collaboration Agent"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./your_yojana_agent.db"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
