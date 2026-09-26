"""Unit test del catalogo dei tipi di connettore.

Il catalogo è il punto in cui si dichiara che cosa è una sorgente, che cosa una
destinazione e quali campi specifici ciascun tipo richiede. Le prime asserzioni
sorvegliano la coerenza fra catalogo, enum del DB e registry: è la deriva che
in passato ha prodotto tipi selezionabili in UI e poi falliti al primo utilizzo.
"""

import pytest

from app.adapters.base import ServiceType
from app.adapters.registry import adapter_registry
from app.connector_types import (
    CONNECTOR_TYPES,
    ConfigField,
    ConfigValidationError,
    ConnectorTypeSpec,
    get_spec,
    is_source,
    validate_config,
)
from app.models.user_token import UserTokenService
from app.sources.registry import source_registry

# ── Coerenza del catalogo ──────────────────────────────────────────────────────


def test_catalog_covers_every_service_type() -> None:
    assert set(CONNECTOR_TYPES) == set(ServiceType)


def test_catalog_matches_db_enum() -> None:
    """ServiceType e UserTokenService devono restare allineati: il secondo è
    l'enum PostgreSQL, il primo il vocabolario applicativo."""
    assert {s.value for s in ServiceType} == {s.value for s in UserTokenService}


def test_every_type_is_source_or_destination() -> None:
    for spec in CONNECTOR_TYPES.values():
        assert spec.is_source or spec.is_destination, spec.service


def test_available_types_have_an_implementation() -> None:
    """Un tipo dichiarato disponibile deve avere un adapter o una sorgente
    registrata, altrimenti il connettore si crea e poi fallisce."""
    for spec in CONNECTOR_TYPES.values():
        if not spec.available:
            continue
        registered = False
        if spec.is_destination:
            registered = spec.service in adapter_registry._registry
        if spec.is_source:
            registered = registered or spec.service in source_registry._registry
        assert registered, f"{spec.service} è 'available' ma non ha implementazione"


def test_clockify_is_a_source_and_not_a_destination() -> None:
    spec = get_spec(ServiceType.clockify)
    assert spec.is_source is True
    assert spec.is_destination is False


def test_odoo_and_jira_are_destinations_only() -> None:
    for service in (ServiceType.odoo, ServiceType.jira):
        spec = get_spec(service)
        assert spec.is_destination is True
        assert spec.is_source is False


def test_is_source_helper() -> None:
    assert is_source("clockify") is True
    assert is_source("odoo") is False
    assert is_source("inesistente") is False


def test_get_spec_accepts_string_and_enum() -> None:
    assert get_spec("clockify") is get_spec(ServiceType.clockify)


def test_clockify_has_no_config_fields() -> None:
    """L'API key basta da sola: nessun campo di configurazione aggiuntivo."""
    assert get_spec(ServiceType.clockify).config_fields == ()


# ── validate_config ────────────────────────────────────────────────────────────


@pytest.fixture
def spec_with_optional_field(monkeypatch):
    """Spec sintetica con un campo opzionale.

    Nessun servizio del catalogo reale ha oggi un campo opzionale (Clockify
    non ne ha più, Odoo ha solo `db_name` obbligatorio): questi test
    verificano il comportamento generico di `validate_config` con un campo
    opzionale, indipendentemente da quali servizi lo dichiarino in un dato
    momento.
    """
    fake = ConnectorTypeSpec(
        service=ServiceType.jira,
        label="Jira",
        is_destination=True,
        config_fields=(ConfigField(key="foo", label="Foo", required=False),),
    )
    monkeypatch.setitem(CONNECTOR_TYPES, ServiceType.jira, fake)
    return fake


def test_required_field_missing_is_rejected() -> None:
    with pytest.raises(ConfigValidationError, match="obbligatorio"):
        validate_config(ServiceType.odoo, {})


def test_required_field_blank_is_rejected() -> None:
    with pytest.raises(ConfigValidationError, match="obbligatorio"):
        validate_config(ServiceType.odoo, {"db_name": "   "})


def test_required_field_present_is_accepted() -> None:
    assert validate_config(ServiceType.odoo, {"db_name": "prod"}) == {"db_name": "prod"}


def test_values_are_trimmed() -> None:
    assert validate_config(ServiceType.odoo, {"db_name": "  prod  "}) == {
        "db_name": "prod"
    }


def test_unknown_field_is_rejected() -> None:
    with pytest.raises(ConfigValidationError, match="non previsti"):
        validate_config(ServiceType.odoo, {"db_name": "prod", "colore": "rosso"})


def test_optional_field_absent_is_accepted(spec_with_optional_field) -> None:
    assert validate_config(ServiceType.jira, {}) == {}


def test_optional_blank_field_is_dropped_not_stored_empty(
    spec_with_optional_field,
) -> None:
    """Una stringa vuota in config renderebbe ambiguo 'non configurato'."""
    assert validate_config(ServiceType.jira, {"foo": ""}) == {}


def test_none_config_is_accepted_when_no_required_fields() -> None:
    assert validate_config(ServiceType.clockify, None) == {}


def test_none_config_is_rejected_when_a_field_is_required() -> None:
    with pytest.raises(ConfigValidationError):
        validate_config(ServiceType.odoo, None)


def test_numeric_value_is_coerced_to_string(spec_with_optional_field) -> None:
    assert validate_config(ServiceType.jira, {"foo": 42}) == {"foo": "42"}


def test_non_scalar_value_is_rejected(spec_with_optional_field) -> None:
    with pytest.raises(ConfigValidationError, match="stringa"):
        validate_config(ServiceType.jira, {"foo": {"nested": 1}})


def test_unknown_service_is_rejected() -> None:
    with pytest.raises(ConfigValidationError, match="sconosciuto"):
        validate_config("inesistente", {})


def test_type_without_config_fields_rejects_any_field() -> None:
    with pytest.raises(ConfigValidationError, match="non previsti"):
        validate_config(ServiceType.jira, {"db_name": "x"})
