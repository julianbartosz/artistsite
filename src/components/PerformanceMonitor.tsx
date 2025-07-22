'use client';

import React, { useEffect, useState } from 'react';
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import { usePathname } from 'next/navigation';

interface WebVitalsMetrics {
  cls: number | null;
  inp: number | null; // Changed from FID to INP
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
}

interface PerformanceMetrics {
  webVitals: WebVitalsMetrics;
  loadTime: number;
  domContentLoaded: number;
  resourceCount: number;
  timestamp: number;
}

interface PerformanceMonitorProps {
  className?: string;
  showDetails?: boolean;
}

export default function PerformanceMonitor({ 
  className = '', 
  showDetails = true 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    webVitals: {
      cls: null,
      inp: null, // Changed from fid to inp
      fcp: null,
      lcp: null,
      ttfb: null,
    },
    loadTime: 0,
    domContentLoaded: 0,
    resourceCount: 0,
    timestamp: Date.now(),
  });

  const [isVisible, setIsVisible] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const pathname = usePathname();

  useEffect(() => {
    // Collect Web Vitals - using correct function names
    onCLS((metric) => {
      setMetrics(prev => ({
        ...prev,
        webVitals: { ...prev.webVitals, cls: metric.value }
      }));
    });

    onINP((metric) => { // Changed from onFID to onINP
      setMetrics(prev => ({
        ...prev,
        webVitals: { ...prev.webVitals, inp: metric.value }
      }));
    });

    onFCP((metric) => {
      setMetrics(prev => ({
        ...prev,
        webVitals: { ...prev.webVitals, fcp: metric.value }
      }));
    });

    onLCP((metric) => {
      setMetrics(prev => ({
        ...prev,
        webVitals: { ...prev.webVitals, lcp: metric.value }
      }));
    });

    onTTFB((metric) => {
      setMetrics(prev => ({
        ...prev,
        webVitals: { ...prev.webVitals, ttfb: metric.value }
      }));
    });

    // Collect Navigation Timing metrics
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');
      
      setMetrics(prev => ({
        ...prev,
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        resourceCount: resources.length,
      }));
    }

    // Show in development mode or when query param is present
    const isDev = process.env.NODE_ENV === 'development';
    const showPerf = new URLSearchParams(window.location.search).has('perf');
    setIsVisible(isDev || showPerf);

    // Connection information
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    if (connection) {
      setConnectionType(connection.effectiveType || 'unknown');
    }
  }, []);

  // Send metrics to analytics (in production)
  useEffect(() => {
    if (metrics && process.env.NODE_ENV === 'production') {
      // Send to analytics service
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          url: window.location.pathname,
          userAgent: navigator.userAgent,
          connection: connectionType,
          timestamp: Date.now()
        })
      }).catch(() => {
        // Silently handle analytics errors
      });
    }
  }, [metrics, connectionType]);

  useEffect(() => {
    // Only run in production or when explicitly enabled
    if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_ENABLE_MONITORING) {
      return;
    }

    // Collect Core Web Vitals and send to monitoring endpoint
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        let performanceData = {
          url: window.location.href,
          pathname: '${pathname}',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        };
        
        // Device type detection
        const userAgent = navigator.userAgent;
        if (/Mobi|Android/i.test(userAgent)) {
          performanceData.deviceType = 'mobile';
        } else if (/Tablet|iPad/i.test(userAgent)) {
          performanceData.deviceType = 'tablet';
        } else {
          performanceData.deviceType = 'desktop';
        }

        // Connection info
        if (navigator.connection) {
          performanceData.connectionType = navigator.connection.effectiveType;
          performanceData.downlink = navigator.connection.downlink;
        }

        // Collect Web Vitals
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
            performanceData.domInteractive = navigation.domInteractive - navigation.navigationStart;
          }
        }

        // Paint Timing
        if (performance.getEntriesByType) {
          const paints = performance.getEntriesByType('paint');
          paints.forEach(paint => {
            if (paint.name === 'first-contentful-paint') {
              performanceData.firstContentfulPaint = paint.startTime;
            }
            if (paint.name === 'first-paint') {
              performanceData.firstPaint = paint.startTime;
            }
          });
        }

        // Memory usage
        if (performance.memory) {
          performanceData.memoryUsage = performance.memory.usedJSHeapSize;
          performanceData.totalJSHeapSize = performance.memory.totalJSHeapSize;
        }

        // Send data after page is fully loaded
        function sendPerformanceData() {
          if (Object.keys(performanceData).length > 5) { // Basic data threshold
            fetch('/api/analytics/performance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(performanceData),
              keepalive: true
            }).catch(err => {
              console.warn('Performance tracking failed:', err);
            });
          }
        }

        // Send data when page is fully loaded
        if (document.readyState === 'complete') {
          setTimeout(sendPerformanceData, 1000);
        } else {
          window.addEventListener('load', () => {
            setTimeout(sendPerformanceData, 1000);
          });
        }

        // Send data before page unload
        window.addEventListener('beforeunload', sendPerformanceData);
        
        // Send data on visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            sendPerformanceData();
          }
        });
      })();
    `;
    
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [pathname]);

  if (!isVisible) return null;

  const getScoreColor = (value: number | null, thresholds: [number, number]) => {
    if (value === null) return 'text-gray-400';
    const [good, poor] = thresholds;
    if (value <= good) return 'text-green-600';
    if (value <= poor) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatValue = (value: number | null, unit: string = 'ms') => {
    if (value === null) return 'Loading...';
    return `${Math.round(value)}${unit}`;
  };

  return (
    <div className={`fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Core Web Vitals */}
        <div className="border-b pb-2">
          <h4 className="font-medium text-gray-700 mb-1">Core Web Vitals</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">LCP:</span>
              <span className={`ml-1 ${getScoreColor(metrics.webVitals.lcp, [2500, 4000])}`}>
                {formatValue(metrics.webVitals.lcp)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">INP:</span>
              <span className={`ml-1 ${getScoreColor(metrics.webVitals.inp, [200, 500])}`}>
                {formatValue(metrics.webVitals.inp)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">CLS:</span>
              <span className={`ml-1 ${getScoreColor(metrics.webVitals.cls, [0.1, 0.25])}`}>
                {metrics.webVitals.cls !== null ? metrics.webVitals.cls.toFixed(3) : 'Loading...'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">FCP:</span>
              <span className={`ml-1 ${getScoreColor(metrics.webVitals.fcp, [1800, 3000])}`}>
                {formatValue(metrics.webVitals.fcp)}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Metrics */}
        <div className="border-b pb-2">
          <h4 className="font-medium text-gray-700 mb-1">Navigation</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Load:</span>
              <span className="ml-1 text-gray-800">
                {formatValue(metrics.loadTime)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">DOMContent:</span>
              <span className="ml-1 text-gray-800">
                {formatValue(metrics.domContentLoaded)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">TTFB:</span>
              <span className={`ml-1 ${getScoreColor(metrics.webVitals.ttfb, [800, 1800])}`}>
                {formatValue(metrics.webVitals.ttfb)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Resources:</span>
              <span className="ml-1 text-gray-800">
                {metrics.resourceCount}
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              Good
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
              Needs Improvement
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
              Poor
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// SEO Score Monitor Component
export function SEOMonitor() {
  const [seoScore, setSeoScore] = useState<{
    score: number;
    issues: string[];
    timestamp: number;
  } | null>(null);

  // First useEffect - always called, handles SEO analysis
  useEffect(() => {
    const analyzePageSEO = () => {
      let score = 100;
      const issues: string[] = [];

      // Check meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription || !metaDescription.getAttribute('content')) {
        score -= 15;
        issues.push('Missing meta description');
      } else {
        const content = metaDescription.getAttribute('content') || '';
        if (content.length < 120 || content.length > 160) {
          score -= 5;
          issues.push('Meta description length not optimal (120-160 chars)');
        }
      }

      // Check title tag
      const title = document.title;
      if (!title) {
        score -= 20;
        issues.push('Missing title tag');
      } else if (title.length < 30 || title.length > 60) {
        score -= 10;
        issues.push('Title length not optimal (30-60 chars)');
      }

      // Check h1 tag
      const h1Tags = document.querySelectorAll('h1');
      if (h1Tags.length === 0) {
        score -= 15;
        issues.push('Missing H1 tag');
      } else if (h1Tags.length > 1) {
        score -= 10;
        issues.push('Multiple H1 tags found');
      }

      // Check images alt text
      const images = document.querySelectorAll('img');
      let imagesWithoutAlt = 0;
      images.forEach(img => {
        if (!img.getAttribute('alt')) {
          imagesWithoutAlt++;
        }
      });
      if (imagesWithoutAlt > 0) {
        score -= Math.min(20, imagesWithoutAlt * 5);
        issues.push(`${imagesWithoutAlt} images missing alt text`);
      }

      // Check canonical link
      const canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        score -= 10;
        issues.push('Missing canonical link');
      }

      // Check Open Graph
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogDescription = document.querySelector('meta[property="og:description"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      
      if (!ogTitle || !ogDescription || !ogImage) {
        score -= 15;
        issues.push('Incomplete Open Graph tags');
      }

      setSeoScore({
        score: Math.max(0, score),
        issues,
        timestamp: Date.now(),
      });
    };

    // Run analysis after DOM is loaded
    if (document.readyState === 'complete') {
      analyzePageSEO();
    } else {
      window.addEventListener('load', analyzePageSEO);
      return () => window.removeEventListener('load', analyzePageSEO);
    }
  }, []);

  // Second useEffect - always called, handles production monitoring
  useEffect(() => {
    // Only send data in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Monitor SEO health
    const checkSEO = () => {
      const seoData: {
        url: string;
        title: string;
        description: string;
        keywords: string;
        canonical: string;
        ogTitle: string;
        ogDescription: string;
        ogImage: string;
        structuredData: unknown[];
        timestamp: string;
        issues?: string[];
      } = {
        url: window.location.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        structuredData: [],
        timestamp: new Date().toISOString()
      };

      // Extract structured data
      const structuredDataScripts = document.querySelectorAll('script[type="application/ld+json"]');
      structuredDataScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          seoData.structuredData.push(data);
        } catch {
          // Ignore invalid JSON
        }
      });

      // Check for SEO issues
      const issues = [];
      if (!seoData.title || seoData.title.length < 30) {
        issues.push('Title too short or missing');
      }
      if (!seoData.description || seoData.description.length < 120) {
        issues.push('Meta description too short or missing');
      }
      if (!seoData.canonical) {
        issues.push('Canonical URL missing');
      }
      if (!seoData.ogImage) {
        issues.push('Open Graph image missing');
      }

      if (issues.length > 0) {
        seoData.issues = issues;
      }

      // Send SEO data
      fetch('/api/analytics/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seoData),
        keepalive: true
      }).catch(() => {
        // Silently handle SEO monitoring errors
      });
    };

    // Check SEO after page load
    if (document.readyState === 'complete') {
      setTimeout(checkSEO, 2000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(checkSEO, 2000);
      });
    }
  }, []);

  // Determine visibility - moved after all hooks
  const isDev = process.env.NODE_ENV === 'development';
  const showSEO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('seo');
  
  // Early return after all hooks are called
  if (!seoScore || (!isDev && !showSEO)) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800">SEO Monitor</h3>
        <div className={`text-lg font-bold ${getScoreColor(seoScore.score)}`}>
          {seoScore.score}/100
        </div>
      </div>
      
      {seoScore.issues.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-600">Issues:</h4>
          <ul className="text-xs text-red-600 space-y-1">
            {seoScore.issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-red-500 mt-0.5">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {seoScore.issues.length === 0 && (
        <div className="text-xs text-green-600">
          ✓ All SEO checks passed!
        </div>
      )}
    </div>
  );
}