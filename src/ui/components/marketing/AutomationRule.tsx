'use client'
import React from 'react'
export function AutomationRule({ name, trigger, status, performance }: {
  name: string;
  trigger: string;
  status: string;
  performance: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{name}</div>
        <div className={`text-xs px-2 py-1 rounded ${
          status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-1">Trigger: {trigger}</div>
      <div className="text-xs text-blue-600">{performance}</div>
    </div>
  )
}
