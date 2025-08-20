'use client'

interface HeaderControlsProps {
  loading: boolean
  lastRefresh: Date | null
  onRefresh: () => void
}

export function HeaderControls({ loading, lastRefresh, onRefresh }: HeaderControlsProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600">Real-time insights and customer analytics</p>
      </div>
      <div className="text-right">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        {lastRefresh && (
          <p className="text-sm text-gray-500 mt-1">Last updated: {lastRefresh.toLocaleTimeString()}</p>
        )}
      </div>
    </div>
  )
}
