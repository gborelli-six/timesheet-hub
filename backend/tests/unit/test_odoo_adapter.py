from unittest.mock import MagicMock, patch

import pytest

from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
    ConnectorAssignment,
    ServiceType,
    TimesheetEntry,
)
from app.adapters.odoo import OdooAdapter
from app.adapters.registry import adapter_registry

PATCH = "app.adapters.odoo.xmlrpc.client.ServerProxy"


def _config():
    return AdapterConfig(
        service=ServiceType.odoo,
        base_url="http://odoo.test",
        params={
            "connector_id": "uuid-odoo-1",
            "db": "db",
            "user": "admin",
            "password": "pass",
        },
    )


def _odoo_entry():
    return TimesheetEntry(
        date="2026-01-15",
        hours=8.0,
        note="Dev",
        connector_assignments=[
            ConnectorAssignment(
                connector_id="uuid-odoo-1", project_id="42", task_id="7"
            )
        ],
    )


def _jira_entry():
    return TimesheetEntry(
        date="2026-01-15",
        hours=4.0,
        note="Design",
        connector_assignments=[
            ConnectorAssignment(
                connector_id="uuid-jira-1", project_id="P1", task_id="T1"
            )
        ],
    )


def _make_proxy_factory(common_uid=42, execute_return=100):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = common_uid
    mock_obj = MagicMock()
    mock_obj.execute_kw.return_value = execute_return

    def factory(url, *args, **kwargs):
        return mock_common if "common" in url else mock_obj

    return factory, mock_common, mock_obj


# ---------------------------------------------------------------------------
# 1. validate — credenziali valide
# ---------------------------------------------------------------------------


def test_validate_ok():
    factory, mock_common, _ = _make_proxy_factory(common_uid=42)
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.validate(_config())
    assert result.ok is True
    assert result.message is None


# ---------------------------------------------------------------------------
# 2. validate — credenziali errate (authenticate ritorna False)
# ---------------------------------------------------------------------------


def test_validate_bad_credentials():
    factory, _, _ = _make_proxy_factory(common_uid=False)
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.validate(_config())
    assert result.ok is False
    assert result.message is not None


# ---------------------------------------------------------------------------
# 3. validate — errore di connessione (OSError)
# ---------------------------------------------------------------------------


def test_validate_connection_error():
    mock_common = MagicMock()
    mock_common.authenticate.side_effect = OSError("Connection refused")

    def factory(url, *args, **kwargs):
        return mock_common

    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.validate(_config())
    assert result.ok is False
    assert result.message is not None
    assert "Connection refused" in result.message


# ---------------------------------------------------------------------------
# 4. submit — 2 entry con lo stesso connector_id → success_count=2
# ---------------------------------------------------------------------------


def test_submit_two_rows_ok():
    factory, _, mock_obj = _make_proxy_factory()
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.submit([_odoo_entry(), _odoo_entry()], _config())
    assert result.success_count == 2
    assert result.error_count == 0
    assert mock_obj.execute_kw.call_count == 2


# ---------------------------------------------------------------------------
# 5. submit — entry mista odoo+jira → solo odoo viene inviata
# ---------------------------------------------------------------------------


def test_submit_skips_non_odoo_row():
    factory, _, mock_obj = _make_proxy_factory()
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.submit([_odoo_entry(), _jira_entry()], _config())
    assert result.success_count == 1
    assert mock_obj.execute_kw.call_count == 1


# ---------------------------------------------------------------------------
# 6. submit — authenticate rilancia socket.timeout → AdapterConnectionError
# ---------------------------------------------------------------------------


def test_submit_raises_connection_error_on_timeout():
    mock_common = MagicMock()
    mock_common.authenticate.side_effect = TimeoutError("timed out")

    def factory(url, *args, **kwargs):
        return mock_common

    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        with pytest.raises(AdapterConnectionError):
            adapter.submit([_odoo_entry()], _config())


# ---------------------------------------------------------------------------
# 7. submit — authenticate ritorna False → AdapterAuthError
# ---------------------------------------------------------------------------


def test_submit_raises_auth_error_on_bad_credentials():
    factory, _, _ = _make_proxy_factory(common_uid=False)
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        with pytest.raises(AdapterAuthError):
            adapter.submit([_odoo_entry()], _config())


# ---------------------------------------------------------------------------
# 8. OdooAdapter registrato nel registry globale
# ---------------------------------------------------------------------------


def test_odoo_adapter_is_registered():
    assert adapter_registry.get(ServiceType.odoo) is OdooAdapter


