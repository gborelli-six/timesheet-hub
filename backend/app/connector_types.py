"""Catalogo dei tipi di connettore.

Unico posto che descrive, per ogni servizio: se è una sorgente da cui leggere le
voci, una destinazione su cui scriverle o entrambe, e quali campi di
configurazione specifici richiede.

Prima di questo catalogo i campi per-tipo erano colonne nullable sulla tabella
condivisa `user_tokens` (`db_name`, aggiunta per Odoo in 0006): ogni nuova
integrazione avrebbe sporcato lo schema. Adesso vivono nella colonna JSONB
`user_tokens.config`, validata qui e resa dal frontend come form dinamico via
`GET /api/connector-types`.
"""

from dataclasses import dataclass, field
from typing import Literal

from app.adapters.base import ServiceType

FieldType = Literal["string", "url"]


@dataclass(frozen=True)
class ConfigField:
    """Un campo della colonna JSONB `config`, specifico di un tipo di servizio."""

    key: str
    label: str
    type: FieldType = "string"
    required: bool = False
    help: str | None = None


@dataclass(frozen=True)
class ConnectorTypeSpec:
    service: ServiceType
    label: str
    # Un servizio può essere sorgente, destinazione o entrambe.
    is_source: bool = False
    is_destination: bool = False
    # False quando il tipo è selezionabile ma nessun adapter/source lo
    # implementa ancora: la UI lo mostra disabilitato invece di lasciar creare
    # un connettore che fallirebbe al primo utilizzo.
    available: bool = True
    secret_label: str = "Segreto"
    secret_help: str | None = None
    requires_base_url: bool = False
    requires_account_identifier: bool = False
    account_identifier_label: str = "Identificativo account"
    config_fields: tuple[ConfigField, ...] = field(default_factory=tuple)


CONNECTOR_TYPES: dict[ServiceType, ConnectorTypeSpec] = {
    ServiceType.odoo: ConnectorTypeSpec(
        service=ServiceType.odoo,
        label="Odoo",
        is_destination=True,
        secret_label="Password",
        requires_base_url=True,
        requires_account_identifier=True,
        account_identifier_label="Utente",
        config_fields=(
            ConfigField(
                key="db_name",
                label="Nome database",
                required=True,
                help="Il database dell'istanza Odoo su cui scrivere i timesheet.",
            ),
        ),
    ),
    ServiceType.jira: ConnectorTypeSpec(
        service=ServiceType.jira,
        label="Jira",
        is_destination=True,
        secret_label="API token",
        requires_base_url=True,
        requires_account_identifier=True,
        account_identifier_label="Email",
    ),
    ServiceType.clockify: ConnectorTypeSpec(
        service=ServiceType.clockify,
        label="Clockify",
        is_source=True,
        secret_label="API key",
        secret_help="Clockify → Profile settings → API.",
    ),
    # Previsti dall'enum del DB e dalla roadmap (E11) ma senza implementazione:
    # marcati non disponibili così la UI non ne consente la creazione.
    ServiceType.linear: ConnectorTypeSpec(
        service=ServiceType.linear,
        label="Linear",
        is_destination=True,
        available=False,
        secret_label="API key",
    ),
    ServiceType.asana: ConnectorTypeSpec(
        service=ServiceType.asana,
        label="Asana",
        is_destination=True,
        available=False,
        secret_label="Personal access token",
    ),
}


def get_spec(service: ServiceType | str) -> ConnectorTypeSpec:
    """Spec di un servizio. Solleva KeyError se il servizio è sconosciuto."""
    return CONNECTOR_TYPES[ServiceType(service)]


def is_source(service: ServiceType | str) -> bool:
    try:
        return get_spec(service).is_source
    except (KeyError, ValueError):
        return False


class ConfigValidationError(ValueError):
    """Il `config` fornito non rispetta lo schema del tipo di servizio."""


def validate_config(service: ServiceType | str, config: dict | None) -> dict:
    """Valida e normalizza il `config` di un connettore.

    Restituisce il dict normalizzato (valori stringa, spazi rimossi, chiavi
    vuote scartate). Solleva ConfigValidationError su chiave sconosciuta o
    campo obbligatorio mancante, così che un errore di configurazione emerga
    al salvataggio e non al primo import.
    """
    try:
        spec = get_spec(service)
    except (KeyError, ValueError) as exc:
        raise ConfigValidationError(f"Servizio sconosciuto: '{service}'") from exc

    raw = config or {}
    if not isinstance(raw, dict):
        raise ConfigValidationError("config deve essere un oggetto")

    allowed = {f.key: f for f in spec.config_fields}
    unknown = sorted(set(raw) - set(allowed))
    if unknown:
        raise ConfigValidationError(
            f"Campi non previsti per il servizio '{spec.service}': {', '.join(unknown)}"
        )

    normalized: dict[str, str] = {}
    for key, definition in allowed.items():
        value = raw.get(key)
        if value is None:
            value = ""
        if not isinstance(value, str | int | float):
            raise ConfigValidationError(f"Il campo '{key}' deve essere una stringa")
        value = str(value).strip()
        if not value:
            if definition.required:
                raise ConfigValidationError(
                    f"Il campo '{definition.label}' è obbligatorio per '{spec.service}'"
                )
            continue
        normalized[key] = value

    return normalized
