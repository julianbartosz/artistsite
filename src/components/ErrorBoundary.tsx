// src/components/ErrorBoundary.tsx
'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Enhanced error logging with stack trace
    console.error('🚨 Error Boundary Caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name
    })

    // In development, show detailed error information
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Error Details')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Development error display
      if (process.env.NODE_ENV === 'development' && this.props.showDetails) {
        return (
          <div className="min-h-screen bg-red-50 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-red-100 border border-red-400 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-bold text-red-800 mb-4">
                  🚨 Application Error
                </h2>
                <p className="text-red-700 mb-4">
                  Something went wrong in the application. Check the console for more details.
                </p>
                
                {this.state.error && (
                  <div className="bg-red-200 p-4 rounded mb-4">
                    <h3 className="font-bold text-red-800 mb-2">Error Message:</h3>
                    <code className="text-red-900 text-sm">
                      {this.state.error.message}
                    </code>
                  </div>
                )}

                {this.state.error?.stack && (
                  <div className="bg-red-200 p-4 rounded mb-4">
                    <h3 className="font-bold text-red-800 mb-2">Stack Trace:</h3>
                    <pre className="text-red-900 text-xs overflow-auto max-h-64">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}

                {this.state.errorInfo?.componentStack && (
                  <div className="bg-red-200 p-4 rounded mb-4">
                    <h3 className="font-bold text-red-800 mb-2">Component Stack:</h3>
                    <pre className="text-red-900 text-xs overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        )
      }

      // Production error display
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: T) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}