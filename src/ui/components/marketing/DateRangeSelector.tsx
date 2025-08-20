'use client'
import React from 'react'
export function DateRangeSelector({ value, onChange }: {
  value: string;
  onChange: (value: '7d' | '30d' | '90d' | '1y') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as '7d' | '30d' | '90d' | '1y')}
      className="border border-gray-300 rounded-md px-3 py-2 bg-white"
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="1y">Last year</option>
    </select>
  )
}
