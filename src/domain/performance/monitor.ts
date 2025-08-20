import 'server-only'
// Performance Monitoring and Optimization System (moved from src/lib/performance/performance-monitor.ts)
import { db } from '@/lib/db'

export interface PerformanceMetrics {
  pageLoadTime: number;
  timeToFirstByte: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  resourceLoadTimes: Record<string, number>;
  memoryUsage: number;
  connectionType: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  userAgent: string;
  timestamp: Date;
}

export interface PerformanceThresholds {
  pageLoadTime: { good: 2500, poor: 4000 };
  firstContentfulPaint: { good: 1800, poor: 3000 };
  largestContentfulPaint: { good: 2500, poor: 4000 };
  cumulativeLayoutShift: { good: 0.1, poor: 0.25 };
  firstInputDelay: { good: 100, poor: 300 };
  timeToInteractive: { good: 3800, poor: 7300 };
}

type ThresholdKey = keyof PerformanceThresholds;

type NumericMetrics = Pick<
  PerformanceMetrics,
  | 'pageLoadTime'
  | 'timeToFirstByte'
  | 'firstContentfulPaint'
  | 'largestContentfulPaint'
  | 'cumulativeLayoutShift'
  | 'firstInputDelay'
  | 'timeToInteractive'
  | 'memoryUsage'
>;

const numericMetricKeys: Array<keyof NumericMetrics> = [
  'pageLoadTime',
  'timeToFirstByte',
  'firstContentfulPaint',
  'largestContentfulPaint',
  'cumulativeLayoutShift',
  'firstInputDelay',
  'timeToInteractive',
  'memoryUsage',
];

export class PerformanceMonitor {
  private static thresholds: PerformanceThresholds = {
    pageLoadTime: { good: 2500, poor: 4000 },
    firstContentfulPaint: { good: 1800, poor: 3000 },
    largestContentfulPaint: { good: 2500, poor: 4000 },
    cumulativeLayoutShift: { good: 0.1, poor: 0.25 },
    firstInputDelay: { good: 100, poor: 300 },
    timeToInteractive: { good: 3800, poor: 7300 }
  }

  // Client-side snippet generator (consumed by server to inject script)
  static getClientPerformanceScript(): string {
    return `
      (function() {
        let performanceData = {};
        function collectWebVitals() {
          if ('PerformanceObserver' in window) {
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              performanceData.largestContentfulPaint = lastEntry.startTime;
            }).observe({ entryTypes: ['largest-contentful-paint'] });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                performanceData.firstInputDelay = entry.processingStart - entry.startTime;
              }
            }).observe({ entryTypes: ['first-input'] });
            let clsValue = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              }
              performanceData.cumulativeLayoutShift = clsValue;
            }).observe({ entryTypes: ['layout-shift'] });
          }
          if (performance.getEntriesByType) {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
              performanceData.timeToFirstByte = navigation.responseStart - navigation.requestStart;
              performanceData.pageLoadTime = navigation.loadEventEnd - navigation.loadEventStart;
              performanceData.timeToInteractive = navigation.domInteractive - navigation.navigationStart;
            }
          }
          if (performance.getEntriesByType) {
            const paints = performance.getEntriesByType('paint');
            paints.forEach(paint => {
              if (paint.name === 'first-contentful-paint') {
                performanceData.firstContentfulPaint = paint.startTime;
              }
            });
          }
          if ((performance).memory) {
            performanceData.memoryUsage = (performance).memory.usedJSHeapSize;
          }
          if ((navigator).connection) {
            performanceData.connectionType = (navigator).connection.effectiveType;
          }
          const userAgent = navigator.userAgent;
          if (/Mobi|Android/i.test(userAgent)) {
            (performanceData).deviceType = 'mobile';
          } else if (/Tablet|iPad/i.test(userAgent)) {
            (performanceData).deviceType = 'tablet';
          } else {
            (performanceData).deviceType = 'desktop';
          }
          (performanceData).userAgent = userAgent;
          (performanceData).timestamp = new Date().toISOString();
          (performanceData).url = window.location.href;
        }
        function sendPerformanceData() {
          if (Object.keys(performanceData).length > 0) {
            fetch('/api/analytics/performance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(performanceData)
            }).catch(() => {});
          }
        }
        if (document.readyState === 'complete') {
          collectWebVitals();
          setTimeout(sendPerformanceData, 1000);
        } else {
          window.addEventListener('load', () => {
            collectWebVitals();
            setTimeout(sendPerformanceData, 1000);
          });
        }
        window.addEventListener('beforeunload', sendPerformanceData);
      })();
    `
  }

