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

      // Track enrollment using proper AnalyticsEvent model
      await db.analyticsEvent.create({
        data: {
          eventName: 'email_sequence_enrolled',
          userId: userId,
          properties: JSON.stringify({
            sequence_name: 'welcome_series',
            user_email: user.email,
            enrollment_date: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });

      console.log(`Welcome series triggered for user ${userId}`);
    } catch (error) {
      console.error('Error triggering welcome series:', error);
    }
  }

  // Cart Abandonment Sequence - Updated to work without cart model
  static async triggerAbandonedCart(userId: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId }
      });
      
      if (!user?.email) return;

      // Mock abandoned cart logic since cart model doesn't exist yet
      // In a real implementation, this would check actual cart abandonment
      const cartValue = Math.random() * 200 + 50; // Mock cart value

      const emailData = {
        user_name: user.name || 'Valued Customer',
        cart_items: [], // Would be populated with actual cart items
        cart_value: cartValue,
        cart_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
        discount_code: await this.generateDiscountCode('COMEBACK10', 10)
      };

      // Send cart abandonment email
      await this.sendEmail(userId, {
        subject: `Don't forget your ${cartValue > 100 ? 'amazing' : 'beautiful'} art selection!`,
        htmlContent: 'Cart abandonment email content',
        textContent: 'Cart abandonment email content'
      });

      // Track abandonment using proper AnalyticsEvent model
      await db.analyticsEvent.create({
        data: {
          eventName: 'cart_abandoned',
          userId: userId,
          properties: JSON.stringify({
            cart_value: cartValue,
            abandonment_time: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });

      console.log(`Cart abandonment sequence triggered for user ${userId}`);
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
          items: true
        }
      });
      
      if (!order?.user?.email) return;

      const emailData = {
        user_name: order.user.name || 'Valued Customer',
        order_number: order.orderNumber,
        order_total: order.total,
        items: order.items.map(item => ({
          name: item.productTitle,
          price: item.unitPrice,
          quantity: item.quantity
        })),
        tracking_url: `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.id}`,
        support_email: process.env.SUPPORT_EMAIL || 'support@artistsite.com'
      };

      // Send post-purchase email
      await this.sendEmail(order.user.id, {
        subject: `Thank you for your order #${order.orderNumber}!`,
        htmlContent: 'Post-purchase email content',
        textContent: 'Post-purchase email content'
      });

      // Track post-purchase engagement using proper AnalyticsEvent model
      await db.analyticsEvent.create({
        data: {
          eventName: 'post_purchase_sequence_triggered',
          userId: order.user.id,
          properties: JSON.stringify({
            order_id: orderId,
            order_value: order.total,
            items_count: order.items.length
          }),
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
      const inactiveUsers = await CustomerInsights.getSegmentUsers(segment);

      for (const user of inactiveUsers) {
        const personalizedContent = await this.generatePersonalizedContent(user);
        
        await this.sendEmail(user.id, {
          subject: personalizedContent.personalizedSubject,
          htmlContent: 'Re-engagement email content',
          textContent: 'Re-engagement email content'
        });

        // Track re-engagement attempt using proper AnalyticsEvent model
        await db.analyticsEvent.create({
          data: {
            eventName: 're_engagement_email_sent',
            userId: user.id,
            properties: JSON.stringify({
              segment,
              last_activity: user.lastActivity,
              personalization_score: personalizedContent.score
            }),
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
    return await db.emailCampaign.findFirst({
      where: { name, type: 'sequence' }
    });
  }

  private static async getCampaign(name: string) {
    return await db.emailCampaign.findFirst({
      where: { name, type: 'broadcast' }
    });
  }

  private static async enrollUserInSequence(userId: string, sequenceId: string) {
    // Track enrollment using analytics events since enrollment model doesn't exist
    await db.analyticsEvent.create({
      data: {
        eventName: 'email_sequence_enrollment',
        userId: userId,
        properties: JSON.stringify({
          sequence_id: sequenceId,
          current_step: 1,
          enrolled_at: new Date().toISOString(),
          status: 'active'
        }),
        timestamp: new Date()
      }
    });
  }

  private static async sendSequenceEmail(
    userId: string, 
    sequenceId: string, 
    stepNumber: number, 
    data: any
  ) {
    // Since sequence step model doesn't exist, simulate sequence logic
    const campaign = await db.emailCampaign.findUnique({
      where: { id: sequenceId }
    });

    if (!campaign) return;

    // Render template with data
    const renderedContent = {
      subject: `Step ${stepNumber}: ${campaign.name}`,
      htmlContent: `Email content for step ${stepNumber}`,
      textContent: `Email content for step ${stepNumber}`
    };

    // Send email
    await this.sendEmail(userId, renderedContent);

    // Track step completion
    await db.analyticsEvent.create({
      data: {
        eventName: 'email_sequence_step_sent',
        userId: userId,
        properties: JSON.stringify({
          sequence_id: sequenceId,
          step_number: stepNumber,
          last_sent_at: new Date().toISOString()
        }),
        timestamp: new Date()
      }
    });
  }

  private static async sendCampaignEmail(userId: string, campaignId: string, content: any) {
    const campaign = await db.emailCampaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) return;

    const renderedContent = {
      subject: campaign.name,
      htmlContent: 'Campaign email content',
      textContent: 'Campaign email content'
    };
    
    await this.sendEmail(userId, renderedContent);
  }

  private static async renderTemplate(template: any, data: any) {
    // Simple template rendering - replace variables
    let htmlContent = template.htmlContent || 'Default email content';
    let textContent = template.textContent || 'Default email content';
    let subject = template.subject || 'Email from Artist Site';

    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = String(data[key] || '');
        htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
        textContent = textContent.replace(new RegExp(placeholder, 'g'), value);
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    return { htmlContent, textContent, subject };
  }

  private static async sendEmail(userId: string, content: any) {
    // Get user email
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user?.email) return;

    // Integration with email service (SendGrid, Mailgun, etc.)
    // For now, just log the email
    console.log(`Sending email to ${user.email}:`, {
      subject: content.subject,
      preview: content.textContent ? content.textContent.substring(0, 100) + '...' : 'No content'
    });

    // Track email sent
    await db.analyticsEvent.create({
      data: {
        eventName: 'email_sent',
        userId: userId,
        properties: JSON.stringify({
          email: user.email,
          subject: content.subject,
          sent_at: new Date().toISOString()
        }),
        timestamp: new Date()
      }
    });
  }

  private static async generateDiscountCode(prefix: string, percentage: number): Promise<string> {
    const code = `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Create promo code using proper schema fields
    await db.promoCode.create({
      data: {
        code,
        discountType: 'percentage',
        discountValue: percentage,
        usageLimit: 1,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      }
    });

    return code;
  }

  private static async generatePersonalizedContent(user: any) {
    // AI-powered content personalization
    let insights;
    
    try {
      insights = await CustomerInsights.getUserInsights(user.id);
    } catch (error) {
      // Fallback if insights not available
      insights = {
        favorite_categories: [],
        purchase_history: [],
        last_purchase_date: null,
        loyalty_tier: 'new'
      };
    }
    
    let score = 0;
    let recommendations: any[] = [];
    let personalizedSubject = 'We miss you!';

    if (insights.favorite_categories?.length > 0) {
      try {
        recommendations = await this.getRecommendationsForCategories(
          insights.favorite_categories
        );
        personalizedSubject = `New ${insights.favorite_categories[0]} arrivals just for you!`;
        score += 30;
      } catch (error) {
        console.warn('Could not get recommendations:', error);
      }
    }

    if (insights.purchase_history?.length > 0) {
      const lastPurchase = insights.purchase_history[0];
      personalizedSubject = `More like your ${lastPurchase.product_name}?`;
      score += 20;
    }

    return {
      user_name: user.name || 'Valued Customer',
      personalizedSubject,
      recommendations,
      last_purchase_date: insights.last_purchase_date,
      loyalty_status: insights.loyalty_tier,
      score
    };
  }

  private static async getRecommendationsForCategories(categories: string[]) {
    // Since product model doesn't exist in the schema, mock the recommendations
    // In a real implementation, this would query actual products
    try {
      // Mock product recommendations based on categories
      return categories.map((category, index) => ({
        id: `rec_${index}`,
        name: `${category} Artwork ${index + 1}`,
        category: category,
        price: Math.floor(Math.random() * 500) + 100,
        image: `/images/portfolio/artwork-${index + 1}.jpg`
      }));
    } catch (error) {
      console.warn('Could not generate product recommendations:', error);
      return [];
    }
  }

  // Analytics and Performance - fix JSON path queries
  static async getSequencePerformance(sequenceId: string): Promise<EmailMetrics> {
    // Get enrollment events
    const enrollmentEvents = await db.analyticsEvent.findMany({
      where: {
        eventName: 'email_sequence_enrollment',
        properties: {
          contains: `"sequence_id":"${sequenceId}"`
        }
      }
    });

    const emailEvents = await db.analyticsEvent.findMany({
      where: {
        eventName: { in: ['email_sent', 'email_opened', 'email_clicked', 'email_converted'] },
        properties: {
          contains: `"sequence_id":"${sequenceId}"`
        }
      }
    });

    const sent = emailEvents.filter(e => e.eventName === 'email_sent').length;
    const opened = emailEvents.filter(e => e.eventName === 'email_opened').length;
    const clicked = emailEvents.filter(e => e.eventName === 'email_clicked').length;
    const converted = emailEvents.filter(e => e.eventName === 'email_converted').length;

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
    const events = await db.analyticsEvent.findMany({
      where: {
        eventName: { in: ['email_sent', 'email_opened', 'email_clicked', 'email_converted'] },
        properties: {
          contains: `"campaign_id":"${campaignId}"`
        }
      }
    });

    const sent = events.filter(e => e.eventName === 'email_sent').length;
    const opened = events.filter(e => e.eventName === 'email_opened').length;
    const clicked = events.filter(e => e.eventName === 'email_clicked').length;
    const converted = events.filter(e => e.eventName === 'email_converted').length;

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

  // Get abandoned cart users (updated to use internal email sending)
  static async getAbandonedCartUsers(): Promise<void> {
    const abandonedUsers = await db.user.findMany({
      where: {
        // Mock abandoned cart logic - users who haven't purchased recently
        orders: {
          none: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }
      },
      take: 100
    });

    for (const user of abandonedUsers) {
      // Calculate abandoned cart value (mock calculation)
      const cartValue = Math.random() * 200 + 50; // Mock cart value

      // Send personalized recovery email using internal method
      await this.sendEmail(user.id, {
        subject: `Don't forget your ${cartValue > 100 ? 'amazing' : 'beautiful'} art selection!`,
        htmlContent: `
          <h2>Hi ${user.name || 'there'}!</h2>
          <p>You left some beautiful artwork in your cart. Don't miss out on these amazing pieces!</p>
          <p>Cart Total: $${cartValue.toFixed(2)}</p>
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/checkout?recovery=true&user=${user.id}">Complete Your Purchase</a>
        `,
        textContent: `Hi ${user.name || 'there'}! You left $${cartValue.toFixed(2)} worth of artwork in your cart. Complete your purchase at ${process.env.NEXT_PUBLIC_BASE_URL}/checkout?recovery=true&user=${user.id}`
      });

      // Track email sent
      await db.analyticsEvent.create({
        data: {
          eventName: 'email_sent',
          userId: user.id,
          properties: JSON.stringify({
            campaign_type: 'cart_recovery',
            cart_value: cartValue,
            email_template: 'cart_recovery'
          }),
          timestamp: new Date()
        }
      });
    }
  }

  // Get customers with recent orders (updated to use internal email sending)
  static async getRecentOrders(): Promise<void> {
    const recentOrders = await db.order.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        user: true,
        items: true
      },
      take: 50
    });

    for (const order of recentOrders) {
      if (!order.user?.email) continue;

      // Calculate recommendation score (mock calculation)
      const totalSpent = order.total;
      const itemCount = order.items?.length || 0;

      // Send personalized recommendations using internal method
      await this.sendEmail(order.user.id, {
        subject: 'New arrivals you might love',
        htmlContent: `
          <h2>Hi ${order.user.name || 'there'}!</h2>
          <p>Based on your recent purchase of $${totalSpent.toFixed(2)}, we think you'll love these new arrivals!</p>
          <p>Your previous order had ${itemCount} items - here are some similar pieces you might enjoy.</p>
        `,
        textContent: `Hi ${order.user.name || 'there'}! Based on your recent purchase, we have new arrivals you might love. Check them out at ${process.env.NEXT_PUBLIC_BASE_URL}/shop`
      });

      // Track email sent
      await db.analyticsEvent.create({
        data: {
          eventName: 'email_sent',
          userId: order.user.id,
          properties: JSON.stringify({
            campaign_type: 'personalized_recommendations',
            previous_order_value: totalSpent,
            email_template: 'recommendations'
          }),
          timestamp: new Date()
        }
      });
    }
  }

  static async sendSegmentCampaign(segmentId: string, campaignData: any): Promise<void> {
    try {
      const segmentUsers = await CustomerInsights.getSegmentUsers(segmentId);

      for (const user of segmentUsers) {
        // Use internal email sending method
        await this.sendEmail(user.id, {
          subject: campaignData.subject,
          htmlContent: campaignData.htmlContent || 'Campaign email content',
          textContent: campaignData.textContent || campaignData.subject
        });
      }

      // Track campaign
      await db.analyticsEvent.create({
        data: {
          eventName: 'email_campaign_sent',
          properties: JSON.stringify({
            campaign_id: campaignData.id,
            segment_id: segmentId,
            recipient_count: segmentUsers.length,
            campaign_type: campaignData.type
          }),
          timestamp: new Date()
        }
      });

      console.log(`Segment campaign sent to ${segmentUsers.length} users in segment ${segmentId}`);
    } catch (error) {
      console.error('Error sending segment campaign:', error);
    }
  }

  static async createDripCampaign(campaignData: any): Promise<string> {
    try {
      // Use proper EmailCampaign model fields from schema
      const campaign = await db.emailCampaign.create({
        data: {
          name: campaignData.name,
          type: campaignData.type,
          templateId: campaignData.templateId || '',
          segments: JSON.stringify(campaignData.segments || []),
          metrics: JSON.stringify({
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            converted: 0,
            bounced: 0,
            unsubscribed: 0,
            open_rate: 0,
            click_rate: 0,
            conversion_rate: 0
          }),
          status: 'draft',
          createdAt: new Date()
        }
      });

      return campaign.id;
    } catch (error) {
      console.error('Error creating drip campaign:', error);
      throw error;
    }
  }

  static async processScheduledEmails(): Promise<void> {
    try {
      // Since scheduledAt field doesn't exist in schema, check for campaigns that need processing
      const activeCampaigns = await db.emailCampaign.findMany({
        where: {
          status: 'active'
        }
      });

      for (const campaign of activeCampaigns) {
        // Parse segments from JSON
        const segments = typeof campaign.segments === 'string' 
          ? JSON.parse(campaign.segments) 
          : campaign.segments;

        if (segments.length === 0) continue;

        // Send campaign emails to first segment
        const segmentUsers = await CustomerInsights.getSegmentUsers(segments[0]);

        for (const user of segmentUsers) {
          await this.sendEmail(user.id, {
            subject: campaign.name,
            htmlContent: `Campaign email: ${campaign.name}`,
            textContent: `Campaign email: ${campaign.name}`
          });
        }

        // Update campaign status
        await db.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: 'completed' }
        });

        // Track campaign
        await db.analyticsEvent.create({
          data: {
            eventName: 'email_campaign_sent',
            properties: JSON.stringify({
              campaign_id: campaign.id,
              segment_id: segments[0],
              recipient_count: segmentUsers.length,
              campaign_type: campaign.type
            }),
            timestamp: new Date()
          }
        });

        console.log(`Campaign ${campaign.id} sent to ${segmentUsers.length} users`);
      }
    } catch (error) {
      console.error('Error processing scheduled emails:', error);
    }
  }

  // Remove duplicate static methods that conflict with class methods
  static async createPromoCode(data: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    expiresAt: Date;
    usageLimit?: number;
  }): Promise<string> {
    const promoCode = await db.promoCode.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        expiresAt: data.expiresAt,
        usageLimit: data.usageLimit || null,
        createdAt: new Date()
      }
    });

    return promoCode.id;
  }
}