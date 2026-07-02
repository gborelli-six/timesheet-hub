import json
import urllib.error
from io import BytesIO
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
from app.adapters.jira import JiraAdapter
from app.adapters.registry import adapter_registry

PATCH_URLOPEN = "app.adapters.jira.urllib.request.urlopen"


def _config(**extra_params):
    params = {"user": "user@example.com", "password": "api-token-123"}
    params.update(extra_params)
    return AdapterConfig(
        service=ServiceType.jira,
        base_url="https://test.atlassian.net",
        params=params,
    )


def _fake_resp(data: dict):
    """Context manager che simula urlopen restituendo JSON."""
    body = json.dumps(data).encode()
    resp = MagicMock()
    resp.read.return_value = body
    resp.__enter__ = lambda s: s
    resp.__exit__ = MagicMock(return_value=False)
    return resp


def _http_error(code: int):
    return urllib.error.HTTPError(url="", code=code, msg="", hdrs=None, fp=BytesIO())


def _jira_entry(task_id: str = "PROJ-1", hours: float = 8.0, note: str | None = None):
    return TimesheetEntry(
        date="2026-07-01",
        hours=hours,
        note=note,
        connector_assignments=[
            ConnectorAssignment(
                connector_id="jira-work", project_id="PROJ", task_id=task_id
            )
        ],
    )


# ---------------------------------------------------------------------------
# 1. validate — credenziali valide
# ---------------------------------------------------------------------------


def test_validate_ok():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"accountId": "abc123"})):
        adapter = JiraAdapter()
        result = adapter.validate(_config())
    assert result.ok is True
    assert result.message is None


# ---------------------------------------------------------------------------
# 2. validate — credenziali non valide (401)
# ---------------------------------------------------------------------------


def test_validate_auth_error():
    with patch(PATCH_URLOPEN, side_effect=_http_error(401)):
        adapter = JiraAdapter()
        result = adapter.validate(_config())
    assert result.ok is False
    assert "401" in (result.message or "")


# ---------------------------------------------------------------------------
# 3. validate — server irraggiungibile (OSError)
# ---------------------------------------------------------------------------


def test_validate_connection_error():
    with patch(PATCH_URLOPEN, side_effect=OSError("Connection refused")):
        adapter = JiraAdapter()
        result = adapter.validate(_config())
    assert result.ok is False
    assert result.message is not None


# ---------------------------------------------------------------------------
# 4. get_projects — lista completa senza query
# ---------------------------------------------------------------------------

_PROJECTS_RESP = {
    "values": [
        {"id": "10001", "key": "ALPHA", "name": "Project Alpha"},
        {"id": "10002", "key": "BETA", "name": "Project Beta"},
    ]
}


def test_get_projects_no_query():
    with patch(PATCH_URLOPEN, return_value=_fake_resp(_PROJECTS_RESP)) as mock_open:
        adapter = JiraAdapter()
        result = adapter.get_projects(_config())
    assert len(result) == 2
    assert result[0].id == "ALPHA"
    assert result[0].name == "Project Alpha"
    url_used = mock_open.call_args[0][0].full_url
    assert "maxResults=50" in url_used
    assert "query=" not in url_used


# ---------------------------------------------------------------------------
# 5. get_projects — query inclusa nell'URL
# ---------------------------------------------------------------------------


def test_get_projects_with_query():
    one = {"values": [_PROJECTS_RESP["values"][0]]}
    with patch(PATCH_URLOPEN, return_value=_fake_resp(one)) as mock_open:
        adapter = JiraAdapter()
        result = adapter.get_projects(_config(), query="Alpha")
    assert len(result) == 1
    url_used = mock_open.call_args[0][0].full_url
    assert "query=Alpha" in url_used


# ---------------------------------------------------------------------------
# 6. get_projects — 401 → AdapterAuthError propagato
# ---------------------------------------------------------------------------


def test_get_projects_auth_error():
    with patch(PATCH_URLOPEN, side_effect=_http_error(401)):
        adapter = JiraAdapter()
        with pytest.raises(AdapterAuthError):
            adapter.get_projects(_config())


# ---------------------------------------------------------------------------
# 7. get_projects — OSError → AdapterConnectionError propagato
# ---------------------------------------------------------------------------


def test_get_projects_connection_error():
    with patch(PATCH_URLOPEN, side_effect=OSError("timeout")):
        adapter = JiraAdapter()
        with pytest.raises(AdapterConnectionError):
            adapter.get_projects(_config())


# ---------------------------------------------------------------------------
# 8. get_projects — limit capped a 200
# ---------------------------------------------------------------------------


def test_get_projects_limit_capped():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"values": []})) as mock_open:
        adapter = JiraAdapter()
        adapter.get_projects(_config(limit=500))
    url_used = mock_open.call_args[0][0].full_url
    assert "maxResults=200" in url_used


