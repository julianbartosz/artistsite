// filepath: src/domain/marketing/services/crm.ts
import { AnalyticsEventRepository } from '../repositories/analyticsEvent.repo'
import { UserRepository } from '../repositories/user.repo'
import { OrderRepository } from '../repositories/order.repo'
import { CustomerInsights } from './customer-insights'
import { SalesforceClient } from '@domain/marketing/services/crmClients/salesforce'

export interface CRMContact {
  id?: string
  email: string
  firstName?: string
  lastName?: string
}

export interface CRMDeal {
  id?: string
  amount: number
  currency: string
  closedAt?: Date | null
}

export interface CRMActivity {
  type: 'call' | 'email' | 'meeting' | 'note'
  subject: string
  description?: string
}

export interface CRMSyncResult {
  platform: 'salesforce'
  contactsSynced: number
  dealsSynced: number
}

const analyticsRepo = new AnalyticsEventRepository()
const userRepo = new UserRepository()
const orderRepo = new OrderRepository()

export class CRMIntegration {
  static async syncToSalesforce(userId: string): Promise<void> {
    try {
      const user = await userRepo.findByIdBasic(userId)
      if (!user?.email) return
      const insights = await CustomerInsights.getUserInsights(userId)

      const sf = new SalesforceClient({
        clientId: process.env.SALESFORCE_CLIENT_ID || '',
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
        username: process.env.SALESFORCE_USERNAME || '',
        password: process.env.SALESFORCE_PASSWORD || '',
        securityToken: process.env.SALESFORCE_SECURITY_TOKEN || '',
      })
      const token = await sf.getAccessToken()
      if (!token) return

      const contact = await sf.upsertContactByEmail(token, {
        Email: user.email,
        FirstName: user.name?.split(' ')[0] || '',
        LastName: user.name?.split(' ').slice(1).join(' ') || 'Unknown',
        LeadSource: insights.acquisition_source || 'Website',
        Status: this.getSalesforceStatus(insights),
        Rating: this.getLeadRating(insights.engagement_score),
        Lifetime_Value__c: insights.lifetime_value,
        Purchase_Frequency__c: insights.purchase_frequency,
      })

      await analyticsRepo.create('crm_contact_synced', {
        userId,
        properties: { crm_platform: 'salesforce', contact_id: contact.Id },
      })
    } catch (error) {
      console.error('Salesforce sync failed:', error)
    }
  }

  static async syncAllCustomers(platform: 'salesforce' = 'salesforce'): Promise<CRMSyncResult> {
    const recentOrders = await orderRepo.findRecent(90, 200)
    const userIds = Array.from(new Set(recentOrders.map(o => (o as any).user?.id).filter(Boolean))) as string[]

    let contactsSynced = 0
    for (const userId of userIds) {
      await this.syncToSalesforce(userId)
      contactsSynced++
    }

    return { platform, contactsSynced, dealsSynced: 0 }
  }

  static async updateLeadScore(userId: string): Promise<void> {
    const insights = await CustomerInsights.getUserInsights(userId)
    const score = this.calculateLeadScore(insights)
    await analyticsRepo.create('crm_lead_score_updated', {
      userId,
      properties: { score },
    })
  }

  static async trackActivity(userId: string, type: CRMActivity['type'], subject: string, description?: string): Promise<void> {
    await analyticsRepo.create('crm_activity_tracked', {
      userId,
      properties: { type, subject, description },
    })
  }

  static async syncWithCRM(): Promise<void> {
    await analyticsRepo.create('crm_sync_started')
    await this.syncAllCustomers('salesforce')
    await analyticsRepo.create('crm_sync_completed')
  }

  private static getSalesforceStatus(insights: any): string {
    if (insights.lifetime_value > 0) return 'Qualified'
    if (insights.engagement_score > 70) return 'Working - Contacted'
    return 'Open - Not Contacted'
  }

  private static getLeadRating(engagementScore: number): string {
    if (engagementScore >= 80) return 'Hot'
    if (engagementScore >= 60) return 'Warm'
    return 'Cold'
  }

  private static calculateLeadScore(insights: any): number {
    let score = 0
    score += Math.round((insights.engagement_score || 0) * 0.4)
    if (insights.lifetime_value > 1000) score += 30
    else if (insights.lifetime_value > 500) score += 20
    else if (insights.lifetime_value > 100) score += 10
    if ((insights.purchase_frequency || 0) > 5) score += 20
    else if ((insights.purchase_frequency || 0) > 2) score += 15
    else if ((insights.purchase_frequency || 0) > 0) score += 10
    return Math.min(100, score)
  }
}
