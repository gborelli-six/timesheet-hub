import socket
import xmlrpc.client

from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
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

_CONN_ERRORS = (OSError, socket.timeout, xmlrpc.client.ProtocolError)


class OdooAdapter(TimesheetAdapter):
    def _authenticate(self, config: AdapterConfig) -> int:
        """Ritorna uid. Rilancia AdapterAuthError / AdapterConnectionError."""
        db = config.params.get("db", "")
        user = config.params.get("user", "")
        password = config.params.get("password", "")
        try:
            common = xmlrpc.client.ServerProxy(f"{config.base_url}/xmlrpc/2/common")
            uid = common.authenticate(db, user, password, {})
        except _CONN_ERRORS as e:
            raise AdapterConnectionError(str(e)) from e
        if not uid:
            raise AdapterAuthError("Credenziali non valide o database errato")
        return int(uid)

    def validate(self, config: AdapterConfig) -> ValidationResult:
        try:
            self._authenticate(config)
            return ValidationResult(ok=True)
        except AdapterAuthError as e:
            return ValidationResult(ok=False, message=str(e))
        except AdapterConnectionError as e:
            return ValidationResult(ok=False, message=str(e))

    def submit(
        self, entries: list[TimesheetEntry], config: AdapterConfig
    ) -> ImportResult:
        uid = self._authenticate(config)
        db = config.params.get("db", "")
        password = config.params.get("password", "")
        obj = xmlrpc.client.ServerProxy(f"{config.base_url}/xmlrpc/2/object")
        result = ImportResult(success_count=0, error_count=0)

        for i, entry in enumerate(entries):
            if not entry.connector_assignments:
                continue
            assignment = entry.connector_assignments[0]
            if assignment.connector_id != config.params.get("connector_id"):
                continue

            record = {
                "date": entry.date,
                "project_id": int(assignment.project_id)
                if assignment.project_id
                else False,
                "task_id": int(assignment.task_id) if assignment.task_id else False,
                "unit_amount": entry.hours,
                "name": entry.note or "",
            }
            try:
                obj.execute_kw(
                    db, uid, password, "account.analytic.line", "create", [record]
                )
                result.success_count += 1
            except _CONN_ERRORS as e:
                raise AdapterConnectionError(str(e)) from e
            except Exception as e:
                result.error_count += 1
                result.errors.append(RowError(row=i, message=str(e)))

        return result

    def get_projects(
        self, config: AdapterConfig, query: str | None = None
    ) -> list[Project]:
        uid = self._authenticate(config)
        db = config.params.get("db", "")
        password = config.params.get("password", "")
        limit = min(config.params.get("limit", 50), 200)
        domain: list = [["active", "=", True]]
        if query:
            domain.append(["name", "ilike", query])
        try:
            obj = xmlrpc.client.ServerProxy(f"{config.base_url}/xmlrpc/2/object")
            records = obj.execute_kw(
                db,
                uid,
                password,
                "project.project",
                "search_read",
                [domain],
                {"fields": ["id", "name"], "limit": limit},
            )
        except _CONN_ERRORS as e:
            raise AdapterConnectionError(str(e)) from e
        return [Project(id=str(r["id"]), name=r["name"]) for r in records]

    def get_tasks(
        self, project_id: str, config: AdapterConfig, query: str | None = None
    ) -> list[Task]:
        try:
            pid = int(project_id)
        except (ValueError, TypeError):
            return []
        uid = self._authenticate(config)
        db = config.params.get("db", "")
        password = config.params.get("password", "")
        limit = min(config.params.get("limit", 50), 200)
        domain: list = [["project_id", "=", pid], ["active", "=", True]]
        if query:
            domain.append(["name", "ilike", query])
        try:
            obj = xmlrpc.client.ServerProxy(f"{config.base_url}/xmlrpc/2/object")
            records = obj.execute_kw(
                db,
                uid,
                password,
                "project.task",
                "search_read",
                [domain],
                {"fields": ["id", "name"], "limit": limit},
            )
        except _CONN_ERRORS as e:
            raise AdapterConnectionError(str(e)) from e
        return [Task(id=str(r["id"]), name=r["name"]) for r in records]


adapter_registry.register(ServiceType.odoo, OdooAdapter)
