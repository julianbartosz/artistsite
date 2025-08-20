'use client'
import { useEffect, useState } from 'react'

interface SeoState {
  score: number
  issues: string[]
  timestamp: number
}

export default function SEOMonitor() {
  const [seo, setSeo] = useState<SeoState | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isDev = process.env.NODE_ENV === 'development'
    const showSEO = new URLSearchParams(window.location.search).has('seo')
    setVisible(isDev || showSEO)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const analyze = () => {
      let score = 100
      const issues: string[] = []

      const title = document.title
      if (!title) {
        score -= 20
        issues.push('Missing title tag')
      } else if (title.length < 30 || title.length > 60) {
        score -= 10
        issues.push('Title length not optimal (30-60 chars)')
      }

      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      if (!metaDesc) {
        score -= 15
        issues.push('Missing meta description')
      } else if (metaDesc.length < 120 || metaDesc.length > 160) {
        score -= 5
        issues.push('Meta description length not optimal (120-160 chars)')
      }

      const h1Tags = document.querySelectorAll('h1')
      if (h1Tags.length === 0) {
        score -= 15
        issues.push('Missing H1 tag')
      } else if (h1Tags.length > 1) {
        score -= 10
        issues.push('Multiple H1 tags found')
      }

      const images = document.querySelectorAll('img')
      let missingAlt = 0
      images.forEach((img) => {
        if (!img.getAttribute('alt')) missingAlt++
      })
      if (missingAlt > 0) {
        score -= Math.min(20, missingAlt * 5)
        issues.push(`${missingAlt} images missing alt text`)
      }

      const canonical = document.querySelector('link[rel="canonical"]')
      if (!canonical) {
        score -= 10
        issues.push('Missing canonical link')
      }

      const ogTitle = document.querySelector('meta[property="og:title"]')
      const ogDesc = document.querySelector('meta[property="og:description"]')
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (!ogTitle || !ogDesc || !ogImage) {
        score -= 15
        issues.push('Incomplete Open Graph tags')
      }

      setSeo({ score: Math.max(0, score), issues, timestamp: Date.now() })
    }

    if (document.readyState === 'complete') analyze()
    else {
      const onLoad = () => analyze()
      window.addEventListener('load', onLoad)
      return () => window.removeEventListener('load', onLoad)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return

    const report = () => {
      const payload = {
        url: window.location.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        structuredData: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => {
          try { return JSON.parse(s.textContent || '') } catch { return null }
        }).filter(Boolean),
        timestamp: new Date().toISOString()
      }

      const issues: string[] = []
      if (!payload.title || payload.title.length < 30) issues.push('Title too short or missing')
      if (!payload.description || payload.description.length < 120) issues.push('Meta description too short or missing')
      if (!payload.canonical) issues.push('Canonical URL missing')
      if (!payload.ogImage) issues.push('Open Graph image missing')

      fetch('/api/analytics/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, issues }),
        keepalive: true
      }).catch(() => {})
    }

    if (document.readyState === 'complete') setTimeout(report, 2000)
    else window.addEventListener('load', () => setTimeout(report, 2000))
  }, [])

  if (!seo || !visible) return null

  const scoreColor = seo.score >= 90 ? 'text-green-600' : seo.score >= 70 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800">SEO Monitor</h3>
        <div className={`text-lg font-bold ${scoreColor}`}>{seo.score}/100</div>
      </div>
      {seo.issues.length > 0 ? (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-600">Issues:</h4>
          <ul className="text-xs text-red-600 space-y-1">
            {seo.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-red-500 mt-0.5">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-xs text-green-600">✓ All SEO checks passed!</div>
      )}
    </div>
  )
}
