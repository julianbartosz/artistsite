'use client'
import { DateRangeSelector } from './DateRangeSelector'
import { ChannelFilter } from './ChannelFilter'
import type { DashboardFilters } from './types'

interface Props {
  filters: DashboardFilters
  onDateRangeChange: (range: DashboardFilters['dateRange']) => void
  onChannelsChange: (channels: string[]) => void
}

export function HeaderFilters({ filters, onDateRangeChange, onChannelsChange }: Props) {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-gray-900">Marketing Dashboard</h1>
      <div className="flex space-x-4">
        <DateRangeSelector value={filters.dateRange} onChange={onDateRangeChange} />
        <ChannelFilter selected={filters.channels} onChange={onChannelsChange} />
      </div>
    </div>
  )
}
