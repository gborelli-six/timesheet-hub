from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ambienti in cui E2E_TEST_MODE=true è lecito (CI, sviluppo locale, test).
# Tutto il resto — in primis 'production' (default) — è fail-closed: il flag è vietato.
E2E_ALLOWED_ENVIRONMENTS = {"ci", "local", "test"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://localhost/timesheet_hub"
    jwt_secret: str = ""
    token_encrypt_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    # Default sicuro: in assenza di un segnale esplicito si assume produzione.
    environment: str = "production"
    e2e_test_mode: bool = False

    @field_validator("database_url", mode="after")
    @classmethod
    def _force_psycopg_driver(cls, value: str) -> str:
        # Lo schema nudo `postgresql://` (e `postgres://` di Railway) sceglie il
        # dialetto psycopg2, che NON è tra le dipendenze: usiamo psycopg v3. Railway
        # inietta DATABASE_URL con schema nudo e non è modificabile, quindi la
        # normalizzazione vive qui, a monte di ogni engine (session.py, alembic/env.py).
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def _forbid_e2e_test_mode_outside_allowlist(self) -> "Settings":
        # Guardia non negoziabile (ADR-003-B): E2E_TEST_MODE abilita l'endpoint di
        # bypass auth POST /api/_test/session. Valutata alla COSTRUZIONE dei settings,
        # quindi scatta a import-time su ogni entrypoint — runtime uvicorn, preDeploy
        # `alembic upgrade head` (alembic/env.py importa questo modulo) e ogni script.
        if (
            self.e2e_test_mode
            and self.environment.strip().lower() not in E2E_ALLOWED_ENVIRONMENTS
        ):
            raise ValueError(
                f"E2E_TEST_MODE=true è vietato in environment '{self.environment}'. "
                f"Consentito solo in {sorted(E2E_ALLOWED_ENVIRONMENTS)}. "
                f"Il deploy/avvio fallisce intenzionalmente (ADR-003-B)."
            )
        return self


settings = Settings()
