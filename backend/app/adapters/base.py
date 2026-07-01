from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum


class ServiceType(StrEnum):
    odoo = "odoo"
    jira = "jira"
    linear = "linear"
    asana = "asana"


@dataclass
class Project:
    id: str
    name: str


@dataclass
class Task:
    id: str
    name: str


@dataclass
class ConnectorAssignment:
    connector_id: str
    project_id: str
    task_id: str


@dataclass
class TimesheetEntry:
    date: str
    hours: float
    note: str | None = None
    connector_assignments: list[ConnectorAssignment] = field(default_factory=list)


@dataclass
class RowError:
    row: int
    message: str


@dataclass
class ImportResult:
    success_count: int
    error_count: int
    errors: list[RowError] = field(default_factory=list)


@dataclass
class ValidationResult:
    ok: bool
    message: str | None = None


@dataclass
class AdapterConfig:
    service: ServiceType
    base_url: str
    marker: str | None = None  # usato dallo stub E2E (E2E__OK / E2E__FAIL / ...)
    # campi service-specific (db, user, password, ...)
    params: dict = field(default_factory=dict)


class AdapterError(Exception):
    pass


class AdapterAuthError(AdapterError):
    """Credenziali errate o scadute — il chiamante imposta needs_reauth."""


class AdapterConnectionError(AdapterError):
    """Server esterno irraggiungibile."""


class TimesheetAdapter(ABC):
    @abstractmethod
    def validate(self, config: AdapterConfig) -> ValidationResult: ...

    @abstractmethod
    def submit(
        self, entries: list[TimesheetEntry], config: AdapterConfig
    ) -> ImportResult: ...

    @abstractmethod
    def get_projects(
        self, config: AdapterConfig, query: str | None = None
    ) -> list[Project]: ...

    @abstractmethod
    def get_tasks(
        self, project_id: str, config: AdapterConfig, query: str | None = None
    ) -> list[Task]: ...
