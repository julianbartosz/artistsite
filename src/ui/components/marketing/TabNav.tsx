import type { TabKey } from './types'

interface Props {
  active: TabKey
  onChange: (key: TabKey) => void
}

export function TabNav({ active, onChange }: Props) {
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'campaigns', label: 'Campaigns', icon: '🎯' },
    { key: 'automation', label: 'Automation', icon: '🤖' },
    { key: 'analytics', label: 'Analytics', icon: '📈' }
  ]

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              active === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
