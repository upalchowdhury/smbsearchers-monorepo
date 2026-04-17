"""Configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from pathlib import Path

# Look for .env in the scraper directory
_ENV_FILE = Path(__file__).parent.parent / ".env"
# Also check dealflow's .env.local as fallback
_ENV_FALLBACK = Path(__file__).parent.parent.parent / "dealflow" / ".env.local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(_ENV_FALLBACK), str(_ENV_FILE)],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="postgresql://dealflow:dealflow_dev@localhost:5432/dealflow"
    )

    # TinyFish (Tier 3 — cloud stealth browser)
    tinyfish_api_key: str = Field(default="")

    # browser-use cloud LLM (Tier 2 — no OpenAI key needed)
    browser_use_api_key: str = Field(default="")

    # OpenAI (Tier 2 fallback — browser-use or direct extraction)
    openai_api_key: str = Field(default="")

    # Anthropic (Tier 2 fallback)
    anthropic_api_key: str = Field(default="")

    # Google Gemini (Tier 2 fallback)
    gemini_api_key: str = Field(default="")

    # Playwright
    playwright_headless: bool = Field(default=True)

    # Scraper tuning
    scrape_max_pages: int = Field(default=50)
    scrape_delay_ms: int = Field(default=2000)

    log_level: str = Field(default="INFO")

    @property
    def has_tinyfish(self) -> bool:
        return bool(self.tinyfish_api_key and not self.tinyfish_api_key.startswith("tf-..."))

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key and not self.openai_api_key.startswith("sk-..."))

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key and not self.anthropic_api_key.startswith("sk-ant-..."))

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_browser_use(self) -> bool:
        return bool(self.browser_use_api_key)

    @property
    def has_any_llm(self) -> bool:
        """True if any LLM is configured for browser-use AI extraction."""
        return self.has_browser_use or self.has_openai or self.has_anthropic or self.has_gemini


settings = Settings()
