// filepath: src/domain/marketing/repositories/adCampaign.repo.ts
import { prisma } from '@/lib/db'

export class AdCampaignRepository {
  async create(data: {
    name: string
    platform: 'google_ads' | 'facebook_ads' | 'instagram_ads'
    type: string
    objective: string
    targetAudience: any
    budgetType: 'daily' | 'lifetime'
    budgetAmount: number
    bidStrategy: string
    bidAmount?: number | null
    adSets?: any[]
    creatives?: any[]
    startDate: Date
    endDate?: Date | null
    performance?: any
    status: 'draft' | 'active' | 'paused' | 'completed'
    createdBy?: string | null
    notes?: string | null
    campaignId?: string | null
  }) {
    const saved = await prisma.adCampaign.create({
      data: {
        name: data.name,
        platform: data.platform,
        campaignId: data.campaignId ?? null,
        type: data.type,
        objective: data.objective,
        targetAudience: JSON.stringify(data.targetAudience ?? {}),
        budgetType: data.budgetType,
        budgetAmount: data.budgetAmount,
        bidStrategy: data.bidStrategy,
        bidAmount: data.bidAmount ?? null,
        adSets: JSON.stringify(data.adSets ?? []),
        creatives: JSON.stringify(data.creatives ?? []),
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        performance: JSON.stringify(
          data.performance ?? {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cost: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
            roas: 0,
            revenue: 0,
          }
        ),
        status: data.status,
        createdBy: data.createdBy ?? null,
        notes: data.notes ?? null,
      },
    })
    return saved
  }
  async findById(id: string) {
    return prisma.adCampaign.findUnique({ where: { id } })
  }
  async update(id: string, data: Partial<{ performance: any; targetAudience: any; status: 'draft' | 'active' | 'paused' | 'completed' }>) {
    return prisma.adCampaign.update({
      where: { id },
      data: {
        ...(data.performance ? { performance: JSON.stringify(data.performance) } : {}),
        ...(data.targetAudience ? { targetAudience: JSON.stringify(data.targetAudience) } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    })
  }
  async findActive() {
    return prisma.adCampaign.findMany({ where: { status: 'active' as any } })
  }
}