'use client'
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { getAllProducts } from '@domain/shop'
import type { DashboardData, InventoryTab, StockAlert } from './types'
import { OverviewStatsSkeleton } from './OverviewStats'
import { RecentAlertsSkeleton } from './RecentAlerts'

const OverviewStats = dynamic(() => import('.').then(m => m.OverviewStats), { loading: () => <OverviewStatsSkeleton /> })
const RecentAlerts = dynamic(() => import('.').then(m => m.RecentAlerts), { loading: () => <RecentAlertsSkeleton /> })
const InventoryTable = dynamic(() => import('.').then(m => m.InventoryTable))

export default function InventoryDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview')

  useEffect(() => {
    fetchDashboardData()
    fetchAlerts()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/inventory')
      const data = await response.json()
      if (data.success) setDashboardData(data)
    } catch {
      // silent fail in UI; server logs capture
    }
  }

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/inventory/alerts')
      const data = await response.json()
      if (data.success) setAlerts(data.alerts)
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', alertId })
      })
      if (response.ok) fetchAlerts()
    } catch {}
  }

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId })
      })
      if (response.ok) {
        fetchAlerts()
        fetchDashboardData()
      }
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const products = getAllProducts()

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Inventory Management</h1>
        <p className="text-gray-600">Monitor stock levels, alerts, and inventory movements</p>
      </div>

      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'alerts', label: `Alerts ${alerts.length > 0 ? `(${alerts.length})` : ''}` },
            { id: 'products', label: 'Products' }
          ] as Array<{ id: InventoryTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-8">
          <OverviewStats data={dashboardData} />
          <RecentAlerts alerts={alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
        </div>
      )}

      {activeTab === 'alerts' && (
        <RecentAlerts alerts={alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
      )}

      {activeTab === 'products' && <InventoryTable products={products} />}
    </div>
  )
}
