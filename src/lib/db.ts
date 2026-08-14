import { PrismaClient } from '@prisma/client'

function assertValidDatabaseUrl() {
  if (process.env.JEST_WORKER_ID || process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build') return

  const url = process.env.DATABASE_URL
  if (!url) return
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://. Fix the deployment or local environment before starting the app.')
  }
}

assertValidDatabaseUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()
export const db = prisma // Add db export for consistency

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Force TypeScript to reload Prisma types by re-exporting the client
export type { PrismaClient } from '@prisma/client'

// Analytics event tracking types
export interface AnalyticsEvent {
  id?: string
  event_name: string
  user_id?: string
  session_id?: string
  properties: Record<string, any>
  timestamp?: Date
  page_url?: string
}

export interface CustomerProfile {
  id: string
  email?: string
  segments: string[]
  behavior_score: number
  preferences: Record<string, any>
  lifetime_value: number
  engagement_score: number
  last_activity: Date
  created_at?: Date
  updated_at?: Date
}

export interface EmailCampaign {
  id: string
  name: string
  type: 'sequence' | 'broadcast' | 'automated'
  template_id: string
  segments: string[]
  metrics: Record<string, any>
  status: string
  created_at: Date
}

export interface PromoCode {
  id: string
  code: string
  campaign_id?: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  usage_limit?: number
  usage_count: number
  expires_at?: Date
  created_at: Date
}