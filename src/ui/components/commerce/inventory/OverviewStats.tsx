import React from 'react'
import type { DashboardData } from './types'

export function OverviewStats({ data }: { data: DashboardData }) {
  const items = [
    { label: 'Total Products', value: data.totalProducts, color: 'bg-blue-500', emoji: '📦' },
    { label: 'In Stock', value: data.inStock, color: 'bg-green-500', emoji: '✓' },
    { label: 'Low Stock', value: data.lowStock, color: 'bg-yellow-500', emoji: '⚠' },
    { label: 'Out of Stock', value: data.outOfStock, color: 'bg-red-500', emoji: '✕' }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {items.map((item) => (
        <div key={item.label} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 ${item.color} rounded-md flex items-center justify-center`}>
                <span className="text-white text-sm font-bold">{item.emoji}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-200 rounded-md" />
            <div className="ml-4 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-6 bg-gray-200 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
