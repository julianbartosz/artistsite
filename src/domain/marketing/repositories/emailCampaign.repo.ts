// filepath: src/domain/marketing/repositories/emailCampaign.repo.ts
import { prisma } from '@/lib/db'

export class EmailCampaignRepository {
  async findFirstByNameAndType(name: string, type: 'sequence' | 'broadcast') {
    return prisma.emailCampaign.findFirst({ where: { name, type } as any })
  }
  async findById(id: string) {
    return prisma.emailCampaign.findUnique({ where: { id } })
  }
  async createDraft(data: {
    name: string
    type: 'sequence' | 'broadcast' | 'automated'
    templateId?: string
    segments?: string[]
    metrics?: any
  }) {
    return prisma.emailCampaign.create({
      data: {
        name: data.name,
        type: data.type as any,
        templateId: data.templateId || '',
        segments: JSON.stringify(data.segments || []),
        metrics: JSON.stringify(
          data.metrics || {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            converted: 0,
            bounced: 0,
            unsubscribed: 0,
            open_rate: 0,
            click_rate: 0,
            conversion_rate: 0,
          }
        ),
        status: 'draft' as any,
        createdAt: new Date(),
      },
    })
  }
  async updateStatus(id: string, status: 'draft' | 'active' | 'paused' | 'completed') {
    return prisma.emailCampaign.update({ where: { id }, data: { status } as any })
  }
  async findActiveCampaigns() {
    return prisma.emailCampaign.findMany({ where: { status: 'active' as any } })
  }
}