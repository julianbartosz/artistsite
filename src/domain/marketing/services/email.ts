// filepath: src/domain/marketing/services/email.ts
import { AnalyticsEventRepository } from '../repositories/analyticsEvent.repo'
import { EmailCampaignRepository } from '../repositories/emailCampaign.repo'
import { UserRepository } from '../repositories/user.repo'
import { OrderRepository } from '../repositories/order.repo'
import { PromoCodeRepository } from '../repositories/promoCode.repo'
import { CustomerInsights } from './customer-insights'

export interface EmailMetrics {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  bounced: number
  unsubscribed: number
  open_rate: number
  click_rate: number
  conversion_rate: number
}

const analyticsRepo = new AnalyticsEventRepository()
const emailRepo = new EmailCampaignRepository()
const userRepo = new UserRepository()
const orderRepo = new OrderRepository()
const promoRepo = new PromoCodeRepository()

export class EmailSequences {
  static async triggerWelcomeSeries(userId: string): Promise<void> {
    const user = await userRepo.findByIdBasic(userId)
    if (!user?.email) return
    await analyticsRepo.create('email_sequence_enrolled', {
      userId,
      properties: {
        sequence_name: 'welcome_series',
        user_email: user.email,
        enrollment_date: new Date().toISOString(),
      },
    })
  }
  static async triggerAbandonedCart(userId: string): Promise<void> {
    const user = await userRepo.findByIdBasic(userId)
    if (!user?.email) return
    const cartValue = Math.random() * 200 + 50
    await this.sendEmail(userId, {
      subject: `Don't forget your ${cartValue > 100 ? 'amazing' : 'beautiful'} art selection!`,
      htmlContent: 'Cart abandonment email content',
      textContent: 'Cart abandonment email content',
    })
    await analyticsRepo.create('cart_abandoned', {
      userId,
      properties: {
        cart_value: cartValue,
        abandonment_time: new Date().toISOString(),
      },
    })
  }
  static async triggerPostPurchase(orderId: string): Promise<void> {
    const order = await orderRepo.findByIdWithUserAndItems(orderId)
    if (!order?.user?.email) return
    await this.sendEmail(order.user.id, {
      subject: `Thank you for your order #${order.orderNumber}!`,
      htmlContent: 'Post-purchase email content',
      textContent: 'Post-purchase email content',
    })
    await analyticsRepo.create('post_purchase_sequence_triggered', {
      userId: order.user.id,
      properties: {
        order_id: orderId,
        order_value: order.total,
        items_count: order.items.length,
      },
    })
  }
  static async triggerReEngagement(segment: string): Promise<void> {
    const inactiveUsers = await CustomerInsights.getSegmentUsers(segment)
    for (const user of inactiveUsers) {
      const personalized = await this.generatePersonalizedContent(user)
      await this.sendEmail(user.id, {
        subject: personalized.personalizedSubject,
        htmlContent: 'Re-engagement email content',
        textContent: 'Re-engagement email content',
      })
      await analyticsRepo.create('re_engagement_email_sent', {
        userId: user.id,
        properties: {
          segment,
          last_activity: user.lastActivity,
          personalization_score: personalized.score,
        },
      })
    }
  }
  private static async sendEmail(userId: string, content: { subject: string; htmlContent: string; textContent: string }) {
    const user = await userRepo.findByIdBasic(userId)
    if (!user?.email) return
    // Integrate with ESP here. For now, log and record event.
    // eslint-disable-next-line no-console
    console.log(`Sending email to ${user.email}:`, { subject: content.subject })
    await analyticsRepo.create('email_sent', {
      userId,
      properties: {
        email: user.email,
        subject: content.subject,
        sent_at: new Date().toISOString(),
      },
    })
  }
  private static async generateDiscountCode(prefix: string, percentage: number): Promise<string> {
    const code = `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    await promoRepo.create({
      code,
      discountType: 'percentage',
      discountValue: percentage,
      usageLimit: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    return code
  }
  private static async generatePersonalizedContent(user: any) {
    let insights: any
    try {
      insights = await CustomerInsights.getUserInsights(user.id)
    } catch {
      insights = { favorite_categories: [], purchase_history: [], last_purchase_date: null, loyalty_tier: 'new' }
    }
    let score = 0
    let recommendations: any[] = []
    let personalizedSubject = 'We miss you!'
    if (insights.favorite_categories?.length > 0) {
      try {
        recommendations = await this.getRecommendationsForCategories(insights.favorite_categories)
        personalizedSubject = `New ${insights.favorite_categories[0]} arrivals just for you!`
        score += 30
      } catch {
        // Silent
      }
    }
    if (insights.purchase_history?.length > 0) {
      const lastPurchase = insights.purchase_history[0]
      personalizedSubject = `More like your ${lastPurchase.product_name}?`
      score += 20
    }
    return { user_name: user.name || 'Valued Customer', personalizedSubject, recommendations, last_purchase_date: insights.last_purchase_date, loyalty_status: insights.loyalty_tier, score }
  }
  private static async getRecommendationsForCategories(categories: string[]) {
    return categories.map((category, index) => ({
      id: `rec_${index}`,
      name: `${category} Artwork ${index + 1}`,
      category,
      price: Math.floor(Math.random() * 500) + 100,
      image: `/images/portfolio/artwork-${index + 1}.jpg`,
    }))
  }
  static async getSequencePerformance(sequenceId: string): Promise<EmailMetrics> {
    const sentEvents = await analyticsRepo.findManyByEventAndPropsContains(['email_sent'], `"sequence_id":"${sequenceId}"`)
    const openedEvents = await analyticsRepo.findManyByEventAndPropsContains(['email_opened'], `"sequence_id":"${sequenceId}"`)
    const clickedEvents = await analyticsRepo.findManyByEventAndPropsContains(['email_clicked'], `"sequence_id":"${sequenceId}"`)
    const convertedEvents = await analyticsRepo.findManyByEventAndPropsContains(['email_converted'], `"sequence_id":"${sequenceId}"`)
    const sent = sentEvents.length
    const opened = openedEvents.length
    const clicked = clickedEvents.length
    const converted = convertedEvents.length
    return {
      sent,
      delivered: sent,
      opened,
      clicked,
      converted,
      bounced: 0,
      unsubscribed: 0,
      open_rate: sent > 0 ? (opened / sent) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
      conversion_rate: sent > 0 ? (converted / sent) * 100 : 0,
    }
  }
  static async getCampaignPerformance(campaignId: string): Promise<EmailMetrics> {
    const sentEvents = await analyticsRepo.findManyByEventAndPropsContains('email_sent', `"campaign_id":"${campaignId}"`)
    const openedEvents = await analyticsRepo.findManyByEventAndPropsContains('email_opened', `"campaign_id":"${campaignId}"`)
    const clickedEvents = await analyticsRepo.findManyByEventAndPropsContains('email_clicked', `"campaign_id":"${campaignId}"`)
    const convertedEvents = await analyticsRepo.findManyByEventAndPropsContains('email_converted', `"campaign_id":"${campaignId}"`)
    const sent = sentEvents.length
    const opened = openedEvents.length
    const clicked = clickedEvents.length
    const converted = convertedEvents.length
    return {
      sent,
      delivered: sent,
      opened,
      clicked,
      converted,
      bounced: 0,
      unsubscribed: 0,
      open_rate: sent > 0 ? (opened / sent) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
      conversion_rate: sent > 0 ? (converted / sent) * 100 : 0,
    }
  }
  static async getAbandonedCartUsers(): Promise<void> {
    const abandonedUsers = await userRepo.findAbandonedCartCandidates(7, 100)
    for (const user of abandonedUsers) {
      const cartValue = Math.random() * 200 + 50
      await this.sendEmail(user.id, {
        subject: `Don't forget your ${cartValue > 100 ? 'amazing' : 'beautiful'} art selection!`,
        htmlContent: `Cart recovery email`,
        textContent: `Cart recovery email`,
      })
      await analyticsRepo.create('email_sent', {
        userId: user.id,
        properties: { campaign_type: 'cart_recovery', cart_value: cartValue, email_template: 'cart_recovery' },
      })
    }
  }
  static async getRecentOrders(): Promise<void> {
    const recentOrders = await orderRepo.findRecent(30, 50)
    for (const order of recentOrders) {
      if (!order.user?.email) continue
      const totalSpent = order.total
      const itemCount = order.items?.length || 0
      await this.sendEmail(order.user.id, {
        subject: 'New arrivals you might love',
        htmlContent: `Recommendations email`,
        textContent: `Recommendations email`,
      })
      await analyticsRepo.create('email_sent', {
        userId: order.user.id,
        properties: { campaign_type: 'personalized_recommendations', previous_order_value: totalSpent, email_template: 'recommendations' },
      })
    }
  }
  static async sendSegmentCampaign(segmentId: string, campaignData: any): Promise<void> {
    const segmentUsers = await CustomerInsights.getSegmentUsers(segmentId)
    for (const user of segmentUsers) {
      await this.sendEmail(user.id, {
        subject: campaignData.subject,
        htmlContent: campaignData.htmlContent || 'Campaign email content',
        textContent: campaignData.textContent || campaignData.subject,
      })
    }
    await analyticsRepo.create('email_campaign_sent', {
      properties: {
        campaign_id: campaignData.id,
        segment_id: segmentId,
        recipient_count: segmentUsers.length,
        campaign_type: campaignData.type,
      },
    })
  }
  static async createDripCampaign(campaignData: any): Promise<string> {
    const campaign = await emailRepo.createDraft({
      name: campaignData.name,
      type: campaignData.type,
      templateId: campaignData.templateId || '',
      segments: campaignData.segments || [],
    })
    return campaign.id
  }
  static async processScheduledEmails(): Promise<void> {
    const activeCampaigns = await emailRepo.findActiveCampaigns()
    for (const campaign of activeCampaigns) {
      const segments = typeof (campaign as any).segments === 'string' ? JSON.parse((campaign as any).segments) : (campaign as any).segments
      if (!segments?.length) continue
      const segmentUsers = await CustomerInsights.getSegmentUsers(segments[0])
      for (const user of segmentUsers) {
        await this.sendEmail(user.id, {
          subject: (campaign as any).name,
          htmlContent: `Campaign email: ${(campaign as any).name}`,
          textContent: `Campaign email: ${(campaign as any).name}`,
        })
      }
      await emailRepo.updateStatus(campaign.id, 'completed')
      await analyticsRepo.create('email_campaign_sent', {
        properties: {
          campaign_id: campaign.id,
          segment_id: segments[0],
          recipient_count: segmentUsers.length,
          campaign_type: (campaign as any).type,
        },
      })
    }
  }
}
