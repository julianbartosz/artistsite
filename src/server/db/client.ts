import { PrismaClient } from '@prisma/client'

// Ensure a single Prisma instance across hot reloads in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient()

// Optional alias used throughout the codebase
export const db = prisma

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
