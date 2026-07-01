import type { ServiceType } from '@/types'

export interface ServiceMeta {
  name: string
  letter: string
  color: string
  desc: string
  accountLabel: string
  accountPlaceholder: string
  hasBaseUrl: boolean
  baseUrlPlaceholder?: string
  hasDbName?: boolean
  dbNameLabel?: string
  dbNamePlaceholder?: string
  secretLabel: string
}

export const SERVICE_META: Record<ServiceType, ServiceMeta> = {
  jira: {
    name: 'Jira',
    letter: 'J',
    color: '#2563eb',
    desc: 'Issue tracking',
    accountLabel: 'Email Atlassian',
    accountPlaceholder: 'mario@azienda.atlassian.net',
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://azienda.atlassian.net',
    secretLabel: 'API Token',
  },
  odoo: {
    name: 'Odoo',
    letter: 'O',
    color: '#7c3aed',
    desc: 'ERP · timesheet',
    accountLabel: 'Username',
    accountPlaceholder: 'mario.rossi',
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://azienda.odoo.com',
    hasDbName: true,
    dbNameLabel: 'Database Odoo',
    dbNamePlaceholder: 'nome_database',
    secretLabel: 'API Key',
  },
  linear: {
    name: 'Linear',
    letter: 'L',
    color: '#0f172a',
    desc: 'Project tracking',
    accountLabel: 'Email Linear',
    accountPlaceholder: 'mario@azienda.it',
    hasBaseUrl: false,
    secretLabel: 'API Token',
  },
  asana: {
    name: 'Asana',
    letter: 'A',
    color: '#db2777',
    desc: 'Work management',
    accountLabel: 'Email Asana',
    accountPlaceholder: 'mario@azienda.it',
    hasBaseUrl: false,
    secretLabel: 'Personal Access Token',
  },
}

export const ALL_SERVICES: ServiceType[] = ['jira', 'odoo', 'linear', 'asana']
