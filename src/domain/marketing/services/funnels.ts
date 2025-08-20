export interface FunnelStep {
  name: string
  eventName: string
  description: string
  order: number
}
export interface FunnelAnalysis {
  funnelName: string
  totalUsers: number
  steps: Array<{
    step: FunnelStep
    users: number
    dropoffRate: number
    conversionRate: number
  }>
  overallConversionRate: number
  avgTimeToConvert: number
}
export interface DropoffReport {
  funnelName: string
  criticalDropoffPoints: Array<{
    fromStep: string
    toStep: string
    dropoffRate: number
    usersLost: number
    recommendations: string[]
  }>
}
export class ConversionFunnels {
  // Predefined funnel configurations
  private static funnels = {
    ecommerce: [
      { name: 'Product View', eventName: 'view_item', description: 'User views a product', order: 1 },
      { name: 'Add to Cart', eventName: 'add_to_cart', description: 'User adds item to cart', order: 2 },
      { name: 'Begin Checkout', eventName: 'begin_checkout', description: 'User starts checkout', order: 3 },
      { name: 'Purchase', eventName: 'purchase', description: 'User completes purchase', order: 4 },
    ],
    newsletter: [
      { name: 'Visit Site', eventName: 'page_view', description: 'User visits the site', order: 1 },
      { name: 'Newsletter Form View', eventName: 'newsletter_form_view', description: 'User sees newsletter signup', order: 2 },
      { name: 'Newsletter Signup', eventName: 'newsletter_signup', description: 'User signs up for newsletter', order: 3 },
    ],
    portfolio: [
      { name: 'Portfolio Page View', eventName: 'portfolio_view', description: 'User visits portfolio', order: 1 },
      { name: 'Artwork View', eventName: 'artwork_view', description: 'User views specific artwork', order: 2 },
      { name: 'Contact Form View', eventName: 'contact_form_view', description: 'User opens contact form', order: 3 },
      { name: 'Commission Inquiry', eventName: 'commission_inquiry', description: 'User submits commission request', order: 4 },
    ],
  }
  private static initialized = false
  private static syncTimeout: NodeJS.Timeout | null = null
  /** Initialize analytics hooks */
  static initialize(): void {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true
    this.syncPendingEvents()
    window.addEventListener('online', () => this.syncPendingEvents())
    window.addEventListener('beforeunload', () => this.syncPendingEvents())
  }
  /** Track a funnel step */
  static trackFunnelStep(funnel: string, step: string, userId?: string): void {
    const sessionId = this.getSessionId()
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', step, {
        event_category: 'funnel',
        funnel_name: funnel,
        step_name: step,
        user_id: userId,
        session_id: sessionId,
      })
    }
    this.storeFunnelEvent(funnel, step, userId, sessionId)
  }
  /** Analyze funnel performance */
  static async analyzeFunnelPerformance(funnelName: string): Promise<FunnelAnalysis> {
    const response = await fetch(`/api/analytics/funnels/${funnelName}`)
    if (!response.ok) throw new Error('Failed to fetch funnel analysis')
    return await response.json()
  }
  /** Identify critical dropoff points */
  static async identifyDropoffPoints(funnelName?: string): Promise<DropoffReport[]> {
    const url = funnelName ? `/api/analytics/funnels/dropoff?funnel=${funnelName}` : '/api/analytics/funnels/dropoff'
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch dropoff analysis')
    return await response.json()
  }
  /** Get funnel configuration */
  static getFunnelSteps(funnelName: string): FunnelStep[] {
    return this.funnels[funnelName as keyof typeof this.funnels] || []
  }
  /** Get all available funnels */
  static getAvailableFunnels(): string[] {
    return Object.keys(this.funnels)
  }
  /** E-commerce funnel helpers */
  static trackEcommerceFunnel = {
    productView: (productId: string, userId?: string) => {
      ConversionFunnels.trackFunnelStep('ecommerce', 'view_item', userId)
    },
    addToCart: (productId: string, userId?: string) => {
      ConversionFunnels.trackFunnelStep('ecommerce', 'add_to_cart', userId)
    },
    beginCheckout: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('ecommerce', 'begin_checkout', userId)
    },
    purchase: (transactionId: string, userId?: string) => {
      ConversionFunnels.trackFunnelStep('ecommerce', 'purchase', userId)
    },
  }
  /** Newsletter funnel helpers */
  static trackNewsletterFunnel = {
    formView: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('newsletter', 'newsletter_form_view', userId)
    },
    signup: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('newsletter', 'newsletter_signup', userId)
    },
  }
  /** Portfolio funnel helpers */
  static trackPortfolioFunnel = {
    portfolioView: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('portfolio', 'portfolio_view', userId)
    },
    artworkView: (artworkId: string, userId?: string) => {
      ConversionFunnels.trackFunnelStep('portfolio', 'artwork_view', userId)
    },
    contactFormView: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('portfolio', 'contact_form_view', userId)
    },
    commissionInquiry: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('portfolio', 'commission_inquiry', userId)
    },
  }
  /** Calculate time between steps */
  static async calculateStepTiming(funnelName: string, userId: string): Promise<Record<string, number>> {
    try {
      const response = await fetch(`/api/analytics/funnels/${funnelName}/timing?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch step timing')
      return await response.json()
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error calculating step timing:', error)
      }
      return {}
    }
  }
  /** Store funnel event */
  private static async storeFunnelEvent(
    funnel: string,
    step: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    const eventData = {
      event_name: step,
      user_id: userId,
      session_id: sessionId,
      properties: {
        funnel_name: funnel,
        step_name: step,
        timestamp: new Date().toISOString(),
      },
      page_url: typeof window !== 'undefined' ? window.location.href : '',
    }
    const endpoints = ['/api/events', '/api/analytics/events']
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        })
        if (response.ok) return
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Failed to send to ${endpoint}:`, error)
        }
      }
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const fallbackEvents = JSON.parse(localStorage.getItem('pending_events') || '[]')
        fallbackEvents.push({ ...eventData, timestamp: Date.now() })
        if (fallbackEvents.length > 50) fallbackEvents.splice(0, fallbackEvents.length - 50)
        localStorage.setItem('pending_events', JSON.stringify(fallbackEvents))
        this.schedulePendingEventSync()
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to store funnel event and fallback failed:', error)
      }
    }
  }
  /** Schedule pending sync */
  private static schedulePendingEventSync(): void {
    if (typeof window === 'undefined') return
    if (this.syncTimeout) clearTimeout(this.syncTimeout)
    this.syncTimeout = setTimeout(async () => {
      await this.syncPendingEvents()
    }, 30000)
  }
  /** Sync pending events from localStorage */
  private static async syncPendingEvents(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const pendingEvents = JSON.parse(localStorage.getItem('pending_events') || '[]')
      if (pendingEvents.length === 0) return
      const endpoints = ['/api/events', '/api/analytics/events']
      const successfulEvents: number[] = []
      for (let i = 0; i < pendingEvents.length; i++) {
        const event = pendingEvents[i]
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event),
            })
            if (response.ok) {
              successfulEvents.push(i)
              break
            }
          } catch {
            continue
          }
        }
      }
      if (successfulEvents.length > 0) {
        const remainingEvents = pendingEvents.filter((_: unknown, index: number) => !successfulEvents.includes(index))
        localStorage.setItem('pending_events', JSON.stringify(remainingEvents))
      }
      const stillPending = JSON.parse(localStorage.getItem('pending_events') || '[]')
      if (stillPending.length > 0) this.schedulePendingEventSync()
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to sync pending events:', error)
      }
    }
  }
  /** Get or create session ID */
  private static getSessionId(): string {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return ''
    let sessionId = sessionStorage.getItem('analytics_session_id')
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('analytics_session_id', sessionId)
    }
    return sessionId
  }
  /** Advanced analysis (proxy to API) */
  static async getAdvancedFunnelAnalysis(
    funnelName: string,
    options: { dateRange?: { start: Date; end: Date }; userSegment?: string; trafficSource?: string } = {}
  ): Promise<
    FunnelAnalysis & {
      cohortBreakdown: Record<string, FunnelAnalysis>
      segmentComparison: Record<string, number>
      trafficSourceAnalysis: Record<string, number>
    }
  > {
    const queryParams = new URLSearchParams()
    queryParams.append('funnel', funnelName)
    if (options.dateRange) {
      queryParams.append('startDate', options.dateRange.start.toISOString())
      queryParams.append('endDate', options.dateRange.end.toISOString())
    }
    if (options.userSegment) queryParams.append('segment', options.userSegment)
    if (options.trafficSource) queryParams.append('source', options.trafficSource)
    const response = await fetch(`/api/analytics/funnels/advanced?${queryParams.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch advanced funnel analysis')
    return await response.json()
  }
}
