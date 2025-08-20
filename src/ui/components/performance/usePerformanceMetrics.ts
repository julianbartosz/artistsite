'use client'
import { useEffect, useMemo, useState } from 'react'
import type { PerformanceMetrics } from './types'

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    webVitals: { cls: null, inp: null, fcp: null, lcp: null, ttfb: null },
    loadTime: 0,
    domContentLoaded: 0,
    resourceCount: 0,
    timestamp: Date.now()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    import('web-vitals')
      .then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
        onCLS((m) => setMetrics((p) => ({ ...p, webVitals: { ...p.webVitals, cls: m.value } })))
        onINP((m) => setMetrics((p) => ({ ...p, webVitals: { ...p.webVitals, inp: m.value } })))
        onFCP((m) => setMetrics((p) => ({ ...p, webVitals: { ...p.webVitals, fcp: m.value } })))
        onLCP((m) => setMetrics((p) => ({ ...p, webVitals: { ...p.webVitals, lcp: m.value } })))
        onTTFB((m) => setMetrics((p) => ({ ...p, webVitals: { ...p.webVitals, ttfb: m.value } })))
      })
      .catch(() => {})

    if (window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = performance.getEntriesByType('resource')
      setMetrics((p) => ({
        ...p,
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
        resourceCount: resources.length
      }))
    }
  }, [])

  const helpers = useMemo(() => ({
    getScoreColor(value: number | null, thresholds: [number, number]) {
      if (value == null) return 'text-gray-400'
      const [good, poor] = thresholds
      if (value <= good) return 'text-green-600'
      if (value <= poor) return 'text-yellow-600'
      return 'text-red-600'
    },
    formatValue(value: number | null, unit: string = 'ms') {
      if (value == null) return 'Loading...'
      return `${Math.round(value)}${unit}`
    }
  }), [])

  return { metrics, setMetrics, helpers }
}
