'use client'
import { createContext, useContext, useEffect, ReactNode } from 'react'
import { Marketing, type EcommerceItem } from '@/domain/marketing'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

interface AnalyticsContextType {
  trackEvent: typeof Marketing.analytics.trackEvent
  trackPageView: typeof Marketing.analytics.trackPageView
  trackPurchase: typeof Marketing.analytics.trackPurchase
  trackAddToCart: typeof Marketing.analytics.trackAddToCart
  trackViewItem: typeof Marketing.analytics.trackViewItem
  trackBeginCheckout: typeof Marketing.analytics.trackBeginCheckout
  trackNewsletterSignup: typeof Marketing.analytics.trackNewsletterSignup
  trackSocialShare: typeof Marketing.analytics.trackSocialShare
  trackSearch: typeof Marketing.analytics.trackSearch
  trackFormSubmit: typeof Marketing.analytics.trackFormSubmit
  // Funnel tracking
  trackFunnelStep: typeof Marketing.funnels.trackFunnelStep
  trackEcommerceFunnel: typeof Marketing.funnels.trackEcommerceFunnel
  trackNewsletterFunnel: typeof Marketing.funnels.trackNewsletterFunnel
  trackPortfolioFunnel: typeof Marketing.funnels.trackPortfolioFunnel
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null)

interface AnalyticsProviderProps { children: ReactNode }

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    if (measurementId) {
      Marketing.analytics.initialize(measurementId)
    }
    Marketing.funnels.initialize()
    if (session?.user) {
      Marketing.analytics.setUserProperties({
        user_id: session.user.id,
        user_type: 'authenticated',
      })
    }
  }, [session])

  useEffect(() => {
    Marketing.analytics.trackPageView(pathname)

    if (pathname === '/portfolio') {
      Marketing.funnels.portfolio.portfolioView(session?.user?.id)
    } else if (pathname.startsWith('/portfolio/')) {
      const artworkId = pathname.split('/').pop()
      Marketing.funnels.portfolio.artworkView(artworkId || '', session?.user?.id)
    } else if (pathname === '/shop') {
      Marketing.analytics.trackEvent('shop_page_view', {
        event_category: 'ecommerce',
        page_path: pathname,
      })
    }
  }, [pathname, session?.user?.id])

  const contextValue: AnalyticsContextType = {
    trackEvent: Marketing.analytics.trackEvent,
    trackPageView: Marketing.analytics.trackPageView,
    trackPurchase: Marketing.analytics.trackPurchase,
    trackAddToCart: Marketing.analytics.trackAddToCart,
    trackViewItem: Marketing.analytics.trackViewItem,
    trackBeginCheckout: Marketing.analytics.trackBeginCheckout,
    trackNewsletterSignup: Marketing.analytics.trackNewsletterSignup,
    trackSocialShare: Marketing.analytics.trackSocialShare,
    trackSearch: Marketing.analytics.trackSearch,
    trackFormSubmit: Marketing.analytics.trackFormSubmit,
    trackFunnelStep: Marketing.funnels.trackFunnelStep,
    trackEcommerceFunnel: Marketing.funnels.trackEcommerceFunnel,
    trackNewsletterFunnel: Marketing.funnels.trackNewsletterFunnel,
    trackPortfolioFunnel: Marketing.funnels.trackPortfolioFunnel,
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (!context) throw new Error('useAnalytics must be used within an AnalyticsProvider')
  return context
}

// Convenience hooks
export function useEcommerceTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()
  return {
    trackProductView: (productId: string, productName: string, category: string, price: number) => {
      analytics.trackViewItem({ item_id: productId, item_name: productName, item_category: category, price, quantity: 1 })
      analytics.trackEcommerceFunnel.productView(productId, session?.user?.id)
    },
    trackAddToCart: (productId: string, productName: string, category: string, price: number, quantity = 1) => {
      analytics.trackAddToCart({ item_id: productId, item_name: productName, item_category: category, price, quantity })
      analytics.trackEcommerceFunnel.addToCart(productId, session?.user?.id)
    },
    trackBeginCheckout: (items: EcommerceItem[], total: number) => {
      analytics.trackBeginCheckout(items, total)
      analytics.trackEcommerceFunnel.beginCheckout(session?.user?.id)
    },
    trackPurchase: (transactionId: string, items: EcommerceItem[], total: number, shipping?: number, tax?: number) => {
      analytics.trackPurchase({ transaction_id: transactionId, value: total, currency: 'USD', items, shipping, tax })
      analytics.trackEcommerceFunnel.purchase(transactionId, session?.user?.id)
    },
  }
}

export function useNewsletterTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()
  return {
    trackFormView: () => {
      analytics.trackEvent('newsletter_form_view', { event_category: 'engagement' })
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
      analytics.trackEvent('artwork_view', { event_category: 'content', artwork_id: artworkId, artwork_title: artworkTitle })
      analytics.trackPortfolioFunnel.artworkView(artworkId, session?.user?.id)
    },
    trackContactFormView: () => {
      analytics.trackEvent('contact_form_view', { event_category: 'engagement' })
      analytics.trackPortfolioFunnel.contactFormView(session?.user?.id)
    },
    trackCommissionInquiry: (artworkId?: string) => {
      analytics.trackEvent('commission_inquiry', { event_category: 'conversion', artwork_id: artworkId })
      analytics.trackPortfolioFunnel.commissionInquiry(session?.user?.id)
    },
  }
}
