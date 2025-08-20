'use client'
import React from 'react'
export function MetricCard({ title, value, change, changeType, icon }: {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      <div className={`mt-2 text-sm ${
        changeType === 'positive' ? 'text-green-600' : 'text-red-600'
      }`}>
        {change}
      </div>
    </div>
  )
}
