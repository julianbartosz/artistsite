export interface WebVitalsMetrics {
  cls: number | null
  inp: number | null
  fcp: number | null
  lcp: number | null
  ttfb: number | null
}

export interface PerformanceMetrics {
  webVitals: WebVitalsMetrics
  loadTime: number
  domContentLoaded: number
  resourceCount: number
  timestamp: number
}

export interface PerformanceMonitorProps {
  className?: string
  showDetails?: boolean
}
