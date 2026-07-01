import pytest

from app.adapters.base import (
    AdapterConfig,
    ImportResult,
    Project,
    ServiceType,
    Task,
    TimesheetAdapter,
    TimesheetEntry,
    ValidationResult,
)
from app.adapters.registry import AdapterRegistry


class ConcreteAdapter(TimesheetAdapter):
    def validate(self, config: AdapterConfig) -> ValidationResult:
        return ValidationResult(ok=True)

    def submit(
        self, entries: list[TimesheetEntry], config: AdapterConfig
    ) -> ImportResult:
        return ImportResult(success_count=0, error_count=0)

    def get_projects(self, query: str | None = None) -> list[Project]:
        return []

    def get_tasks(self, project_id: str, query: str | None = None) -> list[Task]:
        return []


@pytest.fixture
def fresh_registry() -> AdapterRegistry:
    return AdapterRegistry()


def test_register_and_get(fresh_registry: AdapterRegistry) -> None:
    fresh_registry.register(ServiceType.odoo, ConcreteAdapter)
    assert fresh_registry.get(ServiceType.odoo) is ConcreteAdapter


def test_get_unknown_service_raises_key_error(fresh_registry: AdapterRegistry) -> None:
    with pytest.raises(KeyError):
        fresh_registry.get(ServiceType.jira)


def test_register_non_adapter_raises_type_error(
    fresh_registry: AdapterRegistry,
) -> None:
    class NotAnAdapter:
        pass

    with pytest.raises(TypeError):
        fresh_registry.register(ServiceType.odoo, NotAnAdapter)  # type: ignore[arg-type]


def test_register_non_class_raises_type_error(fresh_registry: AdapterRegistry) -> None:
    with pytest.raises(TypeError):
        fresh_registry.register(ServiceType.odoo, "not-a-class")  # type: ignore[arg-type]


def test_register_overwrites_existing(fresh_registry: AdapterRegistry) -> None:
    class AnotherAdapter(TimesheetAdapter):
        def validate(self, config: AdapterConfig) -> ValidationResult:
            return ValidationResult(ok=False)

        def submit(
            self, entries: list[TimesheetEntry], config: AdapterConfig
        ) -> ImportResult:
            return ImportResult(success_count=0, error_count=0)

        def get_projects(self, query: str | None = None) -> list[Project]:
            return []

        def get_tasks(self, project_id: str, query: str | None = None) -> list[Task]:
            return []

    fresh_registry.register(ServiceType.odoo, ConcreteAdapter)
    fresh_registry.register(ServiceType.odoo, AnotherAdapter)
    assert fresh_registry.get(ServiceType.odoo) is AnotherAdapter
