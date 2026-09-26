"""Unit test di StubSource.

Lo stub è la single source of truth degli scenari E2E lato sorgente: il marker
arriva da `user_tokens.account_identifier`, quindi un seed che non valorizza
quel campo lascia lo scenario di errore inattivo — errore già commesso in E9a.
"""

import pytest

from app.sources.base import (
    AdapterAuthError,
    AdapterConnectionError,
    AdapterError,
    ServiceType,
    SourceConfig,
)
from app.sources.stub import StubSource


def _config(marker: str | None = None) -> SourceConfig:
    return SourceConfig(service=ServiceType.clockify, secret="stub", marker=marker)


def test_ok_marker_returns_rows() -> None:
    rows = StubSource().fetch_entries("2026-06-01", "2026-06-30", _config("E2E__OK"))

    assert len(rows) == 3
    assert all(row.hours > 0 for row in rows)
    assert {row.project for row in rows} == {"Progetto Alpha", "Progetto Beta"}


def test_no_marker_behaves_like_ok() -> None:
    rows = StubSource().fetch_entries("2026-06-01", "2026-06-30", _config())

    assert len(rows) == 3


def test_period_filters_rows() -> None:
    """Consente a uno scenario E2E di verificare che le date arrivino davvero."""
    rows = StubSource().fetch_entries("2026-06-02", "2026-06-02", _config("E2E__OK"))

    assert [row.date for row in rows] == ["2026-06-02"]


def test_period_outside_range_returns_empty() -> None:
    rows = StubSource().fetch_entries("2026-01-01", "2026-01-31", _config("E2E__OK"))

    assert rows == []


def test_down_marker_raises_connection_error() -> None:
    with pytest.raises(AdapterConnectionError):
        StubSource().fetch_entries("2026-06-01", "2026-06-30", _config("E2E__DOWN"))


def test_expired_marker_raises_auth_error() -> None:
    with pytest.raises(AdapterAuthError):
        StubSource().fetch_entries("2026-06-01", "2026-06-30", _config("E2E__EXPIRED"))


def test_fail_marker_raises_generic_error() -> None:
    with pytest.raises(AdapterError):
        StubSource().fetch_entries("2026-06-01", "2026-06-30", _config("E2E__FAIL"))


def test_validate_honours_markers() -> None:
    assert StubSource().validate(_config("E2E__OK")).ok is True
    with pytest.raises(AdapterConnectionError):
        StubSource().validate(_config("E2E__DOWN"))
    with pytest.raises(AdapterAuthError):
        StubSource().validate(_config("E2E__EXPIRED"))


def test_stub_is_not_registered_outside_e2e_mode() -> None:
    """La guardia E2E_TEST_MODE: in modalità normale il registry non deve
    contenere lo stub al posto della sorgente reale."""
    from app.sources.clockify import ClockifySource
    from app.sources.registry import source_registry

    assert source_registry.get(ServiceType.clockify) is ClockifySource
