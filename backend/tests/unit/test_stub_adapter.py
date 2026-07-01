import pytest

from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
    Project,
    ServiceType,
    Task,
    TimesheetEntry,
    ValidationResult,
)
from app.adapters.registry import AdapterRegistry
from app.adapters.stub import StubAdapter, _maybe_register


@pytest.fixture
def stub() -> StubAdapter:
    return StubAdapter()


def cfg(marker: str | None = None) -> AdapterConfig:
    return AdapterConfig(
        service=ServiceType.odoo, base_url="http://stub", marker=marker
    )


def make_entries(n: int = 2) -> list[TimesheetEntry]:
    return [TimesheetEntry(date="2024-01-01", hours=8.0) for _ in range(n)]


# ── validate ──────────────────────────────────────────────────────────────────


def test_validate_ok(stub: StubAdapter) -> None:
    result = stub.validate(cfg("E2E__OK"))
    assert isinstance(result, ValidationResult)
    assert result.ok is True


def test_validate_no_marker(stub: StubAdapter) -> None:
    result = stub.validate(cfg(None))
    assert result.ok is True


def test_validate_fail_defaults_to_ok(stub: StubAdapter) -> None:
    # E2E__FAIL indica errori a submit, non a validate
    result = stub.validate(cfg("E2E__FAIL"))
    assert result.ok is True


def test_validate_expired(stub: StubAdapter) -> None:
    with pytest.raises(AdapterAuthError):
        stub.validate(cfg("E2E__EXPIRED"))


def test_validate_down(stub: StubAdapter) -> None:
    with pytest.raises(AdapterConnectionError):
        stub.validate(cfg("E2E__DOWN"))


def test_validate_down_takes_priority_over_expired(stub: StubAdapter) -> None:
    with pytest.raises(AdapterConnectionError):
        stub.validate(cfg("E2E__DOWN E2E__EXPIRED"))


# ── submit ────────────────────────────────────────────────────────────────────


def test_submit_ok(stub: StubAdapter) -> None:
    result = stub.submit(make_entries(2), cfg("E2E__OK"))
    assert result.success_count == 2
    assert result.error_count == 0
    assert result.errors == []


def test_submit_fail(stub: StubAdapter) -> None:
    result = stub.submit(make_entries(2), cfg("E2E__FAIL"))
    assert result.success_count == 0
    assert result.error_count == 2
    assert len(result.errors) == 2
    assert all(e.message == "Stub: errore applicativo" for e in result.errors)


def test_submit_fail_error_rows_are_indexed(stub: StubAdapter) -> None:
    result = stub.submit(make_entries(3), cfg("E2E__FAIL"))
    assert [e.row for e in result.errors] == [0, 1, 2]


def test_submit_down(stub: StubAdapter) -> None:
    with pytest.raises(AdapterConnectionError):
        stub.submit(make_entries(), cfg("E2E__DOWN"))


def test_submit_empty_entries_ok(stub: StubAdapter) -> None:
    result = stub.submit([], cfg("E2E__OK"))
    assert result.success_count == 0
    assert result.error_count == 0


# ── get_projects ──────────────────────────────────────────────────────────────


def test_get_projects_ok_returns_all(stub: StubAdapter) -> None:
    projects = stub.get_projects(cfg("E2E__OK"))
    assert len(projects) == 2
    assert all(isinstance(p, Project) for p in projects)


def test_get_projects_no_query_returns_all(stub: StubAdapter) -> None:
    projects = stub.get_projects(cfg("E2E__OK"), query=None)
    names = [p.name for p in projects]
    assert "Progetto Alpha" in names
    assert "Progetto Beta" in names


def test_get_projects_query_filters_by_substring(stub: StubAdapter) -> None:
    projects = stub.get_projects(cfg("E2E__OK"), query="alpha")
    assert len(projects) == 1
    assert projects[0].id == "1"
    assert projects[0].name == "Progetto Alpha"


def test_get_projects_query_case_insensitive(stub: StubAdapter) -> None:
    projects = stub.get_projects(cfg("E2E__OK"), query="ALPHA")
    assert len(projects) == 1
    assert projects[0].name == "Progetto Alpha"


def test_get_projects_query_no_match(stub: StubAdapter) -> None:
    projects = stub.get_projects(cfg("E2E__OK"), query="xyz")
    assert projects == []


def test_get_projects_down(stub: StubAdapter) -> None:
    with pytest.raises(AdapterConnectionError):
        stub.get_projects(cfg("E2E__DOWN"))


def test_get_projects_expired(stub: StubAdapter) -> None:
    with pytest.raises(AdapterAuthError):
        stub.get_projects(cfg("E2E__EXPIRED"))


# ── get_tasks ─────────────────────────────────────────────────────────────────


def test_get_tasks_project_1(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("1", cfg("E2E__OK"))
    assert len(tasks) == 2
    assert all(isinstance(t, Task) for t in tasks)
    names = [t.name for t in tasks]
    assert "Task Frontend" in names
    assert "Task Backend" in names


def test_get_tasks_project_2(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("2", cfg("E2E__OK"))
    assert len(tasks) == 1
    assert tasks[0].name == "Task Design"


def test_get_tasks_unknown_project_returns_empty(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("999", cfg("E2E__OK"))
    assert tasks == []


def test_get_tasks_query_filters_by_substring(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("1", cfg("E2E__OK"), query="front")
    assert len(tasks) == 1
    assert tasks[0].id == "101"
    assert tasks[0].name == "Task Frontend"


def test_get_tasks_query_case_insensitive(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("1", cfg("E2E__OK"), query="BACK")
    assert len(tasks) == 1
    assert tasks[0].name == "Task Backend"


def test_get_tasks_query_no_match(stub: StubAdapter) -> None:
    tasks = stub.get_tasks("1", cfg("E2E__OK"), query="xyz")
    assert tasks == []


def test_get_tasks_down(stub: StubAdapter) -> None:
    with pytest.raises(AdapterConnectionError):
        stub.get_tasks("1", cfg("E2E__DOWN"))


def test_get_tasks_expired(stub: StubAdapter) -> None:
    with pytest.raises(AdapterAuthError):
        stub.get_tasks("1", cfg("E2E__EXPIRED"))


# ── guard E2E_TEST_MODE ───────────────────────────────────────────────────────


def test_guard_does_not_register_when_e2e_disabled(monkeypatch) -> None:
    import app.adapters.stub as stub_module

    fresh = AdapterRegistry()
    monkeypatch.setattr(
        stub_module, "settings", type("S", (), {"e2e_test_mode": False})()
    )
    _maybe_register(fresh)

    with pytest.raises(KeyError):
        fresh.get(ServiceType.odoo)


def test_guard_registers_when_e2e_enabled(monkeypatch) -> None:
    import app.adapters.stub as stub_module

    fresh = AdapterRegistry()
    monkeypatch.setattr(
        stub_module, "settings", type("S", (), {"e2e_test_mode": True})()
    )
    _maybe_register(fresh)

    assert fresh.get(ServiceType.odoo) is StubAdapter
