// src/lib/api-error-handler.ts
import { debug } from './debug'

export interface ApiErrorResponse {
  error: string
  message: string
  status: number
  timestamp: string
  path?: string
  stack?: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown, request?: Request): ApiErrorResponse {
  debug.error('API Error occurred:', error)
  
  // Handle different error types
  if (error instanceof ApiError) {
    return {
      error: error.name,
      message: error.message,
      status: error.status,
      timestamp: new Date().toISOString(),
      path: request?.url,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  }
  
  if (error instanceof Error) {
    return {
      error: error.name,
      message: error.message,
      status: 500,
      timestamp: new Date().toISOString(),
      path: request?.url,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  }
  
  // Handle unknown errors
  return {
    error: 'UnknownError',
    message: 'An unexpected error occurred',
    status: 500,
    timestamp: new Date().toISOString(),
    path: request?.url,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: String(error),
      details: error 
    })
  }
}

// Enhanced API route wrapper with error handling
export function withApiErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args[0] as Request
      const errorResponse = handleApiError(error, request)
      
      debug.error('API route error:', error, {
        url: request?.url,
        method: request?.method,
        headers: Object.fromEntries(request?.headers || [])
      })
      
      return Response.json(errorResponse, { 
        status: errorResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      })
    }
  }
}

// Client-side fetch wrapper with error handling
export async function fetchWithErrorHandling(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const startTime = Date.now()
  
  try {
    debug.apiCall(options.method || 'GET', url, options.body)
    
    const response = await fetch(url, options)
    const duration = Date.now() - startTime
    
    debug.apiResponse(options.method || 'GET', url, response.status, { duration })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new ApiError(response.status, errorData.message || 'Request failed', errorData.code)
    }
    
    return response
  } catch (error) {
    const duration = Date.now() - startTime
    debug.apiError(options.method || 'GET', url, error as Error)
    
    if (error instanceof ApiError) {
      throw error
    }
    
    throw new ApiError(500, 'Network error occurred', 'NETWORK_ERROR', { duration })
  }
}