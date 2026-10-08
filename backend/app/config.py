from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE = "sqlite:///" + (BACKEND_DIR / "gridline.db").as_posix()


class Settings(BaseSettings):
    database_url: str = DEFAULT_SQLITE
    jwt_secret: str = "dev-only-gridline-local-secret-key"
    jwt_exp_minutes: int = 60 * 12

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR.parent / ".env"), str(BACKEND_DIR / ".env")),
        extra="ignore",
    )


settings = Settings()
