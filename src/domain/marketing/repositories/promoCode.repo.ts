// filepath: src/domain/marketing/repositories/promoCode.repo.ts
import { prisma } from '@/lib/db'

export class PromoCodeRepository {
  async create(params: {
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    usageLimit?: number | null
    expiresAt: Date
  }) {
    const promo = await prisma.promoCode.create({
      data: {
        code: params.code,
        discountType: params.discountType,
        discountValue: params.discountValue,
        usageLimit: params.usageLimit ?? 1,
        expiresAt: params.expiresAt,
        createdAt: new Date(),
      },
    })
    return promo
  }
}