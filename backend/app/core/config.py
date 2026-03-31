from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    DATABASE_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_BUCKET: str = "facturas"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Comma-separated list of allowed CORS origins for production.
    # Example: "https://myapp.vercel.app,https://admin.myapp.com"
    # Leave empty to block all cross-origin requests in production.
    CORS_ORIGINS: str = ""

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.is_development:
            return ["*"]
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
