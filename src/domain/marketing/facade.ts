import { GA4Analytics } from './services/ga4'
import { ConversionFunnels } from './services/funnels'
import { EmailSequences } from './services/email'
import { CRMIntegration } from './services/crm'
import { SocialMediaAutomation } from './services/social'
import { AdPlatformIntegration } from './services/ads'
import { CustomerInsights } from './services/customer-insights'
export const Marketing = {
  analytics: {
    initialize: GA4Analytics.initialize,
    trackPageView: GA4Analytics.trackPageView,
    trackEvent: GA4Analytics.trackEvent,
    trackPurchase: GA4Analytics.trackPurchase,
    trackAddToCart: GA4Analytics.trackAddToCart,
    trackBeginCheckout: GA4Analytics.trackBeginCheckout,
    trackViewItem: GA4Analytics.trackViewItem,
    setUserProperties: GA4Analytics.setUserProperties,
    trackNewsletterSignup: GA4Analytics.trackNewsletterSignup,
    trackSocialShare: GA4Analytics.trackSocialShare,
    trackSearch: GA4Analytics.trackSearch,
    trackDownload: GA4Analytics.trackDownload,
    trackVideo: GA4Analytics.trackVideo,
    trackFormSubmit: GA4Analytics.trackFormSubmit,
  },
  funnels: {
    initialize: ConversionFunnels.initialize,
    trackFunnelStep: ConversionFunnels.trackFunnelStep,
    // Back-compat aliases
    trackEcommerceFunnel: ConversionFunnels.trackEcommerceFunnel,
    trackNewsletterFunnel: ConversionFunnels.trackNewsletterFunnel,
    trackPortfolioFunnel: ConversionFunnels.trackPortfolioFunnel,
    // Grouped API
    ecommerce: {
      productView: ConversionFunnels.trackEcommerceFunnel.productView,
      addToCart: ConversionFunnels.trackEcommerceFunnel.addToCart,
      beginCheckout: ConversionFunnels.trackEcommerceFunnel.beginCheckout,
      purchase: ConversionFunnels.trackEcommerceFunnel.purchase,
    },
    newsletter: {
      formView: ConversionFunnels.trackNewsletterFunnel.formView,
      signup: ConversionFunnels.trackNewsletterFunnel.signup,
    },
    portfolio: {
      portfolioView: ConversionFunnels.trackPortfolioFunnel.portfolioView,
      artworkView: ConversionFunnels.trackPortfolioFunnel.artworkView,
      contactFormView: ConversionFunnels.trackPortfolioFunnel.contactFormView,
      commissionInquiry: ConversionFunnels.trackPortfolioFunnel.commissionInquiry,
    },
  },
  email: {
    triggerWelcomeSeries: EmailSequences.triggerWelcomeSeries,
    triggerAbandonedCart: EmailSequences.triggerAbandonedCart,
    triggerPostPurchase: EmailSequences.triggerPostPurchase,
    triggerReEngagement: EmailSequences.triggerReEngagement,
    sendSegmentCampaign: EmailSequences.sendSegmentCampaign,
    createDripCampaign: EmailSequences.createDripCampaign,
    processScheduledEmails: EmailSequences.processScheduledEmails,
    getSequencePerformance: EmailSequences.getSequencePerformance,
    getCampaignPerformance: EmailSequences.getCampaignPerformance,
    getAbandonedCartUsers: EmailSequences.getAbandonedCartUsers,
    getRecentOrders: EmailSequences.getRecentOrders,
  },
  crm: {
    syncToSalesforce: CRMIntegration.syncToSalesforce,
    syncAllCustomers: CRMIntegration.syncAllCustomers,
    updateLeadScore: CRMIntegration.updateLeadScore,
    trackActivity: CRMIntegration.trackActivity,
    syncWithCRM: CRMIntegration.syncWithCRM,
  },
  social: {
    postToInstagram: SocialMediaAutomation.postToInstagram,
    postToFacebook: SocialMediaAutomation.postToFacebook,
    postToPinterest: SocialMediaAutomation.postToPinterest,
    generateProductShowcase: SocialMediaAutomation.generateProductShowcase,
    generateBehindScenesContent: SocialMediaAutomation.generateBehindScenesContent,
    generateTestimonialPost: SocialMediaAutomation.generateTestimonialPost,
    updatePostEngagement: SocialMediaAutomation.updatePostEngagement,
    scheduleWeeklyContent: SocialMediaAutomation.scheduleWeeklyContent,
  },
  ads: {
    createGoogleAdsConversionTracking: AdPlatformIntegration.createGoogleAdsConversionTracking,
    trackGoogleAdsConversion: AdPlatformIntegration.trackGoogleAdsConversion,
    setupFacebookPixel: AdPlatformIntegration.setupFacebookPixel,
    trackFacebookConversion: AdPlatformIntegration.trackFacebookConversion,
    createProductCampaign: AdPlatformIntegration.createProductCampaign,
    createRetargetingCampaign: AdPlatformIntegration.createRetargetingCampaign,
    updateCampaignPerformance: AdPlatformIntegration.updateCampaignPerformance,
    optimizeCampaignBudgets: AdPlatformIntegration.optimizeCampaignBudgets,
    trackAttributedRevenue: AdPlatformIntegration.trackAttributedRevenue,
  },
  insights: {
    getCustomerSegments: CustomerInsights.getCustomerSegments,
    getSegmentCustomers: CustomerInsights.getSegmentCustomers,
    generateRetentionCohorts: CustomerInsights.generateRetentionCohorts,
    calculateLifetimeValue: CustomerInsights.calculateLifetimeValue,
    analyzeEngagementTrends: CustomerInsights.analyzeEngagementTrends,
    updateCustomerSegmentation: CustomerInsights.updateCustomerSegmentation,
    getUserInsights: CustomerInsights.getUserInsights,
    getSegmentUsers: CustomerInsights.getSegmentUsers,
  },
}
