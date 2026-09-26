import pytest

from app.sources.base import (
    ServiceType,
    SourceConfig,
    SourceRow,
    TimesheetSource,
    ValidationResult,
)
from app.sources.registry import SourceRegistry


class ConcreteSource(TimesheetSource):
    def validate(self, config: SourceConfig) -> ValidationResult:
        return ValidationResult(ok=True)

    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        return []


@pytest.fixture
def fresh_registry() -> SourceRegistry:
    return SourceRegistry()


def test_register_and_get(fresh_registry: SourceRegistry) -> None:
    fresh_registry.register(ServiceType.clockify, ConcreteSource)
    assert fresh_registry.get(ServiceType.clockify) is ConcreteSource


def test_get_unknown_service_raises_key_error(fresh_registry: SourceRegistry) -> None:
    with pytest.raises(KeyError):
        fresh_registry.get(ServiceType.clockify)


def test_register_non_source_raises_type_error(fresh_registry: SourceRegistry) -> None:
    class NotASource:
        pass

    with pytest.raises(TypeError):
        fresh_registry.register(ServiceType.clockify, NotASource)  # type: ignore[arg-type]


def test_register_non_class_raises_type_error(fresh_registry: SourceRegistry) -> None:
    with pytest.raises(TypeError):
        fresh_registry.register(ServiceType.clockify, "not-a-class")  # type: ignore[arg-type]


def test_register_overwrites_existing(fresh_registry: SourceRegistry) -> None:
    """È il meccanismo con cui StubSource sostituisce la sorgente reale in E2E."""

    class AnotherSource(ConcreteSource):
        pass

    fresh_registry.register(ServiceType.clockify, ConcreteSource)
    fresh_registry.register(ServiceType.clockify, AnotherSource)
    assert fresh_registry.get(ServiceType.clockify) is AnotherSource


def test_adapter_registered_service_is_not_a_source() -> None:
    """Un servizio di destinazione non è per ciò stesso una sorgente.

    Il registro delle sorgenti è separato da quello degli adapter: chiedere
    Odoo come sorgente deve fallire, non restituire l'adapter di destinazione.
    """
    from app.sources.registry import source_registry

    with pytest.raises(KeyError):
        source_registry.get(ServiceType.odoo)
