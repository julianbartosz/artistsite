// Email Marketing Automation System
import { db } from '@/lib/db';
import { CustomerInsights } from '@/lib/analytics/customer-insights';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  template_id: string;
  delay_hours: number;
  conditions?: any;
}

export interface EmailCampaign {
  id: string;
  name: string;
  type: 'sequence' | 'broadcast' | 'automated';
  template_id?: string;
  segments: string[];
  metrics: EmailMetrics;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: Date;
  scheduled_at?: Date;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  bounced: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export class EmailSequences {
  // Welcome Series
  static async triggerWelcomeSeries(userId: string): Promise<void> {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user?.email) return;

      const welcomeSequence = await this.getSequence('welcome_series');
      if (!welcomeSequence) return;

      await this.enrollUserInSequence(userId, welcomeSequence.id);
      
      // Track enrollment
      await db.analyticsEvents.create({
        data: {
          event_name: 'email_sequence_enrolled',
          user_id: userId,
          properties: {
            sequence_name: 'welcome_series',
            user_email: user.email,
            enrollment_date: new Date().toISOString()
          },
          timestamp: new Date()
        }
      });

      console.log(`Welcome series triggered for user ${userId}`);
    } catch (error) {
      console.error('Error triggering welcome series:', error);
    }
  }

  // Cart Abandonment Sequence
  static async triggerAbandonedCart(cartId: string): Promise<void> {
    try {
      // Find cart and user
      const cart = await db.cart.findUnique({
        where: { id: cartId },
        include: { user: true, items: { include: { product: true } } }
      });

      if (!cart?.user?.email) return;

      // Check if cart was abandoned (no activity for 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (cart.updated_at > oneHourAgo) return;

      const abandonmentSequence = await this.getSequence('cart_abandonment');
      if (!abandonmentSequence) return;

      // Personalize email with cart contents
      const cartValue = cart.items.reduce((sum, item) => 
        sum + (item.product.price * item.quantity), 0
      );

      const emailData = {
        user_name: cart.user.name || 'Valued Customer',
        cart_items: cart.items.map(item => ({
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          image_url: item.product.images[0]
        })),
        cart_value: cartValue,
        cart_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
        discount_code: await this.generateDiscountCode('COMEBACK10', 10)
      };

      await this.sendSequenceEmail(cart.user.id, abandonmentSequence.id, 1, emailData);

      // Track abandonment
      await db.analyticsEvents.create({
        data: {
          event_name: 'cart_abandoned',
          user_id: cart.user.id,
          properties: {
            cart_id: cartId,
            cart_value: cartValue,
            items_count: cart.items.length,
            abandonment_time: new Date().toISOString()
          },
          timestamp: new Date()
        }
      });

      console.log(`Cart abandonment sequence triggered for cart ${cartId}`);
    } catch (error) {
      console.error('Error triggering cart abandonment sequence:', error);
    }
  }

  // Post-Purchase Follow-up
  static async triggerPostPurchase(orderId: string): Promise<void> {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { 
          user: true, 
          items: { include: { product: true } } 
        }
      });

      if (!order?.user?.email) return;

      const postPurchaseSequence = await this.getSequence('post_purchase');
      if (!postPurchaseSequence) return;

      const emailData = {
        user_name: order.user.name || 'Valued Customer',
        order_number: order.id,
        order_total: order.total,
        items: order.items.map(item => ({
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        tracking_url: `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.id}`,
        support_email: process.env.SUPPORT_EMAIL || 'support@artistsite.com'
      };

      await this.sendSequenceEmail(order.user.id, postPurchaseSequence.id, 1, emailData);

      // Track post-purchase engagement
      await db.analyticsEvents.create({
        data: {
          event_name: 'post_purchase_sequence_triggered',
          user_id: order.user.id,
          properties: {
            order_id: orderId,
            order_value: order.total,
            items_count: order.items.length
          },
          timestamp: new Date()
        }
      });

      console.log(`Post-purchase sequence triggered for order ${orderId}`);
    } catch (error) {
      console.error('Error triggering post-purchase sequence:', error);
    }
  }

  // Re-engagement Campaign
  static async triggerReEngagement(segment: string): Promise<void> {
    try {
      const customerInsights = new CustomerInsights();
      const inactiveUsers = await customerInsights.getSegmentUsers(segment);

      const reEngagementCampaign = await this.getCampaign('re_engagement');
      if (!reEngagementCampaign) return;

      for (const user of inactiveUsers) {
        const personalizedContent = await this.generatePersonalizedContent(user);
        
        await this.sendCampaignEmail(
          user.id, 
          reEngagementCampaign.id, 
          personalizedContent
        );

        // Track re-engagement attempt
        await db.analyticsEvents.create({
          data: {
            event_name: 're_engagement_email_sent',
            user_id: user.id,
            properties: {
              segment,
              last_activity: user.last_activity,
              personalization_score: personalizedContent.score
            },
            timestamp: new Date()
          }
        });
      }

      console.log(`Re-engagement campaign triggered for ${inactiveUsers.length} users in segment ${segment}`);
    } catch (error) {
      console.error('Error triggering re-engagement campaign:', error);
    }
  }

  // Helper Methods
  private static async getSequence(name: string) {
    return await db.emailCampaigns.findFirst({
      where: { name, type: 'sequence' }
    });
  }

  private static async getCampaign(name: string) {
    return await db.emailCampaigns.findFirst({
      where: { name, type: 'broadcast' }
    });
  }

  private static async enrollUserInSequence(userId: string, sequenceId: string) {
    // Create enrollment record
    await db.emailSequenceEnrollments.create({
      data: {
        user_id: userId,
        sequence_id: sequenceId,
        current_step: 1,
        enrolled_at: new Date(),
        status: 'active'
      }
    });
  }

  private static async sendSequenceEmail(
    userId: string, 
    sequenceId: string, 
    stepNumber: number, 
    data: any
  ) {
    // Get sequence step and template
    const step = await db.emailSequenceSteps.findFirst({
      where: { sequence_id: sequenceId, step_number: stepNumber },
      include: { template: true }
    });

    if (!step) return;

    // Render template with data
    const renderedContent = await this.renderTemplate(step.template, data);

    // Send email (integrate with email service)
    await this.sendEmail(userId, renderedContent);

    // Update enrollment status
    await db.emailSequenceEnrollments.updateMany({
      where: { user_id: userId, sequence_id: sequenceId },
      data: { 
        current_step: stepNumber,
        last_sent_at: new Date()
      }
    });
  }

  private static async sendCampaignEmail(userId: string, campaignId: string, content: any) {
    const campaign = await db.emailCampaigns.findUnique({
      where: { id: campaignId },
      include: { template: true }
    });

    if (!campaign?.template) return;

    const renderedContent = await this.renderTemplate(campaign.template, content);
    await this.sendEmail(userId, renderedContent);
  }

  private static async renderTemplate(template: any, data: any) {
    // Simple template rendering - replace variables
    let htmlContent = template.htmlContent;
    let textContent = template.textContent;
    let subject = template.subject;

    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), data[key]);
      textContent = textContent.replace(new RegExp(placeholder, 'g'), data[key]);
      subject = subject.replace(new RegExp(placeholder, 'g'), data[key]);
    });

    return { htmlContent, textContent, subject };
  }

  private static async sendEmail(userId: string, content: any) {
    // Integration with email service (SendGrid, Mailgun, etc.)
    // For now, just log the email
    console.log(`Sending email to user ${userId}:`, {
      subject: content.subject,
      preview: content.textContent.substring(0, 100) + '...'
    });

    // Track email sent
    await db.analyticsEvents.create({
      data: {
        event_name: 'email_sent',
        user_id: userId,
        properties: {
          subject: content.subject,
          content_length: content.htmlContent.length,
          sent_at: new Date().toISOString()
        },
        timestamp: new Date()
      }
    });
  }

  private static async generateDiscountCode(prefix: string, percentage: number) {
    const code = `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Create promo code
    await db.promoCodes.create({
      data: {
        code,
        discount_type: 'percentage',
        discount_value: percentage,
        usage_limit: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        created_at: new Date()
      }
    });

    return code;
  }

  private static async generatePersonalizedContent(user: any) {
    // AI-powered content personalization
    const insights = await CustomerInsights.getUserInsights(user.id);
    
    let score = 0;
    let recommendations = [];
    let personalizedSubject = 'We miss you!';

    if (insights.favorite_categories?.length > 0) {
      recommendations = await this.getRecommendationsForCategories(
        insights.favorite_categories
      );
      personalizedSubject = `New ${insights.favorite_categories[0]} arrivals just for you!`;
      score += 30;
    }

    if (insights.purchase_history?.length > 0) {
      const lastPurchase = insights.purchase_history[0];
      personalizedSubject = `More like your ${lastPurchase.product_name}?`;
      score += 20;
    }

    return {
      user_name: user.name || 'Valued Customer',
      personalized_subject: personalizedSubject,
      recommendations,
      last_purchase_date: insights.last_purchase_date,
      loyalty_status: insights.loyalty_tier,
      score
    };
  }

  private static async getRecommendationsForCategories(categories: string[]) {
    // Get products from user's favorite categories
    return await db.product.findMany({
      where: {
        category: { in: categories },
        status: 'active'
      },
      take: 4,
      orderBy: { created_at: 'desc' }
    });
  }

  // Analytics and Performance
  static async getSequencePerformance(sequenceId: string): Promise<EmailMetrics> {
    const enrollments = await db.emailSequenceEnrollments.findMany({
      where: { sequence_id: sequenceId }
    });

    const events = await db.analyticsEvents.findMany({
      where: {
        event_name: { in: ['email_sent', 'email_opened', 'email_clicked', 'email_converted'] },
        properties: { path: ['sequence_id'], equals: sequenceId }
      }
    });

    const sent = events.filter(e => e.event_name === 'email_sent').length;
    const opened = events.filter(e => e.event_name === 'email_opened').length;
    const clicked = events.filter(e => e.event_name === 'email_clicked').length;
    const converted = events.filter(e => e.event_name === 'email_converted').length;

    return {
      sent,
      delivered: sent, // Assume all delivered for now
      opened,
      clicked,
      converted,
      bounced: 0,
      unsubscribed: 0,
      open_rate: sent > 0 ? (opened / sent) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
      conversion_rate: sent > 0 ? (converted / sent) * 100 : 0
    };
  }

  static async getCampaignPerformance(campaignId: string): Promise<EmailMetrics> {
    const events = await db.analyticsEvents.findMany({
      where: {
        event_name: { in: ['email_sent', 'email_opened', 'email_clicked', 'email_converted'] },
        properties: { path: ['campaign_id'], equals: campaignId }
      }
    });

    const sent = events.filter(e => e.event_name === 'email_sent').length;
    const opened = events.filter(e => e.event_name === 'email_opened').length;
    const clicked = events.filter(e => e.event_name === 'email_clicked').length;
    const converted = events.filter(e => e.event_name === 'email_converted').length;

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
      conversion_rate: sent > 0 ? (converted / sent) * 100 : 0
    };
  }
}