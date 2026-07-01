from app.adapters.base import ServiceType, TimesheetAdapter


class AdapterRegistry:
    def __init__(self) -> None:
        self._registry: dict[ServiceType, type[TimesheetAdapter]] = {}

    def register(
        self, service: ServiceType, adapter_class: type[TimesheetAdapter]
    ) -> None:
        if not (
            isinstance(adapter_class, type)
            and issubclass(adapter_class, TimesheetAdapter)
        ):
            raise TypeError(
                f"{adapter_class!r} deve essere una sottoclasse di TimesheetAdapter"
            )
        self._registry[service] = adapter_class

    def get(self, service: ServiceType) -> type[TimesheetAdapter]:
        if service not in self._registry:
            raise KeyError(f"Nessun adapter registrato per il servizio '{service}'")
        return self._registry[service]


adapter_registry = AdapterRegistry()
