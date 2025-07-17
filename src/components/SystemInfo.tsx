// src/components/SystemInfo.tsx
interface SystemInfoProps {
  nodeVersion: string
  environment: string
  platform: string
  uptime: number
  memoryUsage: number
  previewSecret: boolean
}

export function SystemInfo({ 
  nodeVersion, 
  environment, 
  platform, 
  uptime, 
  memoryUsage, 
  previewSecret 
}: SystemInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* System Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">System Info</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Node Version:</strong> {nodeVersion}</p>
          <p><strong>Environment:</strong> {environment}</p>
          <p><strong>Platform:</strong> {platform}</p>
          <p><strong>Uptime:</strong> {Math.floor(uptime)}s</p>
        </div>
      </div>
      
      {/* Error Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Error Stats</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Total Errors:</strong> <span className="text-red-600">0</span></p>
          <p><strong>API Errors:</strong> <span className="text-orange-600">0</span></p>
          <p><strong>Client Errors:</strong> <span className="text-yellow-600">0</span></p>
          <p><strong>Last Error:</strong> <span className="text-gray-500">None</span></p>
        </div>
      </div>
      
      {/* Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Performance</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Memory Usage:</strong> {Math.round(memoryUsage / 1024 / 1024)}MB</p>
          <p><strong>Response Time:</strong> <span className="text-green-600">Good</span></p>
          <p><strong>Build Time:</strong> <span className="text-blue-600">Fast</span></p>
        </div>
      </div>
    </div>
  )
}