from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Signal Clone API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/app.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    
    # Storage
    STORAGE_BACKEND: str = "local" # local or cloudinary
    UPLOAD_DIR: str = "data/uploads"
    BASE_URL: str = "http://localhost:3000"
    PUBLIC_API_URL: str = "http://localhost:8001"
    
    ENV: str = "development"
    
    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        case_sensitive = True

settings = Settings()
