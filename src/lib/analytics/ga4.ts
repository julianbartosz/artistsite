// Google Analytics 4 Integration
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
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
  custom_parameters?: Record<string, any>
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
  [key: string]: any
}

export interface EcommerceItem {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price: number
  quantity: number
  currency?: string
}

export interface PurchaseData {
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
    window.gtag = function() {
      window.dataLayer.push(arguments)
    }

    // Configure GA4
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      page_title: document.title,
      page_location: window.location.href,
    })

    this.isInitialized = true
    console.log('🔍 GA4 Analytics initialized:', measurementId)
  }

  /**
   * Track page view
   */
  static trackPageView(path: string, title?: string): void {
    if (!this.isReady()) return

    window.gtag('config', this.measurementId, {
      page_path: path,
      page_title: title || document.title,
    })
  }

  /**
   * Track custom event
   */
  static trackEvent(eventName: string, parameters: GA4EventParams = {}): void {
    if (!this.isReady()) return

    const eventData = {
      ...parameters,
      timestamp: new Date().toISOString(),
    }

    window.gtag('event', eventName, eventData)
    
    // Also store in our local analytics
    this.storeLocalEvent(eventName, eventData)
  }

  /**
   * Track e-commerce events
   */
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

  /**
   * Track add to cart
   */
  static trackAddToCart(item: EcommerceItem): void {
    this.trackEvent('add_to_cart', {
      currency: item.currency || 'USD',
      value: item.price * item.quantity,
      items: [item],
    })
  }

  /**
   * Track begin checkout
   */
  static trackBeginCheckout(items: EcommerceItem[], value: number): void {
    this.trackEvent('begin_checkout', {
      currency: 'USD',
      value,
      items,
    })
  }

  /**
   * Track view item
   */
  static trackViewItem(item: EcommerceItem): void {
    this.trackEvent('view_item', {
      currency: item.currency || 'USD',
      value: item.price,
      items: [item],
    })
  }

  /**
   * Set user properties
   */
  static setUserProperties(properties: Record<string, any>): void {
    if (!this.isReady()) return

    window.gtag('config', this.measurementId, {
      custom_map: properties,
    })
  }

  /**
   * Track newsletter signup
   */
  static trackNewsletterSignup(method: string = 'form'): void {
    this.trackEvent('newsletter_signup', {
      event_category: 'engagement',
      method,
    })
  }

  /**
   * Track social share
   */
  static trackSocialShare(platform: string, url: string): void {
    this.trackEvent('share', {
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
    this.trackEvent('search', {
      event_category: 'engagement',
      search_term: searchTerm,
      value: resultCount,
    })
  }

  /**
   * Track file download
   */
  static trackDownload(fileName: string, fileType: string): void {
    this.trackEvent('file_download', {
      event_category: 'engagement',
      file_name: fileName,
      file_extension: fileType,
    })
  }

  /**
   * Track video interaction
   */
  static trackVideo(action: 'play' | 'pause' | 'complete', videoTitle: string, progress?: number): void {
    this.trackEvent(`video_${action}`, {
      event_category: 'video',
      video_title: videoTitle,
      video_current_time: progress,
    })
  }

  /**
   * Track form submission
   */
  static trackFormSubmit(formName: string, success: boolean): void {
    this.trackEvent('form_submit', {
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
  private static async storeLocalEvent(eventName: string, properties: any): Promise<void> {
    try {
      const sessionId = this.getSessionId()
      const userId = this.getUserId()

      await fetch('/api/analytics/events', {
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
    } catch (error) {
      console.warn('Failed to store local analytics event:', error)
    }
  }

  /**
   * Get or create session ID
   */
  private static getSessionId(): string {
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