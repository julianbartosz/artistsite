'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { GA4Analytics, type EcommerceItem } from '@/lib/analytics/ga4'
import { ConversionFunnels } from '@/lib/analytics/funnels'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

interface AnalyticsContextType {
  trackEvent: typeof GA4Analytics.trackEvent
  trackPageView: typeof GA4Analytics.trackPageView
  trackPurchase: typeof GA4Analytics.trackPurchase
  trackAddToCart: typeof GA4Analytics.trackAddToCart
  trackViewItem: typeof GA4Analytics.trackViewItem
  trackBeginCheckout: typeof GA4Analytics.trackBeginCheckout
  trackNewsletterSignup: typeof GA4Analytics.trackNewsletterSignup
  trackSocialShare: typeof GA4Analytics.trackSocialShare
  trackSearch: typeof GA4Analytics.trackSearch
  trackFormSubmit: typeof GA4Analytics.trackFormSubmit
  // Funnel tracking
  trackFunnelStep: typeof ConversionFunnels.trackFunnelStep
  trackEcommerceFunnel: typeof ConversionFunnels.trackEcommerceFunnel
  trackNewsletterFunnel: typeof ConversionFunnels.trackNewsletterFunnel
  trackPortfolioFunnel: typeof ConversionFunnels.trackPortfolioFunnel
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null)

interface AnalyticsProviderProps {
  children: ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    // Initialize GA4 if measurement ID is available
    const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    if (measurementId) {
      GA4Analytics.initialize(measurementId)
    }

    // Initialize ConversionFunnels system
    ConversionFunnels.initialize()

    // Set user properties if user is logged in
    if (session?.user) {
      GA4Analytics.setUserProperties({
        user_id: session.user.id,
        user_type: 'authenticated',
      })
    }
  }, [session])

  useEffect(() => {
    // Track page views on route changes
    GA4Analytics.trackPageView(pathname)
    
    // Track specific page types for funnels
    if (pathname === '/portfolio') {
      ConversionFunnels.trackPortfolioFunnel.portfolioView(session?.user?.id)
    } else if (pathname.startsWith('/portfolio/')) {
      const artworkId = pathname.split('/').pop()
      ConversionFunnels.trackPortfolioFunnel.artworkView(artworkId || '', session?.user?.id)
    } else if (pathname === '/shop') {
      // Track shop page view
      GA4Analytics.trackEvent('shop_page_view', {
        event_category: 'ecommerce',
        page_path: pathname,
      })
    }
  }, [pathname, session?.user?.id])

  const contextValue: AnalyticsContextType = {
    trackEvent: GA4Analytics.trackEvent,
    trackPageView: GA4Analytics.trackPageView,
    trackPurchase: GA4Analytics.trackPurchase,
    trackAddToCart: GA4Analytics.trackAddToCart,
    trackViewItem: GA4Analytics.trackViewItem,
    trackBeginCheckout: GA4Analytics.trackBeginCheckout,
    trackNewsletterSignup: GA4Analytics.trackNewsletterSignup,
    trackSocialShare: GA4Analytics.trackSocialShare,
    trackSearch: GA4Analytics.trackSearch,
    trackFormSubmit: GA4Analytics.trackFormSubmit,
    trackFunnelStep: ConversionFunnels.trackFunnelStep,
    trackEcommerceFunnel: ConversionFunnels.trackEcommerceFunnel,
    trackNewsletterFunnel: ConversionFunnels.trackNewsletterFunnel,
    trackPortfolioFunnel: ConversionFunnels.trackPortfolioFunnel,
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider')
  }
  return context
}

// Convenience hooks for specific tracking
export function useEcommerceTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()

  return {
    trackProductView: (productId: string, productName: string, category: string, price: number) => {
      analytics.trackViewItem({
        item_id: productId,
        item_name: productName,
        item_category: category,
        price,
        quantity: 1,
      })
      analytics.trackEcommerceFunnel.productView(productId, session?.user?.id)
    },
    
    trackAddToCart: (productId: string, productName: string, category: string, price: number, quantity: number = 1) => {
      analytics.trackAddToCart({
        item_id: productId,
        item_name: productName,
        item_category: category,
        price,
        quantity,
      })
      analytics.trackEcommerceFunnel.addToCart(productId, session?.user?.id)
    },
    
    trackBeginCheckout: (items: EcommerceItem[], total: number) => {
      analytics.trackBeginCheckout(items, total)
      analytics.trackEcommerceFunnel.beginCheckout(session?.user?.id)
    },
    
    trackPurchase: (transactionId: string, items: EcommerceItem[], total: number, shipping?: number, tax?: number) => {
      analytics.trackPurchase({
        transaction_id: transactionId,
        value: total,
        currency: 'USD',
        items,
        shipping,
        tax,
      })
      analytics.trackEcommerceFunnel.purchase(transactionId, session?.user?.id)
    },
  }
}

export function useNewsletterTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()

  return {
    trackFormView: () => {
      analytics.trackEvent('newsletter_form_view', {
        event_category: 'engagement',
      })
      analytics.trackNewsletterFunnel.formView(session?.user?.id)
    },
    
    trackSignup: (method: string = 'form') => {
      analytics.trackNewsletterSignup(method)
      analytics.trackNewsletterFunnel.signup(session?.user?.id)
    },
  }
}

export function usePortfolioTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()

  return {
    trackArtworkView: (artworkId: string, artworkTitle: string) => {
      analytics.trackEvent('artwork_view', {
        event_category: 'content',
        artwork_id: artworkId,
        artwork_title: artworkTitle,
      })
      analytics.trackPortfolioFunnel.artworkView(artworkId, session?.user?.id)
    },
    
    trackContactFormView: () => {
      analytics.trackEvent('contact_form_view', {
        event_category: 'engagement',
      })
      analytics.trackPortfolioFunnel.contactFormView(session?.user?.id)
    },
    
    trackCommissionInquiry: (artworkId?: string) => {
      analytics.trackEvent('commission_inquiry', {
        event_category: 'conversion',
        artwork_id: artworkId,
      })
      analytics.trackPortfolioFunnel.commissionInquiry(session?.user?.id)
    },
  }
}