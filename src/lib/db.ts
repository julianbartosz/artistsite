import { prisma as serverPrisma, db as serverDb } from '@server/db/client'

// Re-export the singleton prisma client and db alias from the server layer
export const prisma = serverPrisma
export const db = serverDb