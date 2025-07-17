'use client'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { debug } from '@/lib/debug'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the error with enhanced debugging
  debug.trackError(error, {
    type: 'global-error',
    digest: error.digest,
    page: 'global-error-boundary'
  })

  return (
    <html>
      <body>
        <ErrorBoundary
          showDetails={process.env.NODE_ENV === 'development'}
          fallback={
            <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-red-500 text-6xl mb-4">💥</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Critical Error
                </h2>
                <p className="text-gray-600 mb-6">
                  A critical error occurred. Please try again or contact support if the problem persists.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={reset}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          }
        >
          <div className="min-h-screen bg-red-50 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-3xl font-bold text-red-600 mb-4">
                  🚨 Critical Application Error
                </h1>
                <p className="text-gray-700 mb-6">
                  A critical error occurred that couldn&apos;t be handled by the normal error boundaries.
                </p>
                
                {process.env.NODE_ENV === 'development' && (
                  <div className="bg-red-100 border border-red-300 rounded p-4 mb-6">
                    <h3 className="font-bold text-red-800 mb-2">Error Details:</h3>
                    <code className="text-red-900 text-sm block mb-2">
                      {error.message}
                    </code>
                    {error.digest && (
                      <p className="text-red-700 text-sm">
                        <strong>Digest:</strong> {error.digest}
                      </p>
                    )}
                    {error.stack && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-red-800 font-medium">
                          Stack Trace
                        </summary>
                        <pre className="text-red-900 text-xs mt-2 overflow-auto bg-red-50 p-2 rounded">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                
                <div className="flex gap-4">
                  <button
                    onClick={reset}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded transition-colors"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
}