// Performance Monitoring and Optimization System
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

export class PerformanceMonitor {
  private static thresholds: PerformanceThresholds = {
    pageLoadTime: { good: 2500, poor: 4000 },
    firstContentfulPaint: { good: 1800, poor: 3000 },
    largestContentfulPaint: { good: 2500, poor: 4000 },
    cumulativeLayoutShift: { good: 0.1, poor: 0.25 },
    firstInputDelay: { good: 100, poor: 300 },
    timeToInteractive: { good: 3800, poor: 7300 }
  };

  // Client-side performance tracking
  static getClientPerformanceScript(): string {
    return `
      (function() {
        let performanceData = {};
        
        // Collect Core Web Vitals
        function collectWebVitals() {
          if ('PerformanceObserver' in window) {
            // Largest Contentful Paint
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              performanceData.largestContentfulPaint = lastEntry.startTime;
            }).observe({ entryTypes: ['largest-contentful-paint'] });

            // First Input Delay
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                performanceData.firstInputDelay = entry.processingStart - entry.startTime;
              }
            }).observe({ entryTypes: ['first-input'] });

            // Cumulative Layout Shift
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

          // Navigation Timing
          if (performance.getEntriesByType) {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
              performanceData.timeToFirstByte = navigation.responseStart - navigation.requestStart;
              performanceData.pageLoadTime = navigation.loadEventEnd - navigation.loadEventStart;
              performanceData.timeToInteractive = navigation.domInteractive - navigation.navigationStart;
            }
          }

          // Paint Timing
          if (performance.getEntriesByType) {
            const paints = performance.getEntriesByType('paint');
            paints.forEach(paint => {
              if (paint.name === 'first-contentful-paint') {
                performanceData.firstContentfulPaint = paint.startTime;
              }
            });
          }

          // Memory Usage
          if (performance.memory) {
            performanceData.memoryUsage = performance.memory.usedJSHeapSize;
          }

          // Connection Info
          if (navigator.connection) {
            performanceData.connectionType = navigator.connection.effectiveType;
          }

          // Device Type Detection
          const userAgent = navigator.userAgent;
          if (/Mobi|Android/i.test(userAgent)) {
            performanceData.deviceType = 'mobile';
          } else if (/Tablet|iPad/i.test(userAgent)) {
            performanceData.deviceType = 'tablet';
          } else {
            performanceData.deviceType = 'desktop';
          }

          performanceData.userAgent = userAgent;
          performanceData.timestamp = new Date().toISOString();
          performanceData.url = window.location.href;
        }

        // Send performance data
        function sendPerformanceData() {
          if (Object.keys(performanceData).length > 0) {
            fetch('/api/analytics/performance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(performanceData)
            }).catch(err => console.warn('Performance tracking failed:', err));
          }
        }

        // Collect data after page load
        if (document.readyState === 'complete') {
          collectWebVitals();
          setTimeout(sendPerformanceData, 1000);
        } else {
          window.addEventListener('load', () => {
            collectWebVitals();
            setTimeout(sendPerformanceData, 1000);
          });
        }

        // Send data before page unload
        window.addEventListener('beforeunload', sendPerformanceData);
      })();
    `;
  }

  // Store performance metrics
  static async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await db.analyticsEvent.create({
        data: {
          eventName: 'performance_metrics',
          properties: JSON.stringify(metrics),
          timestamp: metrics.timestamp
        }
      });

