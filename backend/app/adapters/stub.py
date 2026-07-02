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
from app.adapters.registry import AdapterRegistry, adapter_registry
from app.core.config import settings

_PROJECTS: list[Project] = [
    Project(id="1", name="Progetto Alpha"),
    Project(id="2", name="Progetto Beta"),
]

_TASKS: dict[str, list[Task]] = {
    "1": [
        Task(id="101", name="Task Frontend"),
        Task(id="102", name="Task Backend"),
    ],
    "2": [
        Task(id="201", name="Task Design"),
    ],
}

_PROJECTS_JIRA: list[Project] = [
    Project(id="PROJ-A", name="Jira Project Alpha"),
    Project(id="PROJ-B", name="Jira Project Beta"),
]

_TASKS_JIRA: dict[str, list[Task]] = {
    "PROJ-A": [
        Task(id="PROJ-A-1", name="Frontend Issue"),
        Task(id="PROJ-A-2", name="Backend Issue"),
    ],
    "PROJ-B": [
        Task(id="PROJ-B-1", name="Design Issue"),
    ],
}


class StubAdapter(TimesheetAdapter):
    """Adapter deterministico per E2E. Attivo solo con E2E_TEST_MODE=true."""

    def validate(self, config: AdapterConfig) -> ValidationResult:
        marker = config.marker or ""
        if "E2E__DOWN" in marker:
            raise AdapterConnectionError("Stub: backend non raggiungibile")
        if "E2E__EXPIRED" in marker:
            raise AdapterAuthError("Stub: credenziali scadute")
        return ValidationResult(ok=True)

    def submit(
        self, entries: list[TimesheetEntry], config: AdapterConfig
    ) -> ImportResult:
        marker = config.marker or ""
        if "E2E__DOWN" in marker:
            raise AdapterConnectionError("Stub: backend non raggiungibile")
        if "E2E__FAIL" in marker:
            errors = [
                RowError(row=i, message="Stub: errore applicativo")
                for i in range(len(entries))
            ]
            return ImportResult(
                success_count=0, error_count=len(entries), errors=errors
            )
        return ImportResult(success_count=len(entries), error_count=0, errors=[])

    def get_projects(
        self, config: AdapterConfig, query: str | None = None
    ) -> list[Project]:
        marker = config.marker or ""
        if "E2E__DOWN" in marker:
            raise AdapterConnectionError("Stub: backend non raggiungibile")
        if "E2E__EXPIRED" in marker:
            raise AdapterAuthError("Stub: credenziali scadute")
        projects = _PROJECTS_JIRA if config.service == ServiceType.jira else _PROJECTS
        if query:
            projects = [p for p in projects if query.lower() in p.name.lower()]
        return projects

    def get_tasks(
        self, project_id: str, config: AdapterConfig, query: str | None = None
    ) -> list[Task]:
        marker = config.marker or ""
        if "E2E__DOWN" in marker:
            raise AdapterConnectionError("Stub: backend non raggiungibile")
        if "E2E__EXPIRED" in marker:
            raise AdapterAuthError("Stub: credenziali scadute")
        task_map = _TASKS_JIRA if config.service == ServiceType.jira else _TASKS
        tasks = list(task_map.get(project_id, []))
        if query:
            tasks = [t for t in tasks if query.lower() in t.name.lower()]
        return tasks


def _maybe_register(registry: AdapterRegistry = adapter_registry) -> None:
    """Registra StubAdapter nel registry se E2E_TEST_MODE è attivo."""
    if settings.e2e_test_mode:
        registry.register(ServiceType.odoo, StubAdapter)
        registry.register(ServiceType.jira, StubAdapter)


_maybe_register()
