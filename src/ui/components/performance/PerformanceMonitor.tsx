'use client'
import React, { useEffect, useState } from 'react'
import type { PerformanceMonitorProps } from './types'
import { usePerformanceMetrics } from './usePerformanceMetrics'

export default function PerformanceMonitor({ className = '', showDetails = true }: PerformanceMonitorProps) {
  const { metrics, helpers } = usePerformanceMetrics()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isDev = process.env.NODE_ENV === 'development'
    const showPerf = new URLSearchParams(window.location.search).has('perf')
    setVisible(isDev || showPerf)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return

    try {
      const nav = navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }
      const payload = {
        ...metrics,
        url: window.location.pathname,
        userAgent: navigator.userAgent,
        connection: nav.connection?.effectiveType ?? 'unknown',
        downlink: nav.connection?.downlink ?? null,
        timestamp: Date.now()
      }
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {})
    } catch {}
  }, [metrics])

  if (!visible) return null

  return (
    <div className={`fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800">Performance Monitor</h3>
        <button onClick={() => setVisible(false)} className="text-gray-400 hover:text-gray-600">×</button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="border-b pb-2">
          <h4 className="font-medium text-gray-700 mb-1">Core Web Vitals</h4>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="LCP" value={helpers.formatValue(metrics.webVitals.lcp)} color={helpers.getScoreColor(metrics.webVitals.lcp, [2500, 4000])} />
            <Metric label="INP" value={helpers.formatValue(metrics.webVitals.inp)} color={helpers.getScoreColor(metrics.webVitals.inp, [200, 500])} />
            <Metric label="CLS" value={metrics.webVitals.cls == null ? 'Loading...' : metrics.webVitals.cls.toFixed(3)} color={helpers.getScoreColor(metrics.webVitals.cls, [0.1, 0.25])} />
            <Metric label="FCP" value={helpers.formatValue(metrics.webVitals.fcp)} color={helpers.getScoreColor(metrics.webVitals.fcp, [1800, 3000])} />
          </div>
        </div>

        {showDetails && (
          <div className="border-b pb-2">
            <h4 className="font-medium text-gray-700 mb-1">Navigation</h4>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Load" value={helpers.formatValue(metrics.loadTime)} />
              <Row label="DOMContent" value={helpers.formatValue(metrics.domContentLoaded)} />
              <Metric label="TTFB" value={helpers.formatValue(metrics.webVitals.ttfb)} color={helpers.getScoreColor(metrics.webVitals.ttfb, [800, 1800])} />
              <Row label="Resources" value={String(metrics.resourceCount)} />
            </div>
          </div>
        )}

        <div className="text-xs">
          <div className="flex items-center gap-3">
            <LegendDot color="bg-green-600" label="Good" />
            <LegendDot color="bg-yellow-600" label="Needs Improvement" />
            <LegendDot color="bg-red-600" label="Poor" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <span className={`ml-1 ${color}`}>{value}</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <span className="ml-1 text-gray-800">{value}</span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <div className={`w-2 h-2 ${color} rounded-full`}></div>
      {label}
    </span>
  )
}
