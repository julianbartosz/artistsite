'use client'
import React from 'react'
export function ChannelFilter({ selected, onChange }: {
  selected: string[];
  onChange: (channels: string[]) => void;
}) {
  const channels = ['email', 'social', 'ads', 'crm']
  return (
    <div className="flex space-x-2">
      {channels.map((channel) => (
        <button
          key={channel}
          onClick={() => {
            const newSelected = selected.includes(channel)
              ? selected.filter(c => c !== channel)
              : [...selected, channel]
            onChange(newSelected)
          }}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            selected.includes(channel)
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {channel.charAt(0).toUpperCase() + channel.slice(1)}
        </button>
      ))}
    </div>
  )
}
