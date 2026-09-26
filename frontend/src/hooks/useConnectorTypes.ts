import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { ConnectorTypeOut, ServiceType } from '@/types'

const CONNECTOR_TYPES_KEY = ['connector-types'] as const

// Il catalogo è statico per la durata della sessione (cambia solo con un
// deploy): niente refetch periodico, staleTime lungo invece di Infinity per
// tollerare un refresh manuale della cache senza reload della pagina.
const CATALOG_STALE_TIME = 60 * 60 * 1000

export function useConnectorTypes() {
  return useQuery<ConnectorTypeOut[]>({
    queryKey: CONNECTOR_TYPES_KEY,
    queryFn: () => apiClient.get('/api/connector-types') as Promise<ConnectorTypeOut[]>,
    staleTime: CATALOG_STALE_TIME,
  })
}

/** Spec di un servizio dal catalogo, o undefined se non ancora caricato/sconosciuto. */
export function getConnectorTypeSpec(
  types: ConnectorTypeOut[] | undefined,
  service: ServiceType,
): ConnectorTypeOut | undefined {
  return types?.find((t) => t.service === service)
}
