// src/lib/debug.ts
interface DebugConfig {
  enabled: boolean
  level: 'error' | 'warn' | 'info' | 'debug'
  showStack: boolean
  showTimestamp: boolean
}

type LogData = unknown
type ErrorContext = Record<string, unknown>

const debugConfig: DebugConfig = {
  enabled: process.env.NODE_ENV === 'development',
  level: 'debug',
  showStack: true,
  showTimestamp: true
}

export class DebugLogger {
  private static instance: DebugLogger
  private config: DebugConfig

  constructor(config: DebugConfig = debugConfig) {
    this.config = config
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger()
    }
    return DebugLogger.instance
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.config.showTimestamp ? new Date().toISOString() : ''
    const prefix = `[${level.toUpperCase()}]`
    return `${timestamp} ${prefix} ${message}`
  }

  private shouldLog(level: string): boolean {
    if (!this.config.enabled) return false
    
    const levels = ['error', 'warn', 'info', 'debug']
    const configLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)
    
    return messageLevelIndex <= configLevelIndex
  }

  error(message: string, error?: Error | unknown, context?: ErrorContext) {
    if (!this.shouldLog('error')) return

    console.error(this.formatMessage('error', message))
    
    if (error) {
      console.error('Error details:', error)
      if (this.config.showStack && error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
    
    if (context) {
      console.error('Context:', context)
    }
  }

  warn(message: string, data?: LogData) {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage('warn', message))
    if (data) console.warn(data)
  }

  info(message: string, data?: LogData) {
    if (!this.shouldLog('info')) return
    console.info(this.formatMessage('info', message))
    if (data) console.info(data)
  }

  debug(message: string, data?: LogData) {
    if (!this.shouldLog('debug')) return
    console.debug(this.formatMessage('debug', message))
    if (data) console.debug(data)
  }

  // Enhanced error tracking with context
  trackError(error: Error, context?: ErrorContext) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      context: context || {}
    }

    this.error('Error tracked:', error, errorInfo)
    
    // In development, create a more detailed error object
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Enhanced Error Details')
      console.error('Error Object:', error)
      console.error('Error Info:', errorInfo)
      console.error('Context:', context)
      console.groupEnd()
    }

    return errorInfo
  }

  // Performance monitoring
  time(label: string) {
    if (this.shouldLog('debug')) {
      console.time(label)
    }
  }

  timeEnd(label: string) {
    if (this.shouldLog('debug')) {
      console.timeEnd(label)
    }
  }

  // Component lifecycle debugging
  componentMount(componentName: string, props?: Record<string, unknown>) {
    this.debug(`Component mounted: ${componentName}`, props)
  }

  componentUnmount(componentName: string) {
    this.debug(`Component unmounted: ${componentName}`)
  }

  // API call debugging
  apiCall(method: string, url: string, data?: unknown) {
    this.debug(`API ${method.toUpperCase()}: ${url}`, data)
  }

  apiResponse(method: string, url: string, status: number, data?: unknown) {
    this.debug(`API ${method.toUpperCase()} Response: ${url} (${status})`, data)
  }

  apiError(method: string, url: string, error: Error) {
    this.error(`API ${method.toUpperCase()} Error: ${url}`, error)
  }
}

// Global debug instance
export const debug = DebugLogger.getInstance()

// Error reporting utility
export function reportError(error: Error, context?: ErrorContext) {
  const errorInfo = debug.trackError(error, context)
  
  // In production, you could send this to an error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to error tracking service
    // sendToErrorTrackingService(errorInfo)
  }
  
  return errorInfo
}

// Enhanced error wrapper for async functions
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
) {
  return async (...args: T): Promise<R> => {
    try {
      debug.time(`Function: ${fn.name || 'anonymous'}`)
      const result = await fn(...args)
      debug.timeEnd(`Function: ${fn.name || 'anonymous'}`)
      return result
    } catch (error) {
      debug.timeEnd(`Function: ${fn.name || 'anonymous'}`)
      reportError(error as Error, {
        functionName: fn.name || 'anonymous',
        arguments: args,
        ...context
      })
      throw error
    }
  }
}

// React Hook for error handling
export function useErrorHandler() {
  return (error: Error, context?: ErrorContext) => {
    reportError(error, context)
  }
}