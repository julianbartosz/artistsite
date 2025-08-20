import React from 'react'
import type { AlertsHandlers, StockAlert } from './types'

export function RecentAlerts({ alerts, onAcknowledge, onResolve }: { alerts: StockAlert[]; } & AlertsHandlers) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">ℹ</div>
            <p className="mt-3 text-gray-700 font-medium">All clear! No recent alerts.</p>
            <p className="text-sm text-gray-500">Your inventory looks healthy. We’ll notify you when something needs attention.</p>
          </div>
        </div>
      </div>
    )
  }

  const top = alerts.slice(0, 5)

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {top.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.severity === 'critical'
                  ? 'border-red-500 bg-red-50'
                  : alert.severity === 'high'
                  ? 'border-orange-500 bg-orange-50'
                  : alert.severity === 'medium'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{alert.message}</p>
                  <p className="text-sm text-gray-600 mt-1">Product ID: {alert.productId}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => onAcknowledge(alert.id)} className="text-sm text-blue-600 hover:text-blue-800">
                    Acknowledge
                  </button>
                  <button onClick={() => onResolve(alert.id)} className="text-sm text-green-600 hover:text-green-800">
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RecentAlertsSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
      </div>
      <div className="p-6 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="p-4 rounded-lg border-l-4 bg-gray-50 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
