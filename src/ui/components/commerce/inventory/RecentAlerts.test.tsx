import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentAlerts } from './RecentAlerts'
import type { StockAlert } from './types'

describe('RecentAlerts', () => {
  const sampleAlerts: StockAlert[] = [
    { id: '1', productId: 'p1', severity: 'high', type: 'low_stock', message: 'Low stock for p1', currentStock: 3, thresholdValue: 5, isActive: true, createdAt: new Date() },
    { id: '2', productId: 'p2', severity: 'critical', type: 'out_of_stock', message: 'Out of stock for p2', currentStock: 0, isActive: true, createdAt: new Date() },
  ]

  it('renders empty state when no alerts', () => {
    render(<RecentAlerts alerts={[]} onAcknowledge={jest.fn()} onResolve={jest.fn()} />)
    expect(screen.getByText('Recent Alerts')).toBeInTheDocument()
    expect(screen.getByText('All clear! No recent alerts.')).toBeInTheDocument()
  })

  it('renders alerts and triggers handlers', () => {
    const onAck = jest.fn()
    const onResolve = jest.fn()
    render(<RecentAlerts alerts={sampleAlerts} onAcknowledge={onAck} onResolve={onResolve} />)

    expect(screen.getByText('Low stock for p1')).toBeInTheDocument()
    expect(screen.getByText('Out of stock for p2')).toBeInTheDocument()

    fireEvent.click(screen.getAllByText('Acknowledge')[0])
    fireEvent.click(screen.getAllByText('Resolve')[1])

    expect(onAck).toHaveBeenCalledWith('1')
    expect(onResolve).toHaveBeenCalledWith('2')
  })
})
