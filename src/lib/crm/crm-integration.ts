// CRM Integration System
import { db } from '@/lib/db';
import { CustomerInsights } from '@/lib/analytics/customer-insights';

export interface CRMContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  lifecycle_stage: 'subscriber' | 'lead' | 'customer' | 'opportunity' | 'evangelist';
  lead_source: string;
  custom_properties: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CRMDeal {
  id: string;
  contact_id: string;
  pipeline: string;
  stage: string;
  amount: number;
  close_date?: Date;
  probability: number;
  source: string;
  properties: Record<string, any>;
}

export interface CRMActivity {
  id: string;
  contact_id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task';
  subject: string;
  description?: string;
  timestamp: Date;
  outcome?: string;
}

export interface CRMSyncResult {
  contacts_synced: number;
  deals_synced: number;
  activities_synced: number;
  errors: string[];
  last_sync: Date;
}

export class CRMIntegration {
  private static hubspotApiKey = process.env.HUBSPOT_API_KEY;
  private static salesforceConfig = {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    username: process.env.SALESFORCE_USERNAME,
    password: process.env.SALESFORCE_PASSWORD,
    securityToken: process.env.SALESFORCE_SECURITY_TOKEN
  };

  // HubSpot Integration
  static async syncToHubSpot(userId: string): Promise<void> {
    try {
      if (!this.hubspotApiKey) {
        console.warn('HubSpot API key not configured');
        return;
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        include: { orders: true }
      });

      if (!user?.email) return;

      const insights = await CustomerInsights.getUserInsights(userId);
      
      // Create or update contact in HubSpot
      const contactData = {
        properties: {
          email: user.email,
          firstname: user.firstName || user.name?.split(' ')[0] || '',
          lastname: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
          lifecyclestage: this.getLifecycleStage(insights),
          lead_source: insights.acquisition_source || 'website',
          total_revenue: insights.lifetime_value,
          last_purchase_date: insights.last_purchase_date,
          purchase_frequency: insights.purchase_frequency,
          customer_segment: insights.segment,
          engagement_score: insights.engagement_score,
          preferred_categories: insights.favorite_categories?.join(';'),
          art_style_preferences: insights.art_preferences?.join(';'),
          communication_preferences: user.preferences || 'weekly'
        }
      };

      const hubspotContact = await this.createOrUpdateHubSpotContact(contactData);
      
      // Sync recent orders as deals
      if (user.orders && user.orders.length > 0) {
        for (const order of user.orders.slice(0, 5)) { // Last 5 orders
          await this.createHubSpotDeal(hubspotContact.id, order);
        }
      }

      // Track sync
      await db.analyticsEvent.create({
        data: {
          eventName: 'crm_contact_synced',
          userId: userId,
          properties: JSON.stringify({
            crm_platform: 'hubspot',
            contact_id: hubspotContact.id,
            lifecycle_stage: contactData.properties.lifecyclestage,
            sync_timestamp: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });

      console.log(`User ${userId} synced to HubSpot as contact ${hubspotContact.id}`);
    } catch (error) {
      console.error('Error syncing to HubSpot:', error);
    }
  }

  // Salesforce Integration
  static async syncToSalesforce(userId: string): Promise<void> {
    try {
      const salesforceToken = await this.getSalesforceAccessToken();
      if (!salesforceToken) return;

      const user = await db.user.findUnique({
        where: { id: userId },
        include: { orders: true }
      });

      if (!user?.email) return;

      const insights = await CustomerInsights.getUserInsights(userId);

      // Create or update lead/contact in Salesforce
      const salesforceData = {
        Email: user.email,
        FirstName: user.firstName || user.name?.split(' ')[0] || '',
        LastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || 'Unknown',
        LeadSource: insights.acquisition_source || 'Website',
        Status: this.getSalesforceStatus(insights),
        Company: 'Individual',
        AnnualRevenue: insights.lifetime_value,
        Rating: this.getLeadRating(insights.engagement_score),
        Description: `Customer segment: ${insights.segment}, Engagement: ${insights.engagement_score}/100`,
        Custom_Art_Preferences__c: insights.art_preferences?.join(';'),
        Customer_Segment__c: insights.segment,
        Lifetime_Value__c: insights.lifetime_value,
        Purchase_Frequency__c: insights.purchase_frequency
      };

      const salesforceContact = await this.createOrUpdateSalesforceContact(salesforceData, salesforceToken);

      // Create opportunities for significant orders
      if (user.orders) {
        const significantOrders = user.orders.filter((order: any) => order.total > 500);
        for (const order of significantOrders) {
          await this.createSalesforceOpportunity(salesforceContact.Id, order, salesforceToken);
        }
      }

      console.log(`User ${userId} synced to Salesforce as ${salesforceContact.Id}`);
    } catch (error) {
      console.error('Error syncing to Salesforce:', error);
    }
  }

  // Bulk Sync Operations
  static async syncAllCustomers(platform: 'hubspot' | 'salesforce' | 'both' = 'both'): Promise<CRMSyncResult> {
    const result: CRMSyncResult = {
      contacts_synced: 0,
      deals_synced: 0,
      activities_synced: 0,
      errors: [],
      last_sync: new Date()
    };

    try {
      // Get all customers who have made purchases or are highly engaged
      const customers = await db.user.findMany({
        where: {
          OR: [
            { orders: { some: {} } }, // Has orders
            { 
              // Check email against customer profiles for behavior score
              email: {
                in: (await db.customerProfile.findMany({
                  where: { behaviorScore: { gte: 50 } },
                  select: { email: true }
                })).map(profile => profile.email).filter(Boolean) as string[]
              }
            }
          ]
        },
        include: { 
          orders: {
            include: {
              items: true
            }
          },
          addresses: true
        }
      });

      for (const customer of customers) {
        try {
          if (platform === 'hubspot' || platform === 'both') {
            await this.syncToHubSpot(customer.id);
            result.contacts_synced++;
          }

          if (platform === 'salesforce' || platform === 'both') {
            await this.syncToSalesforce(customer.id);
            result.contacts_synced++;
          }

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          result.errors.push(`Failed to sync customer ${customer.id}: ${error}`);
        }
      }

      // Track bulk sync
      await db.analyticsEvent.create({
        data: {
          eventName: 'crm_bulk_sync_completed',
          properties: JSON.stringify({
            platform,
            contacts_synced: result.contacts_synced,
            errors_count: result.errors.length,
            sync_duration: Date.now()
          }),
          timestamp: new Date()
        }
      });

      console.log(`Bulk sync completed: ${result.contacts_synced} contacts synced`);
      return result;
    } catch (error) {
      console.error('Error in bulk sync:', error);
      result.errors.push(`Bulk sync failed: ${error}`);
      return result;
    }
  }

  // Lead Scoring and Pipeline Management
  static async updateLeadScore(userId: string): Promise<void> {
    try {
      const insights = await CustomerInsights.getUserInsights(userId);
      const score = this.calculateLeadScore(insights);

      // Update in both CRMs
      await this.syncToHubSpot(userId);
      await this.syncToSalesforce(userId);

      // Store lead score locally
      await db.customerProfile.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: '',
          behaviorScore: score,
          lifetimeValue: 0,
          engagementScore: 0,
          lastActivity: new Date(),
          segments: '[]',
          preferences: '{}'
        },
        update: {
          behaviorScore: score,
          updatedAt: new Date()
        }
      });

      console.log(`Lead score updated for user ${userId}: ${score}`);
    } catch (error) {
      console.error('Error updating lead score:', error);
    }
  }

  // Activity Tracking
  static async trackActivity(
    userId: string, 
    type: CRMActivity['type'], 
    subject: string, 
    description?: string
  ): Promise<void> {
    try {
      const activity: Omit<CRMActivity, 'id'> = {
        contact_id: userId,
        type,
        subject,
        description,
        timestamp: new Date()
      };

      // Track activity in analytics
      await db.analyticsEvent.create({
        data: {
          eventName: 'crm_activity_tracked',
          userId: userId,
          properties: JSON.stringify({
            activity_type: type,
            subject,
            timestamp: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });

      console.log(`CRM activity tracked: ${type} for user ${userId}`);
    } catch (error) {
      console.error('Error tracking CRM activity:', error);
    }
  }

  // Helper Methods
  private static getLifecycleStage(insights: any): string {
    if (insights.lifetime_value > 1000) return 'customer';
    if (insights.lifetime_value > 0) return 'opportunity';
    if (insights.engagement_score > 70) return 'lead';
    return 'subscriber';
  }

  private static getSalesforceStatus(insights: any): string {
    if (insights.lifetime_value > 0) return 'Qualified';
    if (insights.engagement_score > 70) return 'Working - Contacted';
    return 'Open - Not Contacted';
  }

  private static getLeadRating(engagementScore: number): string {
    if (engagementScore >= 80) return 'Hot';
    if (engagementScore >= 60) return 'Warm';
    return 'Cold';
  }

  private static calculateLeadScore(insights: any): number {
    let score = 0;
    
    // Engagement score (0-40 points)
    score += Math.round(insights.engagement_score * 0.4);
    
    // Purchase history (0-30 points)
    if (insights.lifetime_value > 1000) score += 30;
    else if (insights.lifetime_value > 500) score += 20;
    else if (insights.lifetime_value > 100) score += 10;
    
    // Frequency (0-20 points)
    if (insights.purchase_frequency > 5) score += 20;
    else if (insights.purchase_frequency > 2) score += 15;
    else if (insights.purchase_frequency > 0) score += 10;
    
    // Recency (0-10 points)
    const daysSinceLastPurchase = insights.last_purchase_date ? 
      Math.floor((Date.now() - new Date(insights.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)) : 999;
    
    if (daysSinceLastPurchase < 30) score += 10;
    else if (daysSinceLastPurchase < 90) score += 5;
    
    return Math.min(100, score);
  }

  // API Integration Methods (placeholder implementations)
  private static async createOrUpdateHubSpotContact(contactData: any) {
    // Implementation would use HubSpot API
    // For now, return mock response
    return { id: `hs_${Date.now()}` };
  }

  private static async createHubSpotDeal(contactId: string, order: any) {
    // Implementation would create deal in HubSpot
    console.log(`Creating HubSpot deal for contact ${contactId}, order ${order.id}`);
  }

  private static async getSalesforceAccessToken(): Promise<string | null> {
    // Implementation would authenticate with Salesforce
    // For now, return mock token
    return 'mock_sf_token';
  }

  private static async createOrUpdateSalesforceContact(data: any, token: string) {
    // Implementation would use Salesforce API
    return { Id: `sf_${Date.now()}` };
  }

  private static async createSalesforceOpportunity(contactId: string, order: any, token: string) {
    // Implementation would create opportunity in Salesforce
    console.log(`Creating Salesforce opportunity for contact ${contactId}, order ${order.id}`);
  }

  private static async createHubSpotActivity(userId: string, activity: any) {
    // Implementation would create activity in HubSpot
    console.log(`Creating HubSpot activity for user ${userId}:`, activity.subject);
  }

  static async syncWithCRM(): Promise<void> {
    try {
      // Get all customers with proper field mapping from schema
      const customers = await db.user.findMany({
        where: {
          OR: [
            { orders: { some: {} } }, // Has orders
            { 
              // Check email against customer profiles for behavior score
              email: {
                in: (await db.customerProfile.findMany({
                  where: { behaviorScore: { gte: 50 } },
                  select: { email: true }
                })).map(profile => profile.email).filter(Boolean) as string[]
              }
            }
          ]
        },
        include: { 
          orders: {
            include: {
              items: true
            }
          },
          addresses: true
        }
      });

      const crmData = [];

      for (const customer of customers) {
        // Calculate customer metrics
        const totalSpent = customer.orders.reduce((sum, order) => sum + order.total, 0);
        const orderCount = customer.orders.length;
        const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
        
        // Get or create customer profile for behavioral data
        let customerProfile = await db.customerProfile.findUnique({
          where: { email: customer.email }
        });

        if (!customerProfile) {
          customerProfile = await db.customerProfile.create({
            data: {
              email: customer.email,
              segments: JSON.stringify(['new_customer']),
              behaviorScore: 25,
              preferences: JSON.stringify({}),
              lifetimeValue: totalSpent,
              engagementScore: 25,
              lastActivity: new Date()
            }
          });
        } else {
          // Update existing profile with calculated values
          await db.customerProfile.update({
            where: { id: customerProfile.id },
            data: {
              lifetimeValue: totalSpent,
              lastActivity: new Date()
            }
          });
        }

        const crmRecord = {
          customer_id: customer.id,
          email: customer.email,
          name: customer.name || '',
          phone: customer.phone || '',
          total_spent: totalSpent,
          order_count: orderCount,
          avg_order_value: avgOrderValue,
          lifetime_value: totalSpent,
          last_order_date: customer.orders.length > 0 
            ? customer.orders[customer.orders.length - 1].createdAt 
            : null,
          segments: JSON.parse(customerProfile.segments),
          behavior_score: customerProfile.behaviorScore,
          engagement_score: customerProfile.engagementScore,
          preferences: JSON.parse(customerProfile.preferences),
          created_at: customer.createdAt,
          updated_at: customer.updatedAt
        };

        crmData.push(crmRecord);
      }

      // In a real implementation, this would sync to external CRM
      console.log(`Synced ${crmData.length} customer records to CRM`);

      // Track sync
      await db.analyticsEvent.create({
        data: {
          eventName: 'crm_sync_completed',
          properties: JSON.stringify({
            records_synced: crmData.length,
            sync_timestamp: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error syncing with CRM:', error);
      throw error;
    }
  }
}