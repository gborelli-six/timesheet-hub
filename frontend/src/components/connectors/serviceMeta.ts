import type { ServiceType } from '@/types'

// Solo aspetto visuale (icona/colore/etichetta breve). I campi funzionali del
// form (account_identifier_label, requires_base_url, secret_label, campi di
// config…) arrivano dal catalogo `GET /api/connector-types` (vedi
// useConnectorTypes) per evitare due fonti di verità sullo stesso schema.
export interface ServiceMeta {
  name: string
  letter: string
  color: string
  desc: string
}

export const SERVICE_META: Record<ServiceType, ServiceMeta> = {
  jira: {
    name: 'Jira',
    letter: 'J',
    color: '#2563eb',
    desc: 'Issue tracking',
  },
  odoo: {
    name: 'Odoo',
    letter: 'O',
    color: '#7c3aed',
    desc: 'ERP · timesheet',
  },
  clockify: {
    name: 'Clockify',
    letter: 'C',
    color: '#03a9f4',
    desc: 'Time tracking',
  },
  linear: {
    name: 'Linear',
    letter: 'L',
    color: '#0f172a',
    desc: 'Project tracking',
  },
  asana: {
    name: 'Asana',
    letter: 'A',
    color: '#db2777',
    desc: 'Work management',
  },
}

// Destinazioni disponibili nel wizard di importazione (scrittura). Clockify è
// una sorgente (E13): non compare qui, coerentemente con il fatto che i log
// di importazione riportano solo i backend su cui si è scritto.
export const ALL_SERVICES: ServiceType[] = ['jira', 'odoo', 'linear', 'asana']
