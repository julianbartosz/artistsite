// Google Analytics 4 Integration
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

  /**
   * Initialize Google Analytics 4
   */
  static initialize(measurementId: string): void {
    if (typeof window === 'undefined' || this.isInitialized) {
      return
    }

    this.measurementId = measurementId
    
    // Load GA4 script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    window.gtag = function(...args: GtagArguments) {
      window.dataLayer.push(args)
    }

    // Configure GA4 with proper browser checks
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      page_title: typeof document !== 'undefined' ? document.title : '',
      page_location: typeof window !== 'undefined' ? window.location.href : '',
    })

    this.isInitialized = true

    if (process.env.NODE_ENV === 'development') {
      // Only log in development
      // eslint-disable-next-line no-console
      console.log('GA4 Analytics initialized:', measurementId)
    }
  }

  /**
   * Track page view
   */
  static trackPageView(path: string, title?: string): void {
    if (!GA4Analytics.isReady()) return

    window.gtag('config', GA4Analytics.measurementId, {
      page_path: path,
      page_title: title || document.title,
    })
  }

  /**
   * Track custom event
   */
  static trackEvent(eventName: string, parameters: GA4EventParams = {}): void {
    if (!GA4Analytics.isReady()) return

    const eventData = {
      ...parameters,
      timestamp: new Date().toISOString(),
    }

    window.gtag('event', eventName, eventData)
    
    // Also store in our local analytics with better error handling
    GA4Analytics.storeLocalEvent(eventName, eventData).catch(() => {
      // Silently fail for analytics - don't interrupt user experience
    })
  }

  /**
   * Track e-commerce events
   */
  static trackPurchase(purchaseData: PurchaseData): void {
    if (!GA4Analytics.isReady()) return

    window.gtag('event', 'purchase', {
      transaction_id: purchaseData.transaction_id,
      value: purchaseData.value,
      currency: purchaseData.currency,
      shipping: purchaseData.shipping,
      tax: purchaseData.tax,
      items: purchaseData.items,
    })

    GA4Analytics.storeLocalEvent('purchase', purchaseData)
  }

  /**
   * Track add to cart
   */
  static trackAddToCart(item: EcommerceItem): void {
    GA4Analytics.trackEvent('add_to_cart', {
      currency: item.currency || 'USD',
      value: item.price * item.quantity,
      items: [item],
    })
  }

  /**
   * Track begin checkout
   */
  static trackBeginCheckout(items: EcommerceItem[], value: number): void {
    GA4Analytics.trackEvent('begin_checkout', {
      currency: 'USD',
      value,
      items,
    })
  }

  /**
   * Track view item
   */
  static trackViewItem(item: EcommerceItem): void {
    GA4Analytics.trackEvent('view_item', {
      currency: item.currency || 'USD',
      value: item.price,
      items: [item],
    })
  }

  /**
   * Set user properties
   */
  static setUserProperties(properties: Record<string, string | number | boolean>): void {
    if (!GA4Analytics.isReady()) return

    window.gtag('config', GA4Analytics.measurementId, {
      custom_map: properties,
    })
  }

  /**
   * Track newsletter signup
   */
  static trackNewsletterSignup(method: string = 'form'): void {
    GA4Analytics.trackEvent('newsletter_signup', {
      event_category: 'engagement',
      method,
    })
  }

  /**
   * Track social share
   */
  static trackSocialShare(platform: string, url: string): void {
    GA4Analytics.trackEvent('share', {
      event_category: 'engagement',
      method: platform,
      content_type: 'page',
      item_id: url,
    })
  }

  /**
   * Track search
   */
  static trackSearch(searchTerm: string, resultCount: number): void {
    GA4Analytics.trackEvent('search', {
      event_category: 'engagement',
      search_term: searchTerm,
      value: resultCount,
    })
  }

  /**
   * Track file download
   */
  static trackDownload(fileName: string, fileType: string): void {
    GA4Analytics.trackEvent('file_download', {
      event_category: 'engagement',
      file_name: fileName,
      file_extension: fileType,
    })
  }

  /**
   * Track video interaction
   */
  static trackVideo(action: 'play' | 'pause' | 'complete', videoTitle: string, progress?: number): void {
    GA4Analytics.trackEvent(`video_${action}`, {
      event_category: 'video',
      video_title: videoTitle,
      video_current_time: progress,
    })
  }

  /**
   * Track form submission
   */
  static trackFormSubmit(formName: string, success: boolean): void {
    GA4Analytics.trackEvent('form_submit', {
      event_category: 'form',
      form_name: formName,
      success: success ? 'true' : 'false',
    })
  }

  /**
   * Check if GA4 is ready
   */
  private static isReady(): boolean {
    return typeof window !== 'undefined' && 
           this.isInitialized && 
           typeof window.gtag === 'function'
  }

  /**
   * Store event in local analytics database
   */
  private static async storeLocalEvent(eventName: string, properties: Record<string, unknown>): Promise<void> {
    // Skip if running on server
    if (typeof window === 'undefined') return

    try {
      const sessionId = GA4Analytics.getSessionId()
      const userId = GA4Analytics.getUserId()

      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: eventName,
          user_id: userId,
          session_id: sessionId,
          properties: properties,
          page_url: window.location.href,
        }),
      })

      // Don't throw errors for analytics failures
      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.warn(`Analytics API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      // Only log in development, never throw
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to store local analytics event:', error)
      }
    }
  }

  /**
   * Get or create session ID
   */
  private static getSessionId(): string {
    // Return empty string if running on server
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return ''
    }

    let sessionId = sessionStorage.getItem('analytics_session_id')
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('analytics_session_id', sessionId)
    }
    return sessionId
  }

  /**
   * Get user ID (if authenticated)
   */
  private static getUserId(): string | undefined {
    // This would integrate with your authentication system
    // For now, return undefined for anonymous users
    return undefined
  }
}