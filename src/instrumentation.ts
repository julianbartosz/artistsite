// src/instrumentation.ts
import { registerOTel } from '@vercel/otel'

export async function register() {
  // Register OpenTelemetry for enhanced tracing
  registerOTel({ serviceName: 'artist-site' })
  
  // Only run in Node.js runtime, not Edge Runtime
  if (
    typeof process !== 'undefined' && 
    process.versions && 
    process.versions.node &&
    typeof process.on === 'function'
  ) {
    // Enhanced error tracking setup - Node.js only
    if (process.env.NODE_ENV === 'development') {
      // Development-specific error tracking
      process.on('uncaughtException', (error) => {
        console.error('🚨 Uncaught Exception:', error)
        console.error('Stack:', error.stack)
      })
      
      process.on('unhandledRejection', (reason, promise) => {
        console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason)
      })
    }
  }
  
  // Production error tracking (extensible for services like Sentry)
  if (process.env.NODE_ENV === 'production') {
    // Add production error tracking here
    console.log('🔍 Error tracking initialized for production')
  }
}