      // Check for performance issues
      await this.analyzePerformance(metrics);
    } catch (error) {
      console.error('Error recording performance metrics:', error);
    }
  }

  // Analyze performance and trigger alerts
  static async analyzePerformance(metrics: PerformanceMetrics): Promise<void> {
    const issues: string[] = [];

    // Check each metric against thresholds
    Object.entries(this.thresholds).forEach(([metric, threshold]) => {
      const value = metrics[metric as keyof PerformanceMetrics] as number;
      if (value > threshold.poor) {
        issues.push(`${metric}: ${value}ms (threshold: ${threshold.poor}ms)`);
      }
    });

    if (issues.length > 0) {
      await this.triggerPerformanceAlert(metrics, issues);
    }
  }

  // Performance optimization recommendations
  static async getOptimizationRecommendations(): Promise<{
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    try {
      // Get recent performance data
      const recentMetrics = await db.analyticsEvent.findMany({
        where: {
          eventName: 'performance_metrics',
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        take: 100
      });

      const recommendations: string[] = [];
      let priority: 'high' | 'medium' | 'low' = 'low';

      if (recentMetrics.length === 0) {
        return { recommendations: ['Enable performance monitoring'], priority: 'medium' };
      }

      // Analyze metrics for common issues
      const avgMetrics = this.calculateAverageMetrics(recentMetrics);

      if (avgMetrics.largestContentfulPaint > this.thresholds.largestContentfulPaint.poor) {
        recommendations.push('Optimize image loading and compression');
        recommendations.push('Implement image lazy loading');
        recommendations.push('Use Next.js Image component for better optimization');
        priority = 'high';
      }

      if (avgMetrics.cumulativeLayoutShift > this.thresholds.cumulativeLayoutShift.poor) {
        recommendations.push('Set explicit dimensions for images and ads');
        recommendations.push('Reserve space for dynamic content');
        recommendations.push('Avoid inserting content above existing content');
        priority = priority === 'high' ? 'high' : 'medium';
      }

      if (avgMetrics.firstInputDelay > this.thresholds.firstInputDelay.poor) {
        recommendations.push('Reduce JavaScript execution time');
        recommendations.push('Code split to reduce bundle size');
        recommendations.push('Use web workers for heavy computations');
        priority = priority === 'high' ? 'high' : 'medium';
      }

      if (avgMetrics.timeToFirstByte > 800) {
        recommendations.push('Optimize server response time');
        recommendations.push('Implement caching strategies');
        recommendations.push('Use CDN for static assets');
        priority = 'high';
      }

      if (recommendations.length === 0) {
        recommendations.push('Performance is within acceptable ranges');
        recommendations.push('Consider advanced optimizations for further improvement');
      }

      return { recommendations, priority };
    } catch (error) {
      console.error('Error generating optimization recommendations:', error);
      return { 
        recommendations: ['Error analyzing performance data'], 
        priority: 'medium' 
      };
    }
  }

  // Load testing simulation
  static async runLoadTest(targetUrl: string, concurrent: number = 10, duration: number = 60): Promise<{
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    p95ResponseTime: number;
  }> {
    console.log(`Starting load test: ${concurrent} concurrent users for ${duration}s`);
    
    const results: number[] = [];
    const errors: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    // Simulate concurrent requests
    const promises = Array.from({ length: concurrent }, async () => {
      while (Date.now() < endTime) {
        const requestStart = Date.now();
        try {
          const response = await fetch(targetUrl);
          const requestTime = Date.now() - requestStart;
          results.push(requestTime);
          
          if (!response.ok) {
            errors.push(requestTime);
          }
        } catch (error) {
          errors.push(Date.now() - requestStart);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    await Promise.all(promises);

    // Calculate metrics
    const totalRequests = results.length;
    const totalTime = (Date.now() - startTime) / 1000;
    const averageResponseTime = results.reduce((a, b) => a + b, 0) / totalRequests;
    const requestsPerSecond = totalRequests / totalTime;
    const errorRate = (errors.length / totalRequests) * 100;
    
    // Calculate 95th percentile
    const sortedResults = results.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResults.length * 0.95);
    const p95ResponseTime = sortedResults[p95Index] || 0;

    // Store load test results
    await db.analyticsEvent.create({
      data: {
        eventName: 'load_test_completed',
        properties: JSON.stringify({
          targetUrl,
          concurrent,
          duration,
          averageResponseTime,
          requestsPerSecond,
          errorRate,
          p95ResponseTime,
          totalRequests
        }),
        timestamp: new Date()
      }
    });

    return {
      averageResponseTime,
      requestsPerSecond,
      errorRate,
      p95ResponseTime
    };
  }

  // Helper methods
  private static calculateAverageMetrics(events: any[]): PerformanceMetrics {
    const totals = events.reduce((acc, event) => {
      const metrics = JSON.parse(event.properties);
      Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'number') {
          acc[key] = (acc[key] || 0) + metrics[key];
        }
      });
      return acc;
    }, {});

    const averages = {} as PerformanceMetrics;
    Object.keys(totals).forEach(key => {
      averages[key as keyof PerformanceMetrics] = totals[key] / events.length;
    });

    return averages;
  }

  private static async triggerPerformanceAlert(
    metrics: PerformanceMetrics, 
    issues: string[]
  ): Promise<void> {
    await db.analyticsEvent.create({
      data: {
        eventName: 'performance_alert',
        properties: JSON.stringify({
          url: metrics.userAgent,
          deviceType: metrics.deviceType,
          issues,
          timestamp: metrics.timestamp
        }),
        timestamp: new Date()
      }
    });

    console.warn('Performance issues detected:', issues);
  }
}

// API endpoint for performance data collection
export async function POST(request: NextRequest) {
  try {
    const metrics: PerformanceMetrics = await request.json();
    await PerformanceMonitor.recordMetrics(metrics);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing performance data:', error);
    return NextResponse.json(
      { error: 'Failed to process performance data' },
      { status: 500 }
    );
  }
}