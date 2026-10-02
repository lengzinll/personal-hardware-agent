from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    APP_NAME: str = "Awesome API"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OLLAMA_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "ornith-1.5:9b"
    DB_PATH: str = "agent.sqlite"

    GPIO_CHIP: str = "/dev/gpiochip0"
    RED_PIN: int = 11
    YELLOW_PIN: int = 15
    GREEN_PIN: int = 16
    LAMP_PIN: int = 13
    LAMP_ACTIVE_LOW: bool = True


settings = Settings()

# Backwards-compatible variables used elsewhere in the project
GEMINI_API_KEY = settings.GEMINI_API_KEY
GEMINI_MODEL = settings.GEMINI_MODEL
OLLAMA_URL = settings.OLLAMA_URL
OLLAMA_MODEL = settings.OLLAMA_MODEL
DB_PATH = settings.DB_PATH
