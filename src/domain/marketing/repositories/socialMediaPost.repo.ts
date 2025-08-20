// filepath: src/domain/marketing/repositories/socialMediaPost.repo.ts
import { prisma } from '@/lib/db'

export class SocialMediaPostRepository {
  async create(data: {
    platform: 'instagram' | 'facebook' | 'pinterest' | 'twitter'
    content: string
    mediaUrls: string[]
    hashtags?: string[]
    publishedAt?: Date | null
    scheduledAt?: Date | null
    status: 'draft' | 'scheduled' | 'published' | 'failed'
    engagement?: any
    campaignId?: string | null
  }) {
    return prisma.socialMediaPost.create({
      data: {
        platform: data.platform,
        content: data.content,
        mediaUrls: JSON.stringify(data.mediaUrls),
        hashtags: JSON.stringify(data.hashtags ?? []),
        publishedAt: data.publishedAt ?? null,
        scheduledAt: data.scheduledAt ?? null,
        status: data.status,
        engagement: JSON.stringify(
          data.engagement ?? {
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            reach: 0,
            impressions: 0,
            clicks: 0,
            engagementRate: 0,
          }
        ),
        campaignId: data.campaignId ?? null,
        createdAt: new Date(),
      },
    })
  }
  async findById(id: string) {
    return prisma.socialMediaPost.findUnique({ where: { id } })
  }
  async updateEngagement(id: string, engagement: any) {
    return prisma.socialMediaPost.update({
      where: { id },
      data: { engagement: JSON.stringify(engagement) },
    })
  }
}