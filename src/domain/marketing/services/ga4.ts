// Google Analytics 4 Integration
// Moved from src/lib/analytics/ga4.ts to src/domain/marketing/services/ga4.ts as part of Phase 2 consolidation

type GtagCommand = 'config' | 'event' | 'js' | 'consent'
type GtagArguments = [command: GtagCommand, ...args: unknown[]]

declare global {
  interface Window {
    gtag: (...args: GtagArguments) => void
    dataLayer: unknown[]
  }
}

export interface GA4EventParams {
  event_category?: string
  event_label?: string
  value?: number
  currency?: string
  transaction_id?: string
  item_id?: string
  item_name?: string
  item_category?: string
  price?: number
  quantity?: number
  // Additional properties used throughout the codebase
  items?: EcommerceItem[]
  method?: string
  search_term?: string
  file_name?: string
  file_extension?: string
  video_title?: string
  video_current_time?: number
  form_name?: string
  success?: string
  content_type?: string
  page_path?: string
  artwork_id?: string
  artwork_title?: string
  // Allow any additional custom properties
  [key: string]: string | number | boolean | EcommerceItem[] | undefined
}

export interface EcommerceItem {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price: number
  quantity: number
  currency?: string
  [key: string]: string | number | undefined
}

export interface PurchaseData extends Record<string, unknown> {
  transaction_id: string
  value: number
  currency: string
  items: EcommerceItem[]
  shipping?: number
  tax?: number
}

export class GA4Analytics {
  private static measurementId: string
  private static isInitialized = false

  static initialize(measurementId: string): void {
    if (typeof window === 'undefined' || this.isInitialized) return

    this.measurementId = measurementId

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)

    window.dataLayer = window.dataLayer || []
    window.gtag = function (...args: GtagArguments) {
      window.dataLayer.push(args)
    }

    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      page_title: typeof document !== 'undefined' ? document.title : '',
      page_location: typeof window !== 'undefined' ? window.location.href : '',
    })

    this.isInitialized = true

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('🔍 GA4 Analytics initialized:', measurementId)
    }
  }

  static trackPageView(path: string, title?: string): void {
    if (!this.isReady()) return
    window.gtag('config', this.measurementId, {
      page_path: path,
      page_title: title || document.title,
    })
  }

  static trackEvent(eventName: string, parameters: GA4EventParams = {}): void {
    if (!this.isReady()) return

    const eventData = {
      ...parameters,
      timestamp: new Date().toISOString(),
    }

    window.gtag('event', eventName, eventData)

    this.storeLocalEvent(eventName, eventData).catch(() => {
      // Silent
    })
  }

  static trackPurchase(purchaseData: PurchaseData): void {
    if (!this.isReady()) return

    window.gtag('event', 'purchase', {
      transaction_id: purchaseData.transaction_id,
      value: purchaseData.value,
      currency: purchaseData.currency,
      shipping: purchaseData.shipping,
      tax: purchaseData.tax,
      items: purchaseData.items,
    })

    this.storeLocalEvent('purchase', purchaseData)
  }

  static trackAddToCart(item: EcommerceItem): void {
    this.trackEvent('add_to_cart', {
      currency: item.currency || 'USD',
      value: item.price * item.quantity,
      items: [item],
    })
  }

  static trackBeginCheckout(items: EcommerceItem[], value: number): void {
    this.trackEvent('begin_checkout', {
      currency: 'USD',
      value,
      items,
    })
  }

  static trackViewItem(item: EcommerceItem): void {
    this.trackEvent('view_item', {
      currency: item.currency || 'USD',
      value: item.price,
      items: [item],
    })
  }

  static setUserProperties(properties: Record<string, string | number | boolean>): void {
    if (!this.isReady()) return
    window.gtag('config', this.measurementId, {
      custom_map: properties,
    })
  }

  static trackNewsletterSignup(method: string = 'form'): void {
    this.trackEvent('newsletter_signup', {
      event_category: 'engagement',
      method,
    })
  }

  static trackSocialShare(platform: string, url: string): void {
    this.trackEvent('share', {
      event_category: 'engagement',
      method: platform,
      content_type: 'page',
      item_id: url,
    })
  }

  static trackSearch(searchTerm: string, resultCount: number): void {
    this.trackEvent('search', {
      event_category: 'engagement',
      search_term: searchTerm,
      value: resultCount,
    })
  }

  static trackDownload(fileName: string, fileType: string): void {
    this.trackEvent('file_download', {
      event_category: 'engagement',
      file_name: fileName,
      file_extension: fileType,
    })
  }

  static trackVideo(action: 'play' | 'pause' | 'complete', videoTitle: string, progress?: number): void {
    this.trackEvent(`video_${action}`, {
      event_category: 'video',
      video_title: videoTitle,
      video_current_time: progress,
    })
  }

  static trackFormSubmit(formName: string, success: boolean): void {
    this.trackEvent('form_submit', {
      event_category: 'form',
      form_name: formName,
      success: success ? 'true' : 'false',
    })
  }

  private static isReady(): boolean {
    return (
      typeof window !== 'undefined' &&
      this.isInitialized &&
      typeof window.gtag === 'function'
    )
  }

  private static async storeLocalEvent(eventName: string, properties: Record<string, unknown>): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const sessionId = this.getSessionId()
      const userId = this.getUserId()

      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          user_id: userId,
          session_id: sessionId,
          properties: properties,
          page_url: window.location.href,
        }),
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.warn(`Analytics API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to store local analytics event:', error)
      }
    }
  }

  private static getSessionId(): string {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return ''

    let sessionId = sessionStorage.getItem('analytics_session_id')
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('analytics_session_id', sessionId)
    }
    return sessionId
  }

  private static getUserId(): string | undefined {
    return undefined
  }
}