  static async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await db.analyticsEvent.create({
        data: {
          eventName: 'performance_metrics',
          properties: JSON.stringify(metrics),
          timestamp: metrics.timestamp
        }
      })
      await this.analyzePerformance(metrics)
    } catch {
      // swallow to avoid noisy logs in production
    }
  }

  static async analyzePerformance(metrics: PerformanceMetrics): Promise<void> {
    const issues: string[] = []
    const keys = Object.keys(this.thresholds) as ThresholdKey[]
    for (const key of keys) {
      const threshold = this.thresholds[key]
      const value = metrics[key as keyof NumericMetrics] as number | undefined
      if (typeof value === 'number' && value > threshold.poor) {
        issues.push(`${key}: ${value}ms (threshold: ${threshold.poor}ms)`) 
      }
    }
    if (issues.length > 0) {
      await this.triggerPerformanceAlert(metrics, issues)
    }
  }

  static async getOptimizationRecommendations(): Promise<{ recommendations: string[]; priority: 'high' | 'medium' | 'low' }> {
    try {
      const recentMetrics = await db.analyticsEvent.findMany({
        where: { eventName: 'performance_metrics', timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        take: 100
      })

      const recommendations: string[] = []
      let priority: 'high' | 'medium' | 'low' = 'low'

      if (recentMetrics.length === 0) return { recommendations: ['Enable performance monitoring'], priority: 'medium' }

      const avgMetrics = this.calculateAverageMetrics(recentMetrics.map(r => ({ properties: r.properties })))

      if (avgMetrics.largestContentfulPaint > this.thresholds.largestContentfulPaint.poor) {
        recommendations.push('Optimize image loading and compression')
        recommendations.push('Implement image lazy loading')
        recommendations.push('Use Next.js Image component for better optimization')
        priority = 'high'
      }
      if (avgMetrics.cumulativeLayoutShift > this.thresholds.cumulativeLayoutShift.poor) {
        recommendations.push('Set explicit dimensions for images and ads')
        recommendations.push('Reserve space for dynamic content')
        recommendations.push('Avoid inserting content above existing content')
        priority = priority === 'high' ? 'high' : 'medium'
      }
      if (avgMetrics.firstInputDelay > this.thresholds.firstInputDelay.poor) {
        recommendations.push('Reduce JavaScript execution time')
        recommendations.push('Code split to reduce bundle size')
        recommendations.push('Use web workers for heavy computations')
        priority = priority === 'high' ? 'high' : 'medium'
      }
      if (avgMetrics.timeToFirstByte > 800) {
        recommendations.push('Optimize server response time')
        recommendations.push('Implement caching strategies')
        recommendations.push('Use CDN for static assets')
        priority = 'high'
      }
      if (recommendations.length === 0) {
        recommendations.push('Performance is within acceptable ranges')
        recommendations.push('Consider advanced optimizations for further improvement')
      }
      return { recommendations, priority }
    } catch {
      return { recommendations: ['Error analyzing performance data'], priority: 'medium' }
    }
  }

  static async runLoadTest(targetUrl: string, concurrent: number = 10, duration: number = 60): Promise<{
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    p95ResponseTime: number;
  }> {
    const results: number[] = []
    const errors: number[] = []
    const startTime = Date.now()
    const endTime = startTime + (duration * 1000)

    const requests: Promise<void>[] = []
    for (let i = 0; i < concurrent; i++) {
      requests.push((async () => {
        while (Date.now() < endTime) {
          const requestStart = Date.now()
          try {
            const response = await fetch(targetUrl)
            const requestTime = Date.now() - requestStart
            results.push(requestTime)
            if (!response.ok) errors.push(requestTime)
          } catch {
            errors.push(Date.now() - requestStart)
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      })())
    }

    await Promise.all(requests)

    const totalRequests = results.length
    const totalTime = (Date.now() - startTime) / 1000
    const averageResponseTime = totalRequests ? results.reduce((a, b) => a + b, 0) / totalRequests : 0
    const requestsPerSecond = totalTime ? totalRequests / totalTime : 0
    const errorRate = totalRequests ? (errors.length / totalRequests) * 100 : 0
    const sortedResults = results.slice().sort((a, b) => a - b)
    const p95Index = Math.floor(sortedResults.length * 0.95)
    const p95ResponseTime = sortedResults[p95Index] || 0

    await db.analyticsEvent.create({
      data: {
        eventName: 'load_test_completed',
        properties: JSON.stringify({ targetUrl, concurrent, duration, averageResponseTime, requestsPerSecond, errorRate, p95ResponseTime, totalRequests }),
        timestamp: new Date()
      }
    })

    return { averageResponseTime, requestsPerSecond, errorRate, p95ResponseTime }
  }

  private static calculateAverageMetrics(events: { properties: string }[]): NumericMetrics {
    const sums: Partial<Record<keyof NumericMetrics, number>> = {}
    const counts: Partial<Record<keyof NumericMetrics, number>> = {}

    for (const event of events) {
      let parsed: unknown
      try { parsed = JSON.parse(event.properties) } catch { parsed = undefined }
      if (!parsed || typeof parsed !== 'object') continue
      const m = parsed as Record<string, unknown>
      for (const key of numericMetricKeys) {
        const v = m[key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          sums[key] = (sums[key] || 0) + v
          counts[key] = (counts[key] || 0) + 1
        }
      }
    }

    const averages: Partial<Record<keyof NumericMetrics, number>> = {}
    for (const key of numericMetricKeys) {
      const c = counts[key] || 0
      averages[key] = c ? (sums[key] || 0) / c : 0
    }

    return averages as NumericMetrics
  }

  private static async triggerPerformanceAlert(metrics: PerformanceMetrics, issues: string[]): Promise<void> {
    await db.analyticsEvent.create({
      data: {
        eventName: 'performance_alert',
        properties: JSON.stringify({ userAgent: metrics.userAgent, deviceType: metrics.deviceType, issues, timestamp: metrics.timestamp }),
        timestamp: new Date()
      }
    })
  }
}
