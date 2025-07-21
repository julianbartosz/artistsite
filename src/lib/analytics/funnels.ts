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

  /**
   * Track a funnel step
   */
  static trackFunnelStep(funnel: string, step: string, userId?: string): void {
    const sessionId = this.getSessionId()
    
    // Track in GA4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', step, {
        event_category: 'funnel',
        funnel_name: funnel,
        step_name: step,
        user_id: userId,
        session_id: sessionId,
      })
    }

    // Store in local analytics
    this.storeFunnelEvent(funnel, step, userId, sessionId)
  }

  /**
   * Analyze funnel performance
   */
  static async analyzeFunnelPerformance(funnelName: string): Promise<FunnelAnalysis> {
    try {
      const response = await fetch(`/api/analytics/funnels/${funnelName}`)
      if (!response.ok) {
        throw new Error('Failed to fetch funnel analysis')
      }
      return await response.json()
    } catch (error) {
      console.error('Error analyzing funnel performance:', error)
      throw error
    }
  }

  /**
   * Identify critical dropoff points
   */
  static async identifyDropoffPoints(funnelName?: string): Promise<DropoffReport[]> {
    try {
      const url = funnelName 
        ? `/api/analytics/funnels/dropoff?funnel=${funnelName}`
        : '/api/analytics/funnels/dropoff'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch dropoff analysis')
      }
      return await response.json()
    } catch (error) {
      console.error('Error identifying dropoff points:', error)
      throw error
    }
  }

  /**
   * Get funnel configuration
   */
  static getFunnelSteps(funnelName: string): FunnelStep[] {
    return this.funnels[funnelName as keyof typeof this.funnels] || []
  }

  /**
   * Get all available funnels
   */
  static getAvailableFunnels(): string[] {
    return Object.keys(this.funnels)
  }

  /**
   * Track e-commerce funnel automatically
   */
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

  /**
   * Track newsletter funnel automatically
   */
  static trackNewsletterFunnel = {
    formView: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('newsletter', 'newsletter_form_view', userId)
    },
    
    signup: (userId?: string) => {
      ConversionFunnels.trackFunnelStep('newsletter', 'newsletter_signup', userId)
    },
  }

  /**
   * Track portfolio funnel automatically
   */
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

  /**
   * Calculate time between funnel steps
   */
  static async calculateStepTiming(funnelName: string, userId: string): Promise<Record<string, number>> {
    try {
      const response = await fetch(`/api/analytics/funnels/${funnelName}/timing?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch step timing')
      }
      return await response.json()
    } catch (error) {
      console.error('Error calculating step timing:', error)
      return {}
    }
  }

  /**
   * Store funnel event in database
   */
  private static async storeFunnelEvent(
    funnel: string, 
    step: string, 
    userId?: string, 
    sessionId?: string
  ): Promise<void> {
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: step,
          user_id: userId,
          session_id: sessionId,
          properties: {
            funnel_name: funnel,
            step_name: step,
            timestamp: new Date().toISOString(),
          },
          page_url: typeof window !== 'undefined' ? window.location.href : '',
        }),
      })
    } catch (error) {
      console.warn('Failed to store funnel event:', error)
    }
  }

  /**
   * Get or create session ID
   */
  private static getSessionId(): string {
    if (typeof window === 'undefined') return ''
    
    let sessionId = sessionStorage.getItem('analytics_session_id')
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('analytics_session_id', sessionId)
    }
    return sessionId
  }

  /**
   * Advanced funnel analysis with cohort data
   */
  static async getAdvancedFunnelAnalysis(funnelName: string, options: {
    dateRange?: { start: Date; end: Date }
    userSegment?: string
    trafficSource?: string
  } = {}): Promise<FunnelAnalysis & {
    cohortBreakdown: Record<string, FunnelAnalysis>
    segmentComparison: Record<string, number>
    trafficSourceAnalysis: Record<string, number>
  }> {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('funnel', funnelName)
      
      if (options.dateRange) {
        queryParams.append('startDate', options.dateRange.start.toISOString())
        queryParams.append('endDate', options.dateRange.end.toISOString())
      }
      
      if (options.userSegment) {
        queryParams.append('segment', options.userSegment)
      }
      
      if (options.trafficSource) {
        queryParams.append('source', options.trafficSource)
      }

      const response = await fetch(`/api/analytics/funnels/advanced?${queryParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch advanced funnel analysis')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching advanced funnel analysis:', error)
      throw error
    }
  }
}