# ---------------------------------------------------------------------------
# 9. get_tasks — lista senza query (JQL senza text~)
# ---------------------------------------------------------------------------

_ISSUES_RESP = {
    "issues": [
        {"key": "PROJ-1", "fields": {"summary": "Frontend task"}},
        {"key": "PROJ-2", "fields": {"summary": "Backend task"}},
    ]
}


def test_get_tasks_no_query():
    with patch(PATCH_URLOPEN, return_value=_fake_resp(_ISSUES_RESP)) as mock_open:
        adapter = JiraAdapter()
        result = adapter.get_tasks("MYPROJ", _config())
    assert len(result) == 2
    assert result[0].id == "PROJ-1"
    assert result[0].name == "Frontend task"
    url_used = mock_open.call_args[0][0].full_url
    assert "MYPROJ" in url_used
    assert "text+~" not in url_used


# ---------------------------------------------------------------------------
# 10. get_tasks — query aggiunta al JQL
# ---------------------------------------------------------------------------


def test_get_tasks_with_query():
    one = {"issues": [_ISSUES_RESP["issues"][0]]}
    with patch(PATCH_URLOPEN, return_value=_fake_resp(one)) as mock_open:
        adapter = JiraAdapter()
        result = adapter.get_tasks("MYPROJ", _config(), query="frontend")
    assert len(result) == 1
    url_used = mock_open.call_args[0][0].full_url
    assert "frontend" in url_used


# ---------------------------------------------------------------------------
# 11. get_tasks — progetto senza issue → lista vuota
# ---------------------------------------------------------------------------


def test_get_tasks_empty():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"issues": []})):
        adapter = JiraAdapter()
        result = adapter.get_tasks("EMPTY", _config())
    assert result == []


# ---------------------------------------------------------------------------
# 12. get_tasks — 403 → AdapterAuthError propagato
# ---------------------------------------------------------------------------


def test_get_tasks_auth_error():
    with patch(PATCH_URLOPEN, side_effect=_http_error(403)):
        adapter = JiraAdapter()
        with pytest.raises(AdapterAuthError):
            adapter.get_tasks("PROJ", _config())


# ---------------------------------------------------------------------------
# 13. submit — 2 entry OK → success_count=2, POST chiamato 2 volte
# ---------------------------------------------------------------------------


def test_submit_two_rows_ok():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"id": "10001"})) as mock_open:
        adapter = JiraAdapter()
        entries = [_jira_entry("PROJ-1"), _jira_entry("PROJ-2")]
        result = adapter.submit(entries, _config())
    assert result.success_count == 2
    assert result.error_count == 0
    assert mock_open.call_count == 2


# ---------------------------------------------------------------------------
# 14. submit — task_id mancante → row error, non viene chiamato urlopen
# ---------------------------------------------------------------------------


def test_submit_missing_task_id():
    entry = TimesheetEntry(
        date="2026-07-01",
        hours=8.0,
        connector_assignments=[
            ConnectorAssignment(connector_id="jira-work", project_id="PROJ", task_id="")
        ],
    )
    with patch(PATCH_URLOPEN) as mock_open:
        adapter = JiraAdapter()
        result = adapter.submit([entry], _config())
    assert result.success_count == 0
    assert result.error_count == 1
    assert "mancante" in result.errors[0].message
    mock_open.assert_not_called()


# ---------------------------------------------------------------------------
# 15. submit — note inclusa nel body come Atlassian Document Format
# ---------------------------------------------------------------------------


def test_submit_includes_note_as_adf():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"id": "10001"})) as mock_open:
        adapter = JiraAdapter()
        adapter.submit([_jira_entry(note="dev session")], _config())
    posted_body = json.loads(mock_open.call_args[0][0].data)
    assert "comment" in posted_body
    assert posted_body["comment"]["type"] == "doc"


# ---------------------------------------------------------------------------
# 16. submit — 401 durante il POST → AdapterAuthError propagato
# ---------------------------------------------------------------------------


def test_submit_propagates_auth_error():
    with patch(PATCH_URLOPEN, side_effect=_http_error(401)):
        adapter = JiraAdapter()
        with pytest.raises(AdapterAuthError):
            adapter.submit([_jira_entry()], _config())


# ---------------------------------------------------------------------------
# 17. submit — ore convertite in secondi corretti
# ---------------------------------------------------------------------------


def test_submit_converts_hours_to_seconds():
    with patch(PATCH_URLOPEN, return_value=_fake_resp({"id": "10001"})) as mock_open:
        adapter = JiraAdapter()
        adapter.submit([_jira_entry(hours=1.5)], _config())
    posted_body = json.loads(mock_open.call_args[0][0].data)
    assert posted_body["timeSpentSeconds"] == 5400


# ---------------------------------------------------------------------------
# 18. JiraAdapter registrato nel registry globale
# ---------------------------------------------------------------------------


def test_jira_adapter_is_registered():
    assert adapter_registry.get(ServiceType.jira) is JiraAdapter
