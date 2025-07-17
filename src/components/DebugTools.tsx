// src/components/DebugTools.tsx
'use client'

import { useState } from 'react'
import { debug } from '@/lib/debug'

export function DebugTools() {
  const [logs, setLogs] = useState<string[]>([])

  const handleTestLog = () => {
    const message = 'Test log triggered at ' + new Date().toLocaleTimeString()
    console.log(message)
    debug.info('Test console log', { timestamp: new Date().toISOString() })
    setLogs(prev => [...prev, message])
  }

  const handleTestError = () => {
    try {
      throw new Error('Test error for debugging')
    } catch (error) {
      debug.error('Test error triggered', error)
      setLogs(prev => [...prev, `Error: ${(error as Error).message}`])
    }
  }

  const handleReload = () => {
    window.location.reload()
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="space-y-8">
      {/* Debug Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Debug Tools</h2>
          <div className="space-y-4">
            <button 
              onClick={handleTestLog}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Test Console Log
            </button>
            <button 
              onClick={handleTestError}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              Trigger Test Error
            </button>
            <button 
              onClick={handleReload}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Environment Variables</h2>
          <div className="space-y-2 text-sm bg-gray-50 p-4 rounded">
            <p><strong>NEXT_PUBLIC_*:</strong> Available client-side</p>
            <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
            <p><strong>DEBUG_DASHBOARD:</strong> {process.env.NEXT_PUBLIC_DEBUG_DASHBOARD ? 'Enabled' : 'Disabled'}</p>
            <p className="text-gray-500">Server env vars are hidden for security</p>
          </div>
        </div>
      </div>
      
      {/* Error Log */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Debug Log</h2>
          <button 
            onClick={clearLogs}
            className="text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
          >
            Clear
          </button>
        </div>
        <div className="bg-gray-50 rounded p-4 min-h-32 max-h-64 overflow-y-auto">
          {logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-700 border-b border-gray-200 pb-1">
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent logs. Use the debug tools above to generate logs.</p>
          )}
        </div>
      </div>
    </div>
  )
}