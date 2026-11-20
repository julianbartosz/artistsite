'use client'

import { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react'
import { GA4Analytics, type EcommerceItem } from '@/lib/analytics/ga4'
import { ConversionFunnels, isIgnoredAnalyticsRoute } from '@/lib/analytics/funnels'
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
  isTrackingEnabled: boolean
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null)

interface AnalyticsProviderProps {
  children: ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const lastTrackedPathRef = useRef<string | null>(null)

  const isAdminSession = Boolean(session?.user?.isAdmin)
  const isTrackingEnabled = status !== 'loading' && !isAdminSession && !isIgnoredAnalyticsRoute(pathname)

  // Keep funnel suppression synchronously aligned with session/route state so
  // child mount effects never fire events for admin sessions or Studio previews.
  ConversionFunnels.setSuppressed(!isTrackingEnabled)

  useEffect(() => {
    ConversionFunnels.setSuppressed(!isTrackingEnabled)
    if (!isTrackingEnabled || ConversionFunnels.isTrackingSuppressed()) return

    fetch('/api/config/public')
      .then((response) => response.json())
      .then((config) => {
        const measurementId = typeof config.NEXT_PUBLIC_GA4_MEASUREMENT_ID === 'string'
          ? config.NEXT_PUBLIC_GA4_MEASUREMENT_ID.trim()
          : ''
        if (measurementId) {
          GA4Analytics.initialize(measurementId)
        }

        const pixelId = typeof config.FACEBOOK_PIXEL_ID === 'string' ? config.FACEBOOK_PIXEL_ID.trim() : ''
        if (!pixelId || typeof window === 'undefined') return

        const w = window as typeof window & { fbq?: (...args: unknown[]) => void; _fbq?: (...args: unknown[]) => void }
        if (w.fbq) {
          w.fbq('init', pixelId)
          return
        }

        const script = document.createElement('script')
        script.async = true
        script.src = 'https://connect.facebook.net/en_US/fbevents.js'
        script.onload = () => {
          const fbq = (...args: unknown[]) => {
            if (w.fbq) w.fbq(...args)
          }
          w.fbq = w.fbq || fbq
          w._fbq = w._fbq || w.fbq
          w.fbq('init', pixelId)
          w.fbq('track', 'PageView')
        }
        document.head.appendChild(script)
      })
      .catch(() => undefined)

    // Initialize ConversionFunnels system
    ConversionFunnels.initialize()

    // Set user properties if a non-admin collector is logged in
    if (session?.user) {
      GA4Analytics.setUserProperties({
        user_id: session.user.id,
        user_type: 'authenticated',
      })
    }
  }, [isTrackingEnabled, session?.user])

  useEffect(() => {
    if (!isTrackingEnabled || ConversionFunnels.isTrackingSuppressed()) return
    if (lastTrackedPathRef.current === pathname) return
    lastTrackedPathRef.current = pathname

    const userId = session?.user?.id

    // Track page views on route changes (GA4, Meta Pixel, and internal analytics)
    GA4Analytics.trackPageView(pathname)
    ConversionFunnels.trackPageView(userId)

    const w = window as typeof window & { fbq?: (...args: unknown[]) => void }
    if (w.fbq) {
      w.fbq('track', 'PageView')
    }

    // Track specific page types for funnels
    if (pathname === '/portfolio') {
      ConversionFunnels.trackPortfolioFunnel.portfolioView(userId)
    } else if (pathname.startsWith('/portfolio/')) {
      const artworkId = pathname.split('/').pop()
      ConversionFunnels.trackPortfolioFunnel.artworkView(artworkId || '', userId)
    } else if (pathname === '/shop') {
      GA4Analytics.trackEvent('shop_page_view', {
        event_category: 'ecommerce',
        page_path: pathname,
      })
    }
  }, [isTrackingEnabled, pathname, session?.user?.id])

  const sessionUserId = session?.user?.id

