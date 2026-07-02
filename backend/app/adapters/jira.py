import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
    AdapterError,
    ImportResult,
    Project,
    RowError,
    ServiceType,
    Task,
    TimesheetAdapter,
    TimesheetEntry,
    ValidationResult,
)
from app.adapters.registry import adapter_registry

_AUTH_CODES = (401, 403)


class JiraAdapter(TimesheetAdapter):
    def _auth_header(self, config: AdapterConfig) -> str:
        email = config.params.get("user", "")
        token = config.params.get("password", "")
        encoded = base64.b64encode(f"{email}:{token}".encode()).decode()
        return f"Basic {encoded}"

    def _raise_from_http(self, e: urllib.error.HTTPError) -> None:
        code = e.code
        if code in _AUTH_CODES:
            raise AdapterAuthError(
                f"Jira: autenticazione non valida (HTTP {code})"
            ) from e
        if code >= 500:
            raise AdapterConnectionError(f"Jira: errore server (HTTP {code})") from e
        raise AdapterError(f"Jira: HTTP {code}") from e

    def _get(self, url: str, config: AdapterConfig) -> Any:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": self._auth_header(config),
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            self._raise_from_http(e)
        except OSError as e:
            raise AdapterConnectionError(str(e)) from e

    def _post(self, url: str, body: dict, config: AdapterConfig) -> Any:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": self._auth_header(config),
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            self._raise_from_http(e)
        except OSError as e:
            raise AdapterConnectionError(str(e)) from e

    def validate(self, config: AdapterConfig) -> ValidationResult:
        try:
            self._get(f"{config.base_url}/rest/api/3/myself", config)
            return ValidationResult(ok=True)
        except (AdapterAuthError, AdapterConnectionError, AdapterError) as e:
            return ValidationResult(ok=False, message=str(e))

    def get_projects(
        self, config: AdapterConfig, query: str | None = None
    ) -> list[Project]:
        limit = min(config.params.get("limit", 50), 200)
        params: dict[str, Any] = {"maxResults": limit}
        if query:
            params["query"] = query
        qs = urllib.parse.urlencode(params)
        url = f"{config.base_url}/rest/api/3/project/search?{qs}"
        data = self._get(url, config)
        return [Project(id=p["key"], name=p["name"]) for p in data.get("values", [])]

    def get_tasks(
        self, project_id: str, config: AdapterConfig, query: str | None = None
    ) -> list[Task]:
        limit = min(config.params.get("limit", 50), 200)
        safe_project = project_id.replace('"', '\\"')
        jql = f'project = "{safe_project}"'
        if query:
            safe_q = query.replace('"', '\\"')
            jql += f' AND text ~ "{safe_q}"'
        jql += " ORDER BY created DESC"
        params: dict[str, Any] = {
            "jql": jql,
            "maxResults": limit,
            "fields": "key,summary",
        }
        qs = urllib.parse.urlencode(params)
        url = f"{config.base_url}/rest/api/3/search/jql?{qs}"
        data = self._get(url, config)
        return [
            Task(id=issue["key"], name=issue["fields"]["summary"])
            for issue in data.get("issues", [])
        ]

    def submit(
        self, entries: list[TimesheetEntry], config: AdapterConfig
    ) -> ImportResult:
        result = ImportResult(success_count=0, error_count=0)
        for i, entry in enumerate(entries):
            if not entry.connector_assignments:
                continue
            assignment = entry.connector_assignments[0]
            issue_key = assignment.task_id
            if not issue_key:
                result.error_count += 1
                result.errors.append(RowError(row=i, message="Issue key Jira mancante"))
                continue
            body: dict[str, Any] = {
                "timeSpentSeconds": int(entry.hours * 3600),
                "started": f"{entry.date}T00:00:00.000+0000",
            }
            if entry.note:
                body["comment"] = {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": entry.note}],
                        }
                    ],
                }
            url = f"{config.base_url}/rest/api/3/issue/{issue_key}/worklog"
            try:
                self._post(url, body, config)
                result.success_count += 1
            except (AdapterAuthError, AdapterConnectionError):
                raise
            except Exception as e:
                result.error_count += 1
                result.errors.append(RowError(row=i, message=str(e)))
        return result


adapter_registry.register(ServiceType.jira, JiraAdapter)
