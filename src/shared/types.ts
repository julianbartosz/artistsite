// Shared cross-domain types
export interface AnalyticsEvent {
  id?: string
  event_name: string
  user_id?: string
  session_id?: string
  properties: Record<string, unknown>
  timestamp?: Date
  page_url?: string
}
export interface CustomerProfile {
  id: string
  email?: string
  segments: string[]
  behavior_score: number
  preferences: Record<string, unknown>
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
  metrics: Record<string, unknown>
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
