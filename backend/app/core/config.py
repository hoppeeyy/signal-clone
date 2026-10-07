from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Signal Clone API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "sqlite:///./signal.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Storage
    STORAGE_BACKEND: str = "local" # local or cloudinary
    UPLOAD_DIR: str = "uploads"
    BASE_URL: str = "http://localhost:3000"
    PUBLIC_API_URL: str = "http://localhost:8001"

    class Config:
        case_sensitive = True

settings = Settings()
