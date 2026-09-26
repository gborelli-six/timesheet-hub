from app.sources.base import ServiceType, TimesheetSource


class SourceRegistry:
    """Registry plug-in delle sorgenti, gemello di AdapterRegistry (ADR-007-B).

    Come quello, sovrascrive silenziosamente una registrazione esistente: è il
    meccanismo con cui StubSource prende il posto della sorgente reale in
    modalità E2E.
    """

    def __init__(self) -> None:
        self._registry: dict[ServiceType, type[TimesheetSource]] = {}

    def register(
        self, service: ServiceType, source_class: type[TimesheetSource]
    ) -> None:
        if not (
            isinstance(source_class, type) and issubclass(source_class, TimesheetSource)
        ):
            raise TypeError(
                f"{source_class!r} deve essere una sottoclasse di TimesheetSource"
            )
        self._registry[service] = source_class

    def get(self, service: ServiceType) -> type[TimesheetSource]:
        if service not in self._registry:
            raise KeyError(f"Nessuna sorgente registrata per il servizio '{service}'")
        return self._registry[service]


source_registry = SourceRegistry()
