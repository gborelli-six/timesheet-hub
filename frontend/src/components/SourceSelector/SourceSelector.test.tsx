// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

import { SourceSelector } from './SourceSelector'
import type { ConnectorOut, ConnectorTypeOut } from '@/types'

function makeConnectorType(overrides: Partial<ConnectorTypeOut> = {}): ConnectorTypeOut {
  return {
    service: 'jira',
    label: 'Jira',
    is_source: false,
    is_destination: true,
    available: true,
    secret_label: 'API Token',
    secret_help: null,
    requires_base_url: true,
    requires_account_identifier: true,
    account_identifier_label: 'Email',
    config_fields: [],
    ...overrides,
  }
}

function makeConnector(overrides: Partial<ConnectorOut> = {}): ConnectorOut {
  return {
    label: 'Jira principale',
    service: 'jira',
    base_url: null,
    account_identifier: null,
    config: {},
    configured: true,
    needs_reauth: false,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('SourceSelector', () => {
  it('mostra sempre la card Excel', () => {
    render(<SourceSelector connectors={[]} connectorTypes={[]} value={null} onSelect={vi.fn()} />)
    expect(screen.getByTestId('source-option-excel')).toBeInTheDocument()
  })

  it('mostra il suggerimento al Profilo quando non ci sono sorgenti configurate', () => {
    render(<SourceSelector connectors={[]} connectorTypes={[]} value={null} onSelect={vi.fn()} />)
    expect(screen.getByTestId('source-no-connectors-hint')).toBeInTheDocument()
  })

  it('mostra una card per ogni connettore con tipo is_source', () => {
    const connectors = [
      makeConnector({ label: 'Jira principale', service: 'jira' }),
      makeConnector({ label: 'Clockify team', service: 'clockify' }),
    ]
    const connectorTypes = [
      makeConnectorType({ service: 'jira', is_source: false, is_destination: true }),
      makeConnectorType({
        service: 'clockify',
        label: 'Clockify',
        is_source: true,
        is_destination: false,
      }),
    ]
    render(
      <SourceSelector
        connectors={connectors}
        connectorTypes={connectorTypes}
        value={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('source-option-Clockify team')).toBeInTheDocument()
    expect(screen.queryByTestId('source-option-Jira principale')).not.toBeInTheDocument()
    expect(screen.queryByTestId('source-no-connectors-hint')).not.toBeInTheDocument()
  })

  it('chiama onSelect con kind excel al click sulla card Excel', () => {
    const onSelect = vi.fn()
    render(<SourceSelector connectors={[]} connectorTypes={[]} value={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('source-option-excel'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'excel' })
  })

  it('chiama onSelect con kind connector e i dati del connettore al click su una card sorgente', () => {
    const onSelect = vi.fn()
    const connectors = [makeConnector({ label: 'Clockify team', service: 'clockify' })]
    const connectorTypes = [
      makeConnectorType({ service: 'clockify', label: 'Clockify', is_source: true }),
    ]
    render(
      <SourceSelector
        connectors={connectors}
        connectorTypes={connectorTypes}
        value={null}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByTestId('source-option-Clockify team'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'connector',
      label: 'Clockify team',
      service: 'clockify',
      serviceLabel: 'Clockify',
    })
  })
})