# ===========================================================================
# E7-4 — get_projects / get_tasks
# ===========================================================================


def _make_search_factory(common_uid=42, search_result=None):
    """Factory che restituisce mock_common per /common e mock_obj per /object."""
    mock_common = MagicMock()
    mock_common.authenticate.return_value = common_uid
    mock_obj = MagicMock()
    mock_obj.execute_kw.return_value = search_result or []

    def factory(url, *args, **kwargs):
        return mock_common if "common" in url else mock_obj

    return factory, mock_common, mock_obj


_PROJECTS_DATA = [
    {"id": 1, "name": "Progetto Alpha"},
    {"id": 2, "name": "Progetto Beta"},
]

_TASKS_DATA = {
    "1": [{"id": 101, "name": "Task Frontend"}, {"id": 102, "name": "Task Backend"}],
    "2": [{"id": 201, "name": "Task Design"}],
}


# ---------------------------------------------------------------------------
# 9. get_projects — senza query → lista completa, nessun ilike nel domain
# ---------------------------------------------------------------------------


def test_get_projects_no_query():
    factory, _, mock_obj = _make_search_factory(search_result=_PROJECTS_DATA)
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.get_projects(_config())
    assert len(result) == 2
    assert result[0].id == "1"
    assert result[0].name == "Progetto Alpha"
    call_args = mock_obj.execute_kw.call_args
    domain = call_args[0][5][0]  # positional: db, uid, pw, model, method, [domain]
    assert not any(f[0] == "name" for f in domain if isinstance(f, list))


# ---------------------------------------------------------------------------
# 10. get_projects — con query → ilike aggiunto al domain
# ---------------------------------------------------------------------------


def test_get_projects_with_query():
    factory, _, mock_obj = _make_search_factory(search_result=[_PROJECTS_DATA[0]])
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.get_projects(_config(), query="Alpha")
    call_args = mock_obj.execute_kw.call_args
    domain = call_args[0][5][0]
    assert ["name", "ilike", "Alpha"] in domain
    assert len(result) == 1


# ---------------------------------------------------------------------------
# 11. get_tasks — project_id valido → lista filtrata per progetto
# ---------------------------------------------------------------------------


def test_get_tasks_with_project_id():
    factory, _, mock_obj = _make_search_factory(search_result=_TASKS_DATA["1"])
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.get_tasks("1", _config())
    assert len(result) == 2
    assert result[0].id == "101"
    call_args = mock_obj.execute_kw.call_args
    domain = call_args[0][5][0]
    assert ["project_id", "=", 1] in domain


# ---------------------------------------------------------------------------
# 12. get_tasks — project_id inesistente → execute_kw ritorna [] → lista vuota
# ---------------------------------------------------------------------------


def test_get_tasks_unknown_project():
    factory, _, _ = _make_search_factory(search_result=[])
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.get_tasks("9999", _config())
    assert result == []


# ---------------------------------------------------------------------------
# 13. get_projects — OSError su execute_kw → AdapterConnectionError
# ---------------------------------------------------------------------------


def test_get_projects_connection_error():
    mock_common = MagicMock()
    mock_common.authenticate.return_value = 42
    mock_obj = MagicMock()
    mock_obj.execute_kw.side_effect = OSError("timeout")

    def factory(url, *args, **kwargs):
        return mock_common if "common" in url else mock_obj

    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        with pytest.raises(AdapterConnectionError):
            adapter.get_projects(_config())


# ---------------------------------------------------------------------------
# 14. get_tasks — project_id non numerico → lista vuota senza eccezione
# ---------------------------------------------------------------------------


def test_get_tasks_invalid_project_id():
    factory, _, mock_obj = _make_search_factory()
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        result = adapter.get_tasks("not-a-number", _config())
    assert result == []
    mock_obj.execute_kw.assert_not_called()


# ---------------------------------------------------------------------------
# 15. limit — params limit=500 → limite effettivo passato ad Odoo è 200
# ---------------------------------------------------------------------------


def test_limit_capped_at_200():
    config = AdapterConfig(
        service=ServiceType.odoo,
        base_url="http://odoo.test",
        params={"db": "db", "user": "admin", "password": "pass", "limit": 500},
    )
    factory, _, mock_obj = _make_search_factory(search_result=_PROJECTS_DATA)
    with patch(PATCH, side_effect=factory):
        adapter = OdooAdapter()
        adapter.get_projects(config)
    call_kwargs = mock_obj.execute_kw.call_args[0][6]  # keyword dict arg
    assert call_kwargs["limit"] == 200