  const contextValue = useMemo<AnalyticsContextType>(() => ({
    trackEvent: GA4Analytics.trackEvent,
    trackPageView: GA4Analytics.trackPageView,
    trackPurchase: GA4Analytics.trackPurchase,
    trackAddToCart: GA4Analytics.trackAddToCart,
    trackViewItem: GA4Analytics.trackViewItem,
    trackBeginCheckout: (items, value, metadata) => {
      if (!isTrackingEnabled) return
      GA4Analytics.trackBeginCheckout(items, value, metadata)
      ConversionFunnels.trackFunnelStep('ecommerce', 'begin_checkout', sessionUserId, {
        currency: 'USD',
        value,
        items,
        email: metadata?.email,
        recovery_path: metadata?.recovery_path,
      })
    },
    trackNewsletterSignup: GA4Analytics.trackNewsletterSignup,
    trackSocialShare: GA4Analytics.trackSocialShare,
    trackSearch: GA4Analytics.trackSearch,
    trackFormSubmit: GA4Analytics.trackFormSubmit,
    trackFunnelStep: ConversionFunnels.trackFunnelStep,
    trackEcommerceFunnel: ConversionFunnels.trackEcommerceFunnel,
    trackNewsletterFunnel: ConversionFunnels.trackNewsletterFunnel,
    trackPortfolioFunnel: ConversionFunnels.trackPortfolioFunnel,
    isTrackingEnabled,
  }), [isTrackingEnabled, sessionUserId])

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
  const userId = session?.user?.id

  return useMemo(() => ({
    trackProductView: (productId: string, productName: string, category: string, price: number) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackViewItem({
        item_id: productId,
        item_name: productName,
        item_category: category,
        price,
        quantity: 1,
      })
      analytics.trackEcommerceFunnel.productView(productId, userId)
    },

    trackAddToCart: (productId: string, productName: string, category: string, price: number, quantity: number = 1) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackAddToCart({
        item_id: productId,
        item_name: productName,
        item_category: category,
        price,
        quantity,
      })
      analytics.trackEcommerceFunnel.addToCart(productId, userId)
    },

    trackBeginCheckout: (items: EcommerceItem[], total: number) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackBeginCheckout(items, total)
    },

    trackPurchase: (transactionId: string, items: EcommerceItem[], total: number, shipping?: number, tax?: number) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackPurchase({
        transaction_id: transactionId,
        value: total,
        currency: 'USD',
        items,
        shipping,
        tax,
      })
      analytics.trackEcommerceFunnel.purchase(transactionId, userId)
    },
  }), [analytics, userId])
}

export function useNewsletterTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()
  const userId = session?.user?.id

  return useMemo(() => ({
    isTrackingEnabled: analytics.isTrackingEnabled,
    trackFormView: () => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackEvent('newsletter_form_view', {
        event_category: 'engagement',
      })
      analytics.trackNewsletterFunnel.formView(userId)
    },

    trackSignup: (method: string = 'form') => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackNewsletterSignup(method)
      analytics.trackNewsletterFunnel.signup(userId)
    },
  }), [analytics, userId])
}

export function usePortfolioTracking() {
  const analytics = useAnalytics()
  const { data: session } = useSession()
  const userId = session?.user?.id

  return useMemo(() => ({
    trackArtworkView: (artworkId: string, artworkTitle: string) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackEvent('artwork_view', {
        event_category: 'content',
        artwork_id: artworkId,
        artwork_title: artworkTitle,
      })
      analytics.trackPortfolioFunnel.artworkView(artworkId, userId)
    },

    trackContactFormView: () => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackEvent('contact_form_view', {
        event_category: 'engagement',
      })
      analytics.trackPortfolioFunnel.contactFormView(userId)
    },

    trackCommissionInquiry: (artworkId?: string) => {
      if (!analytics.isTrackingEnabled) return
      analytics.trackEvent('commission_inquiry', {
        event_category: 'conversion',
        artwork_id: artworkId,
      })
      analytics.trackPortfolioFunnel.commissionInquiry(userId)
    },
  }), [analytics, userId])
}