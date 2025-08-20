// filepath: src/domain/marketing/repositories/user.repo.ts
import { prisma } from '@/lib/db'

export class UserRepository {
  async findByIdBasic(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } })
  }
  async findAbandonedCartCandidates(daysWithoutOrder = 7, take = 100) {
    const since = new Date(Date.now() - daysWithoutOrder * 24 * 60 * 60 * 1000)
    return prisma.user.findMany({
      where: { orders: { none: { createdAt: { gte: since } } } },
      take,
      select: { id: true, email: true, name: true },
    })
  }
}