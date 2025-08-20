export interface PerformanceMetrics {
  averageResponseTime: number
  requestsPerSecond: number
  errorRate: number
  p95ResponseTime: number
  memoryUsage: number
  cpuUsage: number
}

export interface SecurityStatus {
  overallScore: number
  criticalIssues: number
  lastAudit: string
  recommendations: string[]
}

export type HealthStatus = 'healthy' | 'warning' | 'error'

export interface SystemHealth {
  database: HealthStatus
  api: HealthStatus
  cache: HealthStatus
  uptime: string
}
