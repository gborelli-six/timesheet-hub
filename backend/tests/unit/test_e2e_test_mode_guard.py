"""Guardia fail-closed E2E_TEST_MODE (ADR-003-B, DoD STORY-008).

Il flag abilita l'endpoint di bypass auth POST /api/_test/session e deve essere
vietato fuori da ci/local/test. La guardia è un model_validator su Settings, quindi
scatta alla costruzione dell'oggetto — runtime, preDeploy alembic e ogni entrypoint.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_flag_true_in_production_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(e2e_test_mode=True, environment="production")


@pytest.mark.parametrize("env", ["ci", "local", "test", "CI", "  Local  "])
def test_flag_true_in_allowlisted_environment_is_accepted(env: str) -> None:
    settings = Settings(e2e_test_mode=True, environment=env)
    assert settings.e2e_test_mode is True


def test_flag_false_in_production_is_accepted() -> None:
    settings = Settings(e2e_test_mode=False, environment="production")
    assert settings.e2e_test_mode is False


def test_unknown_environment_with_flag_true_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(e2e_test_mode=True, environment="staging")


def test_secure_defaults_no_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    # Senza env var: environment=production (default sicuro), flag off, nessun crash.
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("E2E_TEST_MODE", raising=False)
    settings = Settings(_env_file=None)
    assert settings.environment == "production"
    assert settings.e2e_test_mode is False
