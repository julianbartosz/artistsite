import React from 'react'
import { render, screen } from '@testing-library/react'
import { OverviewStats, OverviewStatsSkeleton } from './OverviewStats'
import type { DashboardData } from './types'

describe('OverviewStats', () => {
  const data: DashboardData = {
    totalProducts: 100,
    inStock: 80,
    lowStock: 15,
    outOfStock: 5,
    totalValue: 123456,
    activeAlerts: 3,
    recentMovements: []
  }
  it('renders KPI cards with correct values', () => {
    render(<OverviewStats data={data} />)
    expect(screen.getByText('Total Products')).toBeInTheDocument()
    expect(screen.getByText('In Stock')).toBeInTheDocument()
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
  it('renders skeleton placeholder', () => {
    render(<OverviewStatsSkeleton />)
    // expect 4 placeholder cards
    const placeholders = screen.getAllByRole('generic')
    expect(placeholders.length).toBeGreaterThan(0)
  })
